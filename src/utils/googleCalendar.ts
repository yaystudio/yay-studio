import { Booking } from '../types';
import { formatIDR, getStoredStudioConfig } from './storage';

/**
 * Calculates start and end ISO strings and Google Calendar Web URL parameter (+08:00 WITA)
 */
export function getWitaStartEndStrings(
  dateStr: string,
  timeSlot: string,
  durationMinutes = 30
): {
  googleWebDatesParam: string;
} {
  const [hourStr, minStr] = (timeSlot || '10:00').split(':');
  const startHour = parseInt(hourStr || '10', 10);
  const startMin = parseInt(minStr || '00', 10);

  const totalStartMinutes = startHour * 60 + startMin;
  const totalEndMinutes = totalStartMinutes + durationMinutes;

  const endHour = Math.floor(totalEndMinutes / 60);
  const endMin = totalEndMinutes % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  const cleanDate = (dateStr || '').replace(/-/g, '');
  const googleWebDatesParam = `${cleanDate}T${pad(startHour)}${pad(startMin)}00/${cleanDate}T${pad(
    endHour
  )}${pad(endMin)}00`;

  return { googleWebDatesParam };
}

/**
 * Generates a Google Calendar web template URL for viewing or saving a booking
 */
export function generateGoogleCalendarWebUrl(booking: Booking, durationMinutes = 30): string {
  const effectiveDuration = booking.durationMinutes || durationMinutes || 30;
  const { googleWebDatesParam } = getWitaStartEndStrings(
    booking.date,
    booking.timeSlot,
    effectiveDuration
  );

  const currentConfig = getStoredStudioConfig();
  const studioAddress = currentConfig.address || '';
  const title = encodeURIComponent(
    `[Yay Studio] ${booking.serviceName} - ${booking.customer.name}`
  );

  const details = encodeURIComponent(
    `Sesi Foto ${currentConfig.name}\n` +
      `Kode Booking: #${booking.id}\n` +
      `Layanan: ${booking.serviceName}\n` +
      `Backdrop: ${booking.backdrop}\n` +
      `Waktu: ${booking.timeSlot} WITA (GMT+8)\n` +
      `Pemesan: ${booking.customer.name} (${booking.peopleCount} Orang)\n` +
      `Total: ${formatIDR(booking.totalPrice)}\n` +
      `Pembayaran: Dilakukan saat di studio` +
      (studioAddress ? `\nAlamat: ${studioAddress}` : '')
  );
  const location = encodeURIComponent(studioAddress);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${googleWebDatesParam}&details=${details}&location=${location}&ctz=Asia/Makassar`;
}

/**
 * Generates an iCalendar (.ics) file content string for customer download
 */
export function generateICSContent(booking: Booking, durationMinutes = 30): string {
  const effectiveDuration = booking.durationMinutes || durationMinutes || 30;
  const pad = (n: number) => String(n).padStart(2, '0');
  const [hourStr, minStr] = (booking.timeSlot || '10:00').split(':');
  const startHour = parseInt(hourStr || '10', 10);
  const startMin = parseInt(minStr || '00', 10);
  const totalStartMinutes = startHour * 60 + startMin;
  const totalEndMinutes = totalStartMinutes + effectiveDuration;
  const endHour = Math.floor(totalEndMinutes / 60);
  const endMin = totalEndMinutes % 60;
  const cleanDate = (booking.date || '').replace(/-/g, '');
  const dtStart = `${cleanDate}T${pad(startHour)}${pad(startMin)}00`;
  const dtEnd = `${cleanDate}T${pad(endHour)}${pad(endMin)}00`;

  const currentConfig = getStoredStudioConfig();
  const studioAddress = currentConfig.address || '';

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Yay Photo Studio//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:yay-booking-${booking.id}@yayphotostudio.com`,
    `DTSTAMP:${cleanDate}T000000Z`,
    `DTSTART;TZID=Asia/Makassar:${dtStart}`,
    `DTEND;TZID=Asia/Makassar:${dtEnd}`,
    `SUMMARY:[Yay Studio] ${booking.serviceName} - ${booking.customer.name}`,
    `DESCRIPTION:Sesi Foto ${currentConfig.name}\\nKode Booking: #${booking.id}\\nLayanan: ${booking.serviceName}\\nBackdrop: ${booking.backdrop}\\nNama: ${booking.customer.name} (${booking.peopleCount} Orang)\\nTotal: ${formatIDR(booking.totalPrice)}${studioAddress ? `\\nLokasi: ${studioAddress}` : ''}`,
    ...(studioAddress ? [`LOCATION:${studioAddress}`] : []),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return icsLines.join('\r\n');
}

/**
 * Triggers a browser download of the .ics iCalendar file for customer receipt
 */
export function downloadCalendarICSFile(booking: Booking, durationMinutes = 30): void {
  const ics = generateICSContent(booking, durationMinutes);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `YayStudio-Booking-${booking.id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
