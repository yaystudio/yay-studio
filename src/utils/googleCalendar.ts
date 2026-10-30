import { Booking } from '../types';
import { formatIDR, formatDateIndo, saveBooking } from './storage';
import { STUDIO_CONFIG } from '../data/studioData';
import { saveBookingToCloud } from './firestoreService';

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
  try {
    localStorage.setItem(SYNCED_CALENDAR_EVENTS_KEY, JSON.stringify(all));
  } catch {}
}

/**
 * Checks whether a booking has already been synced to Google Calendar,
 * either in localStorage record, or via persistent Cloud Firestore fields.
 */
export function isBookingSynced(booking: Booking, syncedMap?: Record<string, SyncedCalendarRecord>): boolean {
  if (booking.syncedToCalendar || !!booking.calendarEventId) return true;
  const map = syncedMap || getSyncedCalendarRecords();
  return !!map[booking.id];
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
      if (response.status === 401) {
        try {
          localStorage.removeItem('yay_studio_gcal_access_token_v1');
        } catch {}
        throw new Error('Sesi Google Calendar berakhir (401 Unauthorized). Silakan klik "Sinkronkan" untuk menghubungkan kembali akun Google.');
      }
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

    // Update the booking object and persist to Firestore + local storage
    booking.syncedToCalendar = true;
    booking.calendarEventId = data.id;
    try {
      saveBooking(booking);
      saveBookingToCloud(booking).catch((cloudErr) => {
        console.warn('Booking sync to Firestore note:', cloudErr);
      });
    } catch {}

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

const AUTO_SYNC_KEY = 'yay_studio_auto_sync_gcal_enabled';

export function getAutoSyncEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(AUTO_SYNC_KEY);
  return val === null ? true : val === 'true';
}

export function setAutoSyncEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTO_SYNC_KEY, String(enabled));
  }
}

/**
 * Automatically syncs all pending (unsynced) bookings to Google Calendar
 */
export async function syncAllPendingBookings(
  bookings: Booking[],
  accessToken: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ successCount: number; totalPending: number; errors: string[] }> {
  const synced = getSyncedCalendarRecords();
  const pending = bookings.filter((b) => !isBookingSynced(b, synced) && b.status !== 'cancelled');
  let successCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < pending.length; i++) {
    const booking = pending[i];
    const res = await createGoogleCalendarEvent(booking, accessToken, 30);
    if (res.success) {
      successCount++;
    } else {
      errors.push(`#${booking.id}: ${res.error || 'Gagal sinkron'}`);
    }
    if (onProgress) {
      onProgress(i + 1, pending.length);
    }
  }

  return { successCount, totalPending: pending.length, errors };
}

/**
 * Generates an iCalendar (.ics) file content string
 */
export function generateICSContent(booking: Booking, durationMinutes = 30): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const [hourStr, minStr] = booking.timeSlot.split(':');
  const startHour = parseInt(hourStr || '10', 10);
  const startMin = parseInt(minStr || '00', 10);
  const totalStartMinutes = startHour * 60 + startMin;
  const totalEndMinutes = totalStartMinutes + durationMinutes;
  const endHour = Math.floor(totalEndMinutes / 60);
  const endMin = totalEndMinutes % 60;
  const cleanDate = booking.date.replace(/-/g, '');
  const dtStart = `${cleanDate}T${pad(startHour)}${pad(startMin)}00`;
  const dtEnd = `${cleanDate}T${pad(endHour)}${pad(endMin)}00`;

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Yay Photo Studio//Makassar//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:yay-photo-${booking.id}@yayphotostudio.com`,
    `DTSTAMP:${cleanDate}T000000Z`,
    `DTSTART;TZID=Asia/Makassar:${dtStart}`,
    `DTEND;TZID=Asia/Makassar:${dtEnd}`,
    `SUMMARY:Yay Photo Studio: ${booking.serviceName} (#${booking.id})`,
    `DESCRIPTION:Sesi Foto Yay Photo Studio\\nKode Booking: #${booking.id}\\nLayanan: ${booking.serviceName}\\nBackdrop: ${booking.backdrop}\\nNama: ${booking.customer.name} (${booking.peopleCount} Orang)\\nTotal: ${formatIDR(booking.totalPrice)}\\nLokasi: ${STUDIO_CONFIG.address}`,
    `LOCATION:${STUDIO_CONFIG.address}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return icsLines.join('\r\n');
}

/**
 * Triggers a browser download of the .ics iCalendar file for iOS / Android / Outlook
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

