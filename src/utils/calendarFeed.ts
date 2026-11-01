import { Booking } from '../types';
import { STUDIO_CONFIG } from '../data/studioData';
import { getStoredStudioConfig } from './storage';

/**
 * Generates RFC 5545 compliant iCalendar (.ics) string for all active bookings
 * Compatible with Google Calendar, Apple Calendar, and Microsoft Outlook.
 */
export function generateFullCalendarFeedICS(bookings: Booking[]): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const dtStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const currentConfig = getStoredStudioConfig();
  const studioAddress = currentConfig.address || '';

  const validBookings = (bookings || []).filter(
    (b) => b && b.status !== 'cancelled' && b.date && b.timeSlot
  );

  const events = validBookings.map((b) => {
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

    const summary = `[${currentConfig.name}] ${b.serviceName || 'Sesi Foto'} - ${b.customer?.name || 'Customer'}`;
    const description = [
      `📸 ${currentConfig.name.toUpperCase()}`,
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
      ...(studioAddress ? [`Alamat: ${studioAddress}`] : []),
      `WhatsApp: +${currentConfig.whatsappNumber || STUDIO_CONFIG.whatsappNumber}`,
    ].join('\\n');

    return [
      'BEGIN:VEVENT',
      `UID:yay-booking-${b.id}@yayphotostudio.com`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;TZID=Asia/Makassar:${dtStart}`,
      `DTEND;TZID=Asia/Makassar:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      ...(studioAddress ? [`LOCATION:${studioAddress}`] : []),
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
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
}

/**
 * Downloads a complete backup of all current bookings as an .ics file
 */
export function downloadAllBookingsICS(bookings: Booking[]): void {
  const ics = generateFullCalendarFeedICS(bookings);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `YayStudio-Semua-Jadwal-${new Date().toISOString().slice(0, 10)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
