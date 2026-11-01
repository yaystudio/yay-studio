import type { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export default async function handler(req: Request, res: Response) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    body = body || {};

    const { booking, config } = body;
    if (!booking) {
      return res.status(400).json({ error: 'Data booking diperlukan' });
    }

    // Always fetch latest authoritative studio config from Firestore
    let studioConfig = { ...(config || {}) };
    try {
      const configDoc = await getDoc(doc(db, 'config', 'studio'));
      if (configDoc.exists()) {
        studioConfig = { ...studioConfig, ...configDoc.data() };
      }
    } catch (e) {
      console.warn('Could not read Firestore config on serverless api:', e);
    }

    const adminEmail = studioConfig?.adminEmail || 'yayphotostudio@gmail.com';
    const address = studioConfig?.address || '';
    const studioName = studioConfig?.name || 'Yay Photo Studio';
    const senderUser = studioConfig?.smtpUser || studioConfig?.adminEmail || 'yayphotostudio@gmail.com';
    const senderPass = studioConfig?.smtpPass || process.env.SMTP_PASS;

    if (!senderUser || !senderPass) {
      console.log(`[Email Dispatch Log] SMTP not configured. Booking #${booking.id} notification logged for: ${adminEmail}`);
      return res.status(200).json({
        success: false,
        notConfigured: true,
        adminEmail,
        message: 'Kredensial SMTP belum diisi di Pengaturan Email Admin Studio.',
      });
    }

    const host = studioConfig?.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(studioConfig?.smtpPort || process.env.SMTP_PORT || 465);
    const secure = port === 465;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: String(senderUser).trim(),
        pass: String(senderPass).trim(),
      },
    });

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
        console.warn('Customer confirmation email send warning in api/send-booking-email:', e);
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
    console.error('Error sending booking emails in api/send-booking-email:', err);
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
}
