import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Firebase for server
const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(fbApp, (firebaseConfig as any).firestoreDatabaseId);

// iCal Feed Route for Google Calendar / Apple Calendar
app.get(['/api/calendar.ics', '/api/calendar', '/calendar.ics'], async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    const bookings: any[] = [];
    snap.forEach((doc) => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    const now = new Date();
    const dtStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const pad = (n: number) => String(n).padStart(2, '0');

    let address = '';
    try {
      const configDoc = await getDoc(doc(db, 'config', 'studio'));
      if (configDoc.exists()) {
        address = configDoc.data()?.address || '';
      }
    } catch {}

    const events = bookings
      .filter((b) => b && b.status !== 'cancelled' && b.date && b.timeSlot)
      .map((b) => {
        const [hourStr, minStr] = (b.timeSlot || '10:00').split(':');
        const startHour = parseInt(hourStr || '10', 10);
        const startMin = parseInt(minStr || '00', 10);
        const durationMinutes = 30;
        const totalStartMinutes = startHour * 60 + startMin;
        const totalEndMinutes = totalStartMinutes + durationMinutes;
        const endHour = Math.floor(totalEndMinutes / 60);
        const endMin = totalEndMinutes % 60;
        const cleanDate = (b.date || '').replace(/-/g, '');
        const dtStart = `${cleanDate}T${pad(startHour)}${pad(startMin)}00`;
        const dtEnd = `${cleanDate}T${pad(endHour)}${pad(endMin)}00`;

        const summary = `[Yay Studio] ${b.serviceName || 'Sesi Foto'} - ${b.customer?.name || 'Customer'}`;
        const description = [
          `📸 YAY PHOTO STUDIO`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `• Kode Booking: #${b.id}`,
          `• Layanan: ${b.serviceName}`,
          `• Tanggal: ${b.date}`,
          `• Jam: ${b.timeSlot} WITA (GMT+8)`,
          `• Warna Backdrop: ${b.backdrop || '-'}`,
          `• Jumlah Orang: ${b.peopleCount || 1} Orang`,
          `• Total: Rp ${Number(b.totalPrice || 0).toLocaleString('id-ID')}`,
          `• Status: ${(b.status || 'confirmed').toUpperCase()}`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `DATA PEMESAN:`,
          `• Nama: ${b.customer?.name || '-'}`,
          `• WhatsApp: ${b.customer?.whatsapp || '-'}`,
          `• Email: ${b.customer?.email || '-'}`,
          `• Catatan: ${b.customer?.notes || '-'}`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Alamat: ${address}`,
        ].join('\\n');

        return [
          'BEGIN:VEVENT',
          `UID:yay-booking-${b.id}@yayphotostudio.com`,
          `DTSTAMP:${dtStamp}`,
          `DTSTART;TZID=Asia/Makassar:${dtStart}`,
          `DTEND;TZID=Asia/Makassar:${dtEnd}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${description}`,
          `LOCATION:${address}`,
          'STATUS:CONFIRMED',
          'TRANSP:OPAQUE',
          'END:VEVENT',
        ].join('\r\n');
      });

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Yay Photo Studio//ID',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Yay Photo Studio - Jadwal Booking',
      'X-WR-TIMEZONE:Asia/Makassar',
      'X-WR-CALDESC:Jadwal Reservasi Realtime Yay Photo Studio (WITA)',
      'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
      'X-PUBLISHED-TTL:PT15M',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="yay-photo-studio.ics"');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).send(icsContent);
  } catch (err: any) {
    console.error('Failed to generate calendar feed:', err);
    return res.status(500).send('Error generating calendar feed');
  }
});

// Helper to create nodemailer transporter
function getTransporter(config: any) {
  const user = config?.smtpUser || config?.adminEmail || process.env.SMTP_USER || 'yayphotostudio@gmail.com';
  const pass = config?.smtpPass || process.env.SMTP_PASS;
  const host = config?.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(config?.smtpPort || process.env.SMTP_PORT || 465);
  const secure = port === 465;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: String(user).trim(),
      pass: String(pass).trim(),
    },
  });
}

// Endpoint to dispatch booking notification emails
app.post('/api/send-booking-email', async (req, res) => {
  try {
    const { booking, config } = req.body;
    if (!booking) {
      return res.status(400).json({ error: 'Data booking diperlukan' });
    }

    // Always fetch latest authoritative studio config from Firestore
    let studioConfig = { ...config };
    try {
      const configDoc = await getDoc(doc(db, 'config', 'studio'));
      if (configDoc.exists()) {
        studioConfig = { ...studioConfig, ...configDoc.data() };
      }
    } catch (e) {
      console.warn('Could not read Firestore config on server:', e);
    }

    const adminEmail = studioConfig?.adminEmail || 'yayphotostudio@gmail.com';
    const address = studioConfig?.address || '';
    const studioName = studioConfig?.name || 'Yay Photo Studio';
    const senderUser = studioConfig?.smtpUser || studioConfig?.adminEmail || 'yayphotostudio@gmail.com';

    const transporter = getTransporter(studioConfig);

    if (!transporter) {
      console.log(`[Email Dispatch Log] SMTP not configured. Booking #${booking.id} notification logged for: ${adminEmail}`);
      return res.status(200).json({
        success: false,
        notConfigured: true,
        adminEmail,
        message: 'Kredensial SMTP belum diisi di Pengaturan Email Admin Studio. Notifikasi dapat dibuka langsung via Gmail.',
      });
    }

    const fromAddress = studioConfig?.smtpFrom || `"${studioName}" <${senderUser}>`;

    // 1. Admin Email HTML
    const adminSubject = `[Booking Baru Masuk] ${booking.serviceName} - ${booking.customer?.name} (#${booking.id})`;
    const adminHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 16px; overflow: hidden; color: #171717;">
        <div style="background: #0a0a0a; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">${studioName.toUpperCase()}</h1>
          <p style="margin: 0; font-size: 13px; color: #a3a3a3; font-family: monospace;">NOTIFIKASI RESERVASI BARU · WITA (GMT+8)</p>
        </div>
        <div style="padding: 28px 24px;">
          <div style="background: #f5f5f5; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 15px; font-weight: 700; color: #171717;">Booking Baru Diterima!</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #525252;">Pelanggan baru saja menyelesaikan reservasi melalui website studio.</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr><td style="padding: 8px 0; color: #737373; width: 140px;">Kode Booking:</td><td style="padding: 8px 0; font-weight: 700; font-family: monospace;">#${booking.id}</td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">Nama Customer:</td><td style="padding: 8px 0; font-weight: 700;">${booking.customer?.name || '-'}</td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">WhatsApp:</td><td style="padding: 8px 0;"><a href="https://wa.me/${(booking.customer?.whatsapp || '').replace(/[^0-9]/g, '')}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${booking.customer?.whatsapp || '-'}</a></td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">Email:</td><td style="padding: 8px 0;">${booking.customer?.email || '-'}</td></tr>
            ${booking.customer?.notes ? `<tr><td style="padding: 8px 0; color: #737373;">Catatan:</td><td style="padding: 8px 0; font-style: italic;">${booking.customer.notes}</td></tr>` : ''}
            <tr style="border-top: 1px dashed #e5e5e5;"><td style="padding: 12px 0 8px 0; color: #737373;">Layanan:</td><td style="padding: 12px 0 8px 0; font-weight: 700;">${booking.serviceName}</td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">Tanggal Sesi:</td><td style="padding: 8px 0; font-weight: 700;">${booking.date}</td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">Jam Sesi:</td><td style="padding: 8px 0; font-weight: 700; color: #2563eb;">${booking.timeSlot} WITA</td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">Warna Backdrop:</td><td style="padding: 8px 0;">${booking.backdrop || '-'}</td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">Jumlah Orang:</td><td style="padding: 8px 0;">${booking.peopleCount} Orang</td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">Total Biaya:</td><td style="padding: 8px 0; font-weight: 800; font-size: 15px; color: #16a34a;">Rp ${Number(booking.totalPrice || 0).toLocaleString('id-ID')}</td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">Metode Bayar:</td><td style="padding: 8px 0; font-size: 12px;">${booking.paymentNote || 'Pembayaran dapat dilakukan saat di studio'}</td></tr>
          </table>

          ${address ? `
            <div style="margin-top: 24px; padding: 14px; background: #fbfbfb; border: 1px solid #f0f0f0; border-radius: 8px; font-size: 11px; color: #737373;">
              <strong>Lokasi Studio:</strong> ${address}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Generate iCalendar format for admin's calendar entry only
    const bookingDuration = Number(booking.durationMinutes) || 30;
    const [hStr, mStr] = (booking.timeSlot || '10:00').split(':');
    const startH = parseInt(hStr || '10', 10);
    const startM = parseInt(mStr || '00', 10);
    const endMinutes = startH * 60 + startM + bookingDuration;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const cleanD = (booking.date || '').replace(/-/g, '');
    const dtStart = `${cleanD}T${String(startH).padStart(2, '0')}${String(startM).padStart(2, '0')}00`;
    const dtEnd = `${cleanD}T${String(endH).padStart(2, '0')}${String(endM).padStart(2, '0')}00`;
    const dtNow = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const icsBookingEvent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Yay Photo Studio//ID',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:yay-booking-${booking.id}@yayphotostudio.com`,
      `DTSTAMP:${dtNow}`,
      `DTSTART;TZID=Asia/Makassar:${dtStart}`,
      `DTEND;TZID=Asia/Makassar:${dtEnd}`,
      `SUMMARY:[Yay Studio] ${booking.serviceName} - ${booking.customer?.name}`,
      `DESCRIPTION:Kode Booking: #${booking.id}\\nLayanan: ${booking.serviceName}\\nTanggal: ${booking.date}\\nJam: ${booking.timeSlot} WITA\\nPelanggan: ${booking.customer?.name} (${booking.customer?.whatsapp})\\nTotal: Rp ${Number(booking.totalPrice || 0).toLocaleString('id-ID')}${address ? `\\nLokasi: ${address}` : ''}`,
      ...(address ? [`LOCATION:${address}`] : []),
      'STATUS:CONFIRMED',
      `ORGANIZER;CN="${studioName}":mailto:${senderUser}`,
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN="Admin Yay Studio":mailto:${adminEmail}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Pengingat Sesi Foto Yay Studio',
      'TRIGGER:-PT15M',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    // Send to Admin with official calendar invite so Gmail automatically & permanently adds to Google Calendar
    const sendAdminPromise = transporter.sendMail({
      from: fromAddress,
      to: adminEmail,
      subject: adminSubject,
      html: adminHtml,
      icalEvent: {
        filename: `jadwal-${booking.id}.ics`,
        method: 'REQUEST',
        content: icsBookingEvent,
      },
    });

    // Send single confirmation to Customer without separate RSVP invitation so customer receives ONLY 1 email
    let sendCustomerPromise: Promise<any> = Promise.resolve(null);
    if (booking.customer?.email) {
      const gcalDates = `${cleanD}T${String(startH).padStart(2, '0')}${String(startM).padStart(2, '0')}00/${cleanD}T${String(endH).padStart(2, '0')}${String(endM).padStart(2, '0')}00`;
      const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${studioName}: ${booking.serviceName}`)}&dates=${gcalDates}&details=${encodeURIComponent(`Kode Booking: #${booking.id}\nLayanan: ${booking.serviceName}\nTotal: Rp ${Number(booking.totalPrice || 0).toLocaleString('id-ID')}`)}&location=${encodeURIComponent(address)}&ctz=Asia/Makassar`;

      const customerSubject = `Konfirmasi Reservasi ${studioName} - #${booking.id}`;
      const customerHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 16px; overflow: hidden; color: #171717;">
          <div style="background: #0a0a0a; color: #ffffff; padding: 24px; text-align: center;">
            <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">${studioName.toUpperCase()}</h1>
            <p style="margin: 0; font-size: 13px; color: #a3a3a3;">Minimalist Self-Photo & Portrait Studio</p>
          </div>
          <div style="padding: 28px 24px;">
            <p style="font-size: 16px; font-weight: 700; margin: 0 0 8px 0;">Halo ${booking.customer.name},</p>
            <p style="font-size: 14px; color: #404040; margin: 0 0 20px 0; line-height: 1.5;">
              Terima kasih telah melakukan reservasi di ${studioName}. Jadwal sesi foto Anda telah berhasil dikonfirmasi dan dicatat dalam kalender studio kami.
            </p>

            <div style="background: #fafafa; border: 1px solid #eaeaea; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr><td style="padding: 6px 0; color: #737373;">Kode Booking:</td><td style="padding: 6px 0; font-weight: 700; font-family: monospace;">#${booking.id}</td></tr>
                <tr><td style="padding: 6px 0; color: #737373;">Paket Layanan:</td><td style="padding: 6px 0; font-weight: 700;">${booking.serviceName}</td></tr>
                <tr><td style="padding: 6px 0; color: #737373;">Tanggal:</td><td style="padding: 6px 0; font-weight: 700;">${booking.date}</td></tr>
                <tr><td style="padding: 6px 0; color: #737373;">Waktu / Jam:</td><td style="padding: 6px 0; font-weight: 700; color: #2563eb;">${booking.timeSlot} WITA</td></tr>
                <tr><td style="padding: 6px 0; color: #737373;">Backdrop:</td><td style="padding: 6px 0;">${booking.backdrop || '-'}</td></tr>
                <tr><td style="padding: 6px 0; color: #737373;">Jumlah Orang:</td><td style="padding: 6px 0;">${booking.peopleCount} Orang</td></tr>
                <tr><td style="padding: 6px 0; color: #737373;">Total Biaya:</td><td style="padding: 6px 0; font-weight: 800; font-size: 14px; color: #16a34a;">Rp ${Number(booking.totalPrice || 0).toLocaleString('id-ID')}</td></tr>
                <tr><td style="padding: 6px 0; color: #737373;">Metode Bayar:</td><td style="padding: 6px 0;">${booking.paymentNote || 'Pembayaran dapat dilakukan saat di studio'}</td></tr>
              </table>
            </div>

            <div style="margin-bottom: 24px; font-size: 13px; color: #404040; line-height: 1.6;">
              <strong style="color: #171717;">Petunjuk Sesi Foto:</strong>
              <ol style="margin: 6px 0 0 0; padding-left: 20px;">
                <li>Harap hadir di studio paling lambat 10 menit sebelum jam sesi dimulai.</li>
                <li>Aksesoris bando, topi, kacamata aesthetic & properti foto tersedia gratis di studio.</li>
                <li>Semua soft files digital original akan diunggah ke link Google Drive dan dikirimkan ke email ini.</li>
              </ol>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${gcalUrl}" target="_blank" style="display: inline-block; padding: 10px 18px; background: #171717; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 600; border-radius: 8px;">
                📅 Tambahkan ke Google Calendar Anda
              </a>
            </div>

            <div style="padding-top: 18px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #737373; line-height: 1.5;">
              ${address ? `<p style="margin: 0 0 6px 0;"><strong>Alamat Studio:</strong> ${address}</p>` : ''}
              <p style="margin: 0;">Sampai jumpa di studio! Jika ada pertanyaan, hubungi WhatsApp studio kami.</p>
            </div>
          </div>
        </div>
      `;

      sendCustomerPromise = transporter.sendMail({
        from: fromAddress,
        to: booking.customer.email,
        subject: customerSubject,
        html: customerHtml,
      }).catch((e) => {
        console.warn('Customer confirmation email send warning:', e);
        return null;
      });
    }

    await Promise.all([sendAdminPromise, sendCustomerPromise]);

    return res.status(200).json({
      success: true,
      delivered: true,
      adminEmail,
      message: `Email notifikasi booking berhasil dikirim ke ${adminEmail}`,
    });
  } catch (err: any) {
    console.error('Error sending booking emails:', err);
    let errMsg = err.message || 'Gagal mengirim email';
    if (errMsg.includes('534') || errMsg.includes('Application-specific password') || errMsg.includes('InvalidSecondFactor')) {
      errMsg = 'Google mewajibkan Sandi Aplikasi (App Password 16 karakter). Kunjungi myaccount.google.com/apppasswords untuk membuat sandi aplikasi 16 karakter.';
    } else if (errMsg.includes('Invalid login') || errMsg.includes('Username and Password not accepted')) {
      errMsg = 'Email akun atau Sandi Aplikasi Gmail ditolak. Pastikan menggunakan Sandi Aplikasi 16 karakter dari myaccount.google.com/apppasswords.';
    }
    return res.status(500).json({
      success: false,
      error: errMsg,
    });
  }
});

// Route to test SMTP Configuration
app.post('/api/test-smtp', async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPass, recipient } = req.body;
    let user = smtpUser;
    let pass = smtpPass;

    if (!pass || !user) {
      try {
        const configDoc = await getDoc(doc(db, 'config', 'studio'));
        if (configDoc.exists()) {
          const d = configDoc.data();
          pass = pass || d?.smtpPass;
          user = user || d?.smtpUser || d?.adminEmail;
        }
      } catch {}
    }

    user = user || 'yayphotostudio@gmail.com';

    if (!pass) {
      return res.status(400).json({
        success: false,
        error: 'Sandi Aplikasi Gmail (16 karakter) belum diisi. Masukkan 16 karakter dari myaccount.google.com/apppasswords.',
      });
    }

    const host = smtpHost || 'smtp.gmail.com';
    const port = Number(smtpPort || 465);
    const targetRecipient = recipient || user || 'yayphotostudio@gmail.com';

    const testTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: String(user).trim(),
        pass: String(pass).trim(),
      },
    });

    await testTransporter.verify();

    // Read studio address dynamically
    let studioAddr = '';
    try {
      const configDoc = await getDoc(doc(db, 'config', 'studio'));
      if (configDoc.exists()) {
        studioAddr = configDoc.data()?.address || '';
      }
    } catch {}

    await testTransporter.sendMail({
      from: `"Yay Photo Studio Test" <${String(smtpUser).trim()}>`,
      to: targetRecipient,
      subject: '[Tes Sistem] Koneksi Email Yay Photo Studio Berhasil!',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #059669; margin-top: 0;">🎉 Koneksi Email Otomatis Berhasil!</h2>
          <p>Halo Admin Yay Photo Studio,</p>
          <p>Ini adalah pesan konfirmasi uji coba. Server email studio Anda telah terhubung dengan sempurna ke <strong>${targetRecipient}</strong>.</p>
          <p>Mulai sekarang, setiap ada pelanggan yang melakukan reservasi baru di website, email pemberitahuan otomatis akan langsung masuk ke inbox Anda dan inbox customer tanpa perlu menekan tombol apapun.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; margin: 0;">Yay Photo Studio${studioAddr ? ` · ${studioAddr}` : ''}</p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: `Email uji coba berhasil dikirim ke ${targetRecipient}! Silakan cek kotak masuk email Anda.`,
    });
  } catch (err: any) {
    console.error('SMTP test failure:', err);
    let errMsg = err.message || 'Gagal mengirim email uji coba.';
    if (errMsg.includes('534') || errMsg.includes('Application-specific password') || errMsg.includes('InvalidSecondFactor')) {
      errMsg = 'Google mewajibkan "Sandi Aplikasi" (App Password 16 karakter), bukan password akun Gmail biasa. Silakan buat sandi aplikasi di myaccount.google.com/apppasswords.';
    } else if (errMsg.includes('Invalid login') || errMsg.includes('Username and Password not accepted')) {
      errMsg = 'Email akun atau Sandi Aplikasi Gmail ditolak. Pastikan Anda memasukkan Sandi Aplikasi 16 karakter dari myaccount.google.com/apppasswords.';
    }
    return res.status(400).json({
      success: false,
      error: errMsg,
    });
  }
});

// Vite Middleware for Development or Static serving for Production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
