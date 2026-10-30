import { Booking } from '../types';
import { formatIDR, formatDateIndo } from './storage';
import { STUDIO_CONFIG } from '../data/studioData';

const SYNCED_CALENDAR_EVENTS_KEY = 'yay_studio_google_calendar_events_v1';

export interface SyncedCalendarRecord {
  bookingId: string;
  calendarEventId: string;
  htmlLink?: string;
  syncedAt: string;
}

export function getSyncedCalendarRecords(): Record<string, SyncedCalendarRecord> {
  try {
    const raw = localStorage.getItem(SYNCED_CALENDAR_EVENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSyncedCalendarRecord(record: SyncedCalendarRecord): void {
  const all = getSyncedCalendarRecords();
  all[record.bookingId] = record;
  localStorage.setItem(SYNCED_CALENDAR_EVENTS_KEY, JSON.stringify(all));
}

/**
 * Calculates start and end ISO strings with Makassar offset (+08:00)
 */
export function getMakassarStartEndISO(dateStr: string, timeSlot: string, durationMinutes = 30): {
  startISO: string;
  endISO: string;
  googleWebDatesParam: string;
} {
  const [hourStr, minStr] = timeSlot.split(':');
  const startHour = parseInt(hourStr || '10', 10);
  const startMin = parseInt(minStr || '00', 10);

  const totalStartMinutes = startHour * 60 + startMin;
  const totalEndMinutes = totalStartMinutes + durationMinutes;

  const endHour = Math.floor(totalEndMinutes / 60);
  const endMin = totalEndMinutes % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  // Format: YYYY-MM-DDTHH:mm:00+08:00
  const startISO = `${dateStr}T${pad(startHour)}:${pad(startMin)}:00+08:00`;
  const endISO = `${dateStr}T${pad(endHour)}:${pad(endMin)}:00+08:00`;

  // Format for Google Calendar Web URL (YYYYMMDDTHHmm00)
  const cleanDate = dateStr.replace(/-/g, '');
  const googleWebDatesParam = `${cleanDate}T${pad(startHour)}${pad(startMin)}00/${cleanDate}T${pad(endHour)}${pad(endMin)}00`;

  return { startISO, endISO, googleWebDatesParam };
}

/**
 * Creates an event on the user's primary Google Calendar via Google Calendar API v3
 */
export async function createGoogleCalendarEvent(
  booking: Booking,
  accessToken: string,
  durationMinutes = 30
): Promise<{ success: boolean; eventId?: string; htmlLink?: string; error?: string }> {
  try {
    const { startISO, endISO } = getMakassarStartEndISO(booking.date, booking.timeSlot, durationMinutes);

    const description = [
      `📸 YAY PHOTO STUDIO - BOOKING SESI FOTO`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `• Kode Reservasi: #${booking.id}`,
      `• Layanan: ${booking.serviceName}`,
      `• Tanggal Sesi: ${formatDateIndo(booking.date)}`,
      `• Waktu / Jam: ${booking.timeSlot} WITA (GMT+8 · Makassar)`,
      `• Warna Backdrop: ${booking.backdrop}`,
      `• Jumlah Orang: ${booking.peopleCount} Orang`,
      `• Total Biaya: ${formatIDR(booking.totalPrice)}`,
      `• Pembayaran: ${booking.paymentNote || 'Pembayaran dapat dilakukan saat di studio'}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `DATA PEMESAN:`,
      `• Nama: ${booking.customer.name}`,
      `• WhatsApp: ${booking.customer.whatsapp}`,
      `• Email: ${booking.customer.email}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `LOKASI STUDIO:`,
      `${STUDIO_CONFIG.address}`,
      `Instagram: ${STUDIO_CONFIG.instagram} | WhatsApp: +${STUDIO_CONFIG.whatsappNumber}`,
      `*Harap hadir 10 menit sebelum jam sesi dimulai.`
    ].join('\n');

    const eventPayload = {
      summary: `[Yay Studio] ${booking.serviceName} - ${booking.customer.name}`,
      description,
      location: STUDIO_CONFIG.address,
      start: {
        dateTime: startISO,
        timeZone: 'Asia/Makassar',
      },
      end: {
        dateTime: endISO,
        timeZone: 'Asia/Makassar',
      },
      attendees: [
        { email: booking.customer.email, displayName: booking.customer.name },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'email', minutes: 120 },
        ],
      },
    };

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `Google Calendar API error: ${response.status}`);
    }

    const data = await response.json();

    const record: SyncedCalendarRecord = {
      bookingId: booking.id,
      calendarEventId: data.id,
      htmlLink: data.htmlLink,
      syncedAt: new Date().toISOString(),
    };
    saveSyncedCalendarRecord(record);

    return {
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink,
    };
  } catch (err: any) {
    console.error('Failed to create calendar event:', err);
    return {
      success: false,
      error: err.message || 'Terjadi kesalahan saat menghubungkan ke Google Calendar.',
    };
  }
}

/**
 * Generates a direct Google Calendar web template URL
 * Allows users to add the event directly in browser with 1 click
 */
export function generateGoogleCalendarWebUrl(booking: Booking, durationMinutes = 30): string {
  const { googleWebDatesParam } = getMakassarStartEndISO(booking.date, booking.timeSlot, durationMinutes);

  const title = encodeURIComponent(`Yay Photo Studio: ${booking.serviceName} (#${booking.id})`);
  const details = encodeURIComponent(
    `Sesi Foto Yay Photo Studio\n` +
    `Kode Booking: #${booking.id}\n` +
    `Layanan: ${booking.serviceName}\n` +
    `Backdrop: ${booking.backdrop}\n` +
    `Waktu: ${booking.timeSlot} WITA (GMT+8 Makassar)\n` +
    `Pemesan: ${booking.customer.name} (${booking.peopleCount} Orang)\n` +
    `Total: ${formatIDR(booking.totalPrice)}\n` +
    `Pembayaran: Dilakukan saat di studio\n\n` +
    `Alamat: ${STUDIO_CONFIG.address}`
  );
  const location = encodeURIComponent(STUDIO_CONFIG.address);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${googleWebDatesParam}&details=${details}&location=${location}&ctz=Asia/Makassar`;
}
