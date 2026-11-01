import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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
    const address = 'Jl. Pengayoman, Ruko Pasar Segar Blok RA No. 12, Makassar, Sulawesi Selatan';

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
          `📸 YAY PHOTO STUDIO MAKASSAR`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `• Kode Booking: #${b.id}`,
          `• Layanan: ${b.serviceName}`,
          `• Tanggal: ${b.date}`,
          `• Jam: ${b.timeSlot} WITA (GMT+8 Makassar)`,
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
      'PRODID:-//Yay Photo Studio//Makassar//ID',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Yay Photo Studio - Jadwal Booking',
      'X-WR-TIMEZONE:Asia/Makassar',
      'X-WR-CALDESC:Jadwal Reservasi Realtime Yay Photo Studio Makassar (WITA)',
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
