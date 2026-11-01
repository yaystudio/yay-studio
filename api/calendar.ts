import type { Request, Response } from 'express';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export default async function handler(req: Request, res: Response) {
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
}
