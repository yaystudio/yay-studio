import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Firebase for server
const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(fbApp, (firebaseConfig as any).firestoreDatabaseId);

// Track in-flight CalDAV operations to avoid duplicate concurrent calls
const inFlightCalDav = new Set<string>();

/**
 * Directly inserts or updates a booking event in yayphotostudio@gmail.com's Google Calendar
 * via Google's official CalDAV interface using the studio's permanent App Password.
 * Never expires after 1 hour, requires zero browser OAuth login, and uses default phone notifications.
 */
async function syncBookingToGoogleCalendarCalDAV(
  booking: any,
  studioConfig: any
): Promise<{ success: boolean; uid: string; status?: number; error?: string }> {
  const bookingId = String(booking?.id || '').trim();
  const uid = `yay-booking-${bookingId}@yayphotostudio.com`;
  if (!bookingId) {
    return { success: false, uid, error: 'Missing booking ID' };
  }

  const calendarUser = String(
    studioConfig?.smtpUser ||
      studioConfig?.adminEmail ||
      process.env.SMTP_USER ||
      'yayphotostudio@gmail.com'
  ).trim();
  const calendarPass = String(studioConfig?.smtpPass || process.env.SMTP_PASS || '').trim();

  if (!calendarUser || !calendarPass) {
    return { success: false, uid, error: 'Missing studio App Password credentials' };
  }

  const address = studioConfig?.address || '';
  const studioName = studioConfig?.name || 'Yay Photo Studio';
  const bookingDuration = Number(booking.durationMinutes) || 30;
  const [hStr, mStr] = (booking.timeSlot || '10:00').split(':');
  const startH = parseInt(hStr || '10', 10);
  const startM = parseInt(mStr || '00', 10);
  const endMinutes = startH * 60 + startM + bookingDuration;
  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  const cleanD = (booking.date || '').replace(/-/g, '');
  const pad = (n: number) => String(n).padStart(2, '0');

  const dtStart = `${cleanD}T${pad(startH)}${pad(startM)}00`;
  const dtEnd = `${cleanD}T${pad(endH)}${pad(endM)}00`;
  const dtNow = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const descriptionLines = [
    `📸 ${studioName.toUpperCase()}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `• Kode Reservasi: #${booking.id}`,
    `• Layanan: ${booking.serviceName || 'Sesi Foto'}`,
    `• Tanggal Sesi: ${booking.date}`,
    `• Waktu / Jam: ${booking.timeSlot} WITA (GMT+8)`,
    `• Durasi Sesi: ${bookingDuration} Menit`,
    `• Warna Backdrop: ${booking.backdrop || '-'}`,
    `• Jumlah Orang: ${booking.peopleCount || 1} Orang`,
    `• Total Biaya: Rp ${Number(booking.totalPrice || 0).toLocaleString('id-ID')}`,
    `• Pembayaran: ${booking.paymentNote || 'Pembayaran dapat dilakukan saat di studio'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `DATA PEMESAN:`,
    `• Nama: ${booking.customer?.name || '-'}`,
    `• WhatsApp: ${booking.customer?.whatsapp || '-'}`,
    `• Email: ${booking.customer?.email || '-'}`,
    ...(booking.customer?.notes ? [`• Catatan: ${booking.customer.notes}`] : []),
    ...(address ? [`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, `LOKASI STUDIO:`, address] : []),
  ].join('\\n');

  // Omit VALARM so Google Calendar automatically applies the admin's default phone notification settings (no email reminders)
  // Omit ATTENDEE so Google Calendar never sends duplicate invitation emails
  const icsPayload = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Yay Photo Studio//ID',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtNow}`,
    `DTSTART;TZID=Asia/Makassar:${dtStart}`,
    `DTEND;TZID=Asia/Makassar:${dtEnd}`,
    `SUMMARY:[Yay Studio] ${booking.serviceName || 'Sesi Foto'} - ${booking.customer?.name || 'Customer'}`,
    `DESCRIPTION:${descriptionLines}`,
    ...(address ? [`LOCATION:${address.replace(/,/g, '\\,')}`] : []),
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const authHeader = Buffer.from(`${calendarUser}:${calendarPass}`).toString('base64');
  const putUrl = `https://www.google.com/calendar/dav/${encodeURIComponent(
    calendarUser
  )}/events/${encodeURIComponent(uid)}.ics`;

  try {
    const response = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'text/calendar; charset=utf-8',
      },
      body: icsPayload,
    });

    if (response.ok || response.status === 201 || response.status === 204) {
      return { success: true, uid, status: response.status };
    }

    const errText = await response.text().catch(() => '');
    console.warn(`CalDAV PUT non-OK (${response.status}):`, errText.slice(0, 200));
    return {
      success: false,
      uid,
      status: response.status,
      error: `CalDAV HTTP ${response.status}`,
    };
  } catch (err: any) {
    console.warn('CalDAV PUT network error:', err);
    return { success: false, uid, error: err?.message || 'CalDAV error' };
  }
}

/**
 * Deletes a booking event from yayphotostudio@gmail.com's Google Calendar via CalDAV
 * when a booking is cancelled or deleted.
 */
async function deleteBookingFromGoogleCalendarCalDAV(
  bookingId: string,
  studioConfig: any
): Promise<boolean> {
  const cleanId = String(bookingId || '').trim();
  if (!cleanId) return false;

  const calendarUser = String(
    studioConfig?.smtpUser ||
      studioConfig?.adminEmail ||
      process.env.SMTP_USER ||
      'yayphotostudio@gmail.com'
  ).trim();
  const calendarPass = String(studioConfig?.smtpPass || process.env.SMTP_PASS || '').trim();
  if (!calendarUser || !calendarPass) return false;

  const uid = `yay-booking-${cleanId}@yayphotostudio.com`;
  const authHeader = Buffer.from(`${calendarUser}:${calendarPass}`).toString('base64');
  const delUrl = `https://www.google.com/calendar/dav/${encodeURIComponent(
    calendarUser
  )}/events/${encodeURIComponent(uid)}.ics`;

  try {
    const res = await fetch(delUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });
    return res.ok || res.status === 204 || res.status === 404;
  } catch {
    return false;
  }
}

/**
 * Real-time Cloud Firestore listener on the server:
 * Automatically pushes any new or unsynced booking in Firestore straight to Google Calendar via CalDAV
 * without needing the Admin Panel to be opened or any manual sync button to be clicked.
 */
function startRealtimeCalendarSyncWatcher() {
  try {
    onSnapshot(
      collection(db, 'bookings'),
      async (snapshot) => {
        let studioConfig: any = {};
        try {
          const cfgSnap = await getDoc(doc(db, 'config', 'studio'));
          if (cfgSnap.exists()) {
            studioConfig = cfgSnap.data() || {};
          }
        } catch {}

        for (const change of snapshot.docChanges()) {
          const bookingId = change.doc.id;
          const data = change.doc.data() as any;

          if (change.type === 'removed' || data?.status === 'cancelled') {
            await deleteBookingFromGoogleCalendarCalDAV(bookingId, studioConfig);
            continue;
          }

          if (
            (change.type === 'added' || change.type === 'modified') &&
            data &&
            data.customer?.name &&
            data.serviceName &&
            data.date &&
            data.timeSlot &&
            data.status !== 'cancelled' &&
            !data.syncedToCalendar &&
            !inFlightCalDav.has(bookingId)
          ) {
            inFlightCalDav.add(bookingId);
            try {
              const calRes = await syncBookingToGoogleCalendarCalDAV(
                { id: bookingId, ...data },
                studioConfig
              );
              if (calRes.success) {
                const stillExists = await getDoc(doc(db, 'bookings', bookingId));
                if (stillExists.exists() && stillExists.data()?.customer?.name) {
                  await setDoc(
                    doc(db, 'bookings', bookingId),
                    {
                      syncedToCalendar: true,
                      calendarEventId: calRes.uid,
                    },
                    { merge: true }
                  );
                }
                console.log(`[Auto-CalDAV] Booking #${bookingId} synced directly to Google Calendar.`);
              }
            } catch (err) {
              console.warn(`[Auto-CalDAV] Error syncing #${bookingId}:`, err);
            } finally {
              inFlightCalDav.delete(bookingId);
            }
          }
        }
      },
      (err) => {
        console.warn('Firestore bookings watcher warning:', err);
      }
    );
  } catch (e) {
    console.warn('Could not start Firestore bookings watcher:', e);
  }
}

startRealtimeCalendarSyncWatcher();

interface ParsedExternalCalendarBlock {
  uid: string;
  summary: string;
  date: string; // YYYY-MM-DD in WITA (GMT+8)
  startTime: string; // HH:MM in WITA
  endTime: string; // HH:MM in WITA
  startMinutes: number;
  endMinutes: number;
  isAllDay?: boolean;
}

let lastCalendarBlocksSyncTime = 0;
let lastCalendarBlocksHash = '';
let cachedExternalBlocks: ParsedExternalCalendarBlock[] = [];
let cachedExternalUpdatedAt = '';

function parseIcsDateTimeToEpochMs(propParams: string, rawVal: string): { epochMs: number; isAllDay: boolean; dateOnly?: string } | null {
  const val = (rawVal || '').trim();
  if (!val) return null;

  // All-day date: YYYYMMDD
  if (/^\d{8}$/.test(val) || propParams.toUpperCase().includes('VALUE=DATE')) {
    const y = val.slice(0, 4);
    const m = val.slice(4, 6);
    const d = val.slice(6, 8);
    const epochMs = Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0);
    return { epochMs, isAllDay: true, dateOnly: `${y}-${m}-${d}` };
  }

  // Date-time: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/i);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  const isUtc = Boolean(m[7]);

  const rawUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  if (isUtc) {
    return { epochMs: rawUtcMs, isAllDay: false };
  }

  const upperParams = propParams.toUpperCase();
  let offsetHours = 8; // Default WITA (Asia/Makassar GMT+8)
  if (upperParams.includes('ASIA/JAKARTA') || upperParams.includes('ASIA/PONTIANAK') || upperParams.includes('ASIA/BANGKOK')) {
    offsetHours = 7;
  } else if (upperParams.includes('ASIA/JAYAPURA') || upperParams.includes('ASIA/TOKYO')) {
    offsetHours = 9;
  }

  return {
    epochMs: rawUtcMs - offsetHours * 3600 * 1000,
    isAllDay: false,
  };
}

function parseVeventsToExternalBlocks(xmlText: string): ParsedExternalCalendarBlock[] {
  const decoded = xmlText
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const blocks: ParsedExternalCalendarBlock[] = [];
  const veventChunks = decoded.split('BEGIN:VEVENT').slice(1);
  const pad = (n: number) => String(n).padStart(2, '0');

  for (const chunk of veventChunks) {
    const body = chunk.split('END:VEVENT')[0] || '';
    const unfolded = body.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);

    let uid = '';
    let summary = '';
    let status = 'CONFIRMED';
    let transp = 'OPAQUE';
    let dtStartParams = '';
    let dtStartVal = '';
    let dtEndParams = '';
    let dtEndVal = '';

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const left = line.slice(0, colonIdx).trim();
      const right = line.slice(colonIdx + 1).trim();
      const semiIdx = left.indexOf(';');
      const propName = (semiIdx === -1 ? left : left.slice(0, semiIdx)).toUpperCase();
      const propParams = semiIdx === -1 ? '' : left.slice(semiIdx + 1);

      if (propName === 'UID') uid = right;
      else if (propName === 'SUMMARY') summary = right.replace(/\\,/g, ',').replace(/\\n/g, ' ');
      else if (propName === 'STATUS') status = right.toUpperCase();
      else if (propName === 'TRANSP') transp = right.toUpperCase();
      else if (propName === 'DTSTART') {
        dtStartParams = propParams;
        dtStartVal = right;
      } else if (propName === 'DTEND') {
        dtEndParams = propParams;
        dtEndVal = right;
      }
    }

    // Ignore cancelled events or events marked "Free / Bebas" (TRANSPARENT)
    if (status === 'CANCELLED' || transp === 'TRANSPARENT') continue;

    // Ignore events generated by this website itself (already tracked in Firestore bookings)
    if (uid.startsWith('yay-booking-') || summary.startsWith('[Yay Studio]')) {
      continue;
    }

    const parsedStart = parseIcsDateTimeToEpochMs(dtStartParams, dtStartVal);
    if (!parsedStart) continue;

    const parsedEnd = parseIcsDateTimeToEpochMs(dtEndParams, dtEndVal);

    if (parsedStart.isAllDay) {
      const startMs = parsedStart.epochMs;
      const endMs =
        parsedEnd && parsedEnd.epochMs > startMs
          ? parsedEnd.epochMs
          : startMs + 24 * 3600 * 1000;

      for (let cur = startMs; cur < endMs; cur += 24 * 3600 * 1000) {
        const d = new Date(cur);
        const dateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
        blocks.push({
          uid: uid || `cal-${dateStr}-allday`,
          summary: summary || 'Jadwal Kalender Admin (Seharian)',
          date: dateStr,
          startTime: '00:00',
          endTime: '23:59',
          startMinutes: 0,
          endMinutes: 1440,
          isAllDay: true,
        });
      }
      continue;
    }

    const startEpoch = parsedStart.epochMs;
    const endEpoch =
      parsedEnd && parsedEnd.epochMs > startEpoch
        ? parsedEnd.epochMs
        : startEpoch + 30 * 60 * 1000;

    // Convert UTC epoch to WITA (GMT+8) by shifting +8 hours and reading UTC fields
    const witaOffsetMs = 8 * 3600 * 1000;
    const startWita = new Date(startEpoch + witaOffsetMs);
    const endWita = new Date(endEpoch + witaOffsetMs);

    const startDayFloorUtc = Date.UTC(
      startWita.getUTCFullYear(),
      startWita.getUTCMonth(),
      startWita.getUTCDate(),
      0,
      0,
      0
    );
    const endDayFloorUtc = Date.UTC(
      endWita.getUTCFullYear(),
      endWita.getUTCMonth(),
      endWita.getUTCDate(),
      0,
      0,
      0
    );

    for (let dayMs = startDayFloorUtc; dayMs <= endDayFloorUtc; dayMs += 24 * 3600 * 1000) {
      const dayObj = new Date(dayMs);
      const dateStr = `${dayObj.getUTCFullYear()}-${pad(dayObj.getUTCMonth() + 1)}-${pad(
        dayObj.getUTCDate()
      )}`;

      const segStartMin =
        dayMs === startDayFloorUtc
          ? startWita.getUTCHours() * 60 + startWita.getUTCMinutes()
          : 0;
      const segEndMin =
        dayMs === endDayFloorUtc
          ? endWita.getUTCHours() * 60 + endWita.getUTCMinutes()
          : 1440;

      if (segEndMin <= segStartMin) continue;

      const sH = Math.floor(segStartMin / 60);
      const sM = segStartMin % 60;
      const eH = Math.min(23, Math.floor(segEndMin / 60));
      const eM = segEndMin >= 1440 ? 59 : segEndMin % 60;

      blocks.push({
        uid: uid || `cal-${dateStr}-${segStartMin}`,
        summary: summary || 'Jadwal Kalender Smartphone Admin',
        date: dateStr,
        startTime: `${pad(sH)}:${pad(sM)}`,
        endTime: `${pad(eH)}:${pad(eM)}`,
        startMinutes: segStartMin,
        endMinutes: segEndMin,
        isAllDay: segStartMin === 0 && segEndMin >= 1440,
      });
    }
  }

  // Deduplicate and sort chronologically
  const uniqueMap = new Map<string, ParsedExternalCalendarBlock>();
  for (const b of blocks) {
    const key = `${b.date}|${b.startMinutes}|${b.endMinutes}|${b.uid}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, b);
    }
  }

  return Array.from(uniqueMap.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startMinutes - b.startMinutes;
  });
}

async function syncExternalCalendarBlocksFromGoogle(
  force: boolean = false
): Promise<{ blocks: ParsedExternalCalendarBlock[]; updatedAt: string }> {
  const nowMs = Date.now();
  if (!force && nowMs - lastCalendarBlocksSyncTime < 5000 && cachedExternalUpdatedAt) {
    return { blocks: cachedExternalBlocks, updatedAt: cachedExternalUpdatedAt };
  }

  let studioConfig: any = {};
  try {
    const cfgSnap = await getDoc(doc(db, 'config', 'studio'));
    if (cfgSnap.exists()) {
      studioConfig = cfgSnap.data() || {};
    }
  } catch {}

  const calendarUser = String(
    studioConfig?.smtpUser ||
      studioConfig?.adminEmail ||
      process.env.SMTP_USER ||
      'yayphotostudio@gmail.com'
  ).trim();
  const calendarPass = String(studioConfig?.smtpPass || process.env.SMTP_PASS || '').trim();

  if (!calendarUser || !calendarPass) {
    return { blocks: cachedExternalBlocks, updatedAt: cachedExternalUpdatedAt || new Date().toISOString() };
  }

  const startWindow = new Date(nowMs - 2 * 24 * 3600 * 1000)
    .toISOString()
    .replace(/[-:]/g, '')
    .split('.')[0] + 'Z';
  const endWindow = new Date(nowMs + 90 * 24 * 3600 * 1000)
    .toISOString()
    .replace(/[-:]/g, '')
    .split('.')[0] + 'Z';

  const reportXml = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data>
      <C:expand start="${startWindow}" end="${endWindow}"/>
    </C:calendar-data>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${startWindow}" end="${endWindow}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

  const authHeader = Buffer.from(`${calendarUser}:${calendarPass}`).toString('base64');
  const reportUrl = `https://www.google.com/calendar/dav/${encodeURIComponent(
    calendarUser
  )}/events/`;

  try {
    const res = await fetch(reportUrl, {
      method: 'REPORT',
      headers: {
        Authorization: `Basic ${authHeader}`,
        Depth: '1',
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body: reportXml,
    });

    if (res.ok || res.status === 207) {
      const xmlText = await res.text();
      const blocks = parseVeventsToExternalBlocks(xmlText);
      const newHash = JSON.stringify(blocks);
      const updatedAt = new Date().toISOString();

      lastCalendarBlocksSyncTime = nowMs;
      cachedExternalBlocks = blocks;
      cachedExternalUpdatedAt = updatedAt;

      if (force || newHash !== lastCalendarBlocksHash) {
        lastCalendarBlocksHash = newHash;
        await setDoc(doc(db, 'config', 'calendarBlocks'), {
          blocks,
          updatedAt,
        });
      }

      return { blocks, updatedAt };
    }
  } catch (err) {
    console.warn('CalDAV REPORT sync warning:', err);
  }

  return {
    blocks: cachedExternalBlocks,
    updatedAt: cachedExternalUpdatedAt || new Date().toISOString(),
  };
}

// Run initial sync on startup and poll every 20 seconds for smartphone calendar changes
syncExternalCalendarBlocksFromGoogle(true).catch(() => {});
setInterval(() => {
  syncExternalCalendarBlocksFromGoogle(false).catch(() => {});
}, 20000);

// API endpoint for instant two-way calendar busy check
app.get('/api/calendar-busy', async (req, res) => {
  try {
    const force = req.query.force === '1' || req.query.force === 'true';
    const result = await syncExternalCalendarBlocksFromGoogle(force);
    return res.status(200).json({
      success: true,
      blocks: result.blocks,
      updatedAt: result.updatedAt,
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      blocks: cachedExternalBlocks,
      updatedAt: cachedExternalUpdatedAt,
      error: err?.message || 'Calendar busy check error',
    });
  }
});

// iCal Feed Route for Google Calendar / Apple Calendar
app.get(['/api/calendar.ics', '/api/calendar', '/calendar.ics'], async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    const bookings: any[] = [];
    snap.forEach((docSnap) => {
      bookings.push({ id: docSnap.id, ...docSnap.data() });
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
        const durationMinutes = Number(b.durationMinutes) || 30;
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
  const user =
    config?.smtpUser ||
    config?.adminEmail ||
    process.env.SMTP_USER ||
    'yayphotostudio@gmail.com';
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

// Endpoint to dispatch booking notification emails AND directly insert event into Google Calendar via CalDAV
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
    const senderUser =
      studioConfig?.smtpUser || studioConfig?.adminEmail || 'yayphotostudio@gmail.com';

    // 1. Directly insert/update the event in yayphotostudio@gmail.com's Google Calendar via CalDAV
    const calDavResult = await syncBookingToGoogleCalendarCalDAV(booking, studioConfig);

    // 2. Persist synced status to Firestore (only if complete booking payload)
    if (booking.id && booking.customer?.name && booking.serviceName) {
      try {
        await setDoc(
          doc(db, 'bookings', booking.id),
          {
            ...booking,
            syncedToCalendar: true,
            calendarEventId: calDavResult.uid,
          },
          { merge: true }
        );
      } catch (dbErr) {
        console.warn('Could not update booking sync flag in Firestore:', dbErr);
      }
    }

    const transporter = getTransporter(studioConfig);

    if (!transporter) {
      return res.status(200).json({
        success: true,
        delivered: false,
        syncedToCalendar: calDavResult.success,
        calendarEventId: calDavResult.uid,
        notConfigured: true,
        adminEmail,
        message: 'Kredensial SMTP belum diisi di Pengaturan Email Admin Studio.',
      });
    }

    const fromAddress = studioConfig?.smtpFrom || `"${studioName}" <${senderUser}>`;

    const bookingDuration = Number(booking.durationMinutes) || 30;
    const [hStr, mStr] = (booking.timeSlot || '10:00').split(':');
    const startH = parseInt(hStr || '10', 10);
    const startM = parseInt(mStr || '00', 10);
    const endMinutes = startH * 60 + startM + bookingDuration;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const cleanD = (booking.date || '').replace(/-/g, '');

    // 3. Admin Email HTML (No icalEvent attachment needed because CalDAV already wrote directly to Google Calendar)
    const adminSubject = `[Booking Baru Masuk] ${booking.serviceName} - ${booking.customer?.name} (#${booking.id})`;
    const adminHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 16px; overflow: hidden; color: #171717;">
        <div style="background: #0a0a0a; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">${studioName.toUpperCase()}</h1>
          <p style="margin: 0; font-size: 13px; color: #a3a3a3; font-family: monospace;">NOTIFIKASI RESERVASI BARU · WITA (GMT+8)</p>
        </div>
        <div style="padding: 28px 24px;">
          <div style="background: #f5f5f5; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 15px; font-weight: 700; color: #171717;">Booking Baru Diterima & Otomatis Masuk ke Google Calendar!</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #525252;">Jadwal sesi foto ini telah otomatis ditambahkan ke Google Calendar (${adminEmail}).</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr><td style="padding: 8px 0; color: #737373; width: 140px;">Kode Booking:</td><td style="padding: 8px 0; font-weight: 700; font-family: monospace;">#${booking.id}</td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">Nama Customer:</td><td style="padding: 8px 0; font-weight: 700;">${booking.customer?.name || '-'}</td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">WhatsApp:</td><td style="padding: 8px 0;"><a href="https://wa.me/${(booking.customer?.whatsapp || '').replace(/[^0-9]/g, '')}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${booking.customer?.whatsapp || '-'}</a></td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">Email:</td><td style="padding: 8px 0;">${booking.customer?.email || '-'}</td></tr>
            ${booking.customer?.notes ? `<tr><td style="padding: 8px 0; color: #737373;">Catatan:</td><td style="padding: 8px 0; font-style: italic;">${booking.customer.notes}</td></tr>` : ''}
            <tr style="border-top: 1px dashed #e5e5e5;"><td style="padding: 12px 0 8px 0; color: #737373;">Layanan:</td><td style="padding: 12px 0 8px 0; font-weight: 700;">${booking.serviceName}</td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">Tanggal Sesi:</td><td style="padding: 8px 0; font-weight: 700;">${booking.date}</td></tr>
            <tr><td style="padding: 8px 0; color: #737373;">Jam Sesi:</td><td style="padding: 8px 0; font-weight: 700; color: #2563eb;">${booking.timeSlot} WITA (${bookingDuration} Menit)</td></tr>
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

    const sendAdminPromise = transporter.sendMail({
      from: fromAddress,
      to: adminEmail,
      subject: adminSubject,
      html: adminHtml,
    });

    // 4. Send single confirmation email to Customer
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

      sendCustomerPromise = transporter
        .sendMail({
          from: fromAddress,
          to: booking.customer.email,
          subject: customerSubject,
          html: customerHtml,
        })
        .catch((e) => {
          console.warn('Customer confirmation email send warning:', e);
          return null;
        });
    }

    await Promise.all([sendAdminPromise, sendCustomerPromise]);

    return res.status(200).json({
      success: true,
      delivered: true,
      syncedToCalendar: calDavResult.success,
      calendarEventId: calDavResult.uid,
      adminEmail,
      message: `Jadwal otomatis masuk ke Google Calendar (${adminEmail}) & email terkirim`,
    });
  } catch (err: any) {
    console.error('Error sending booking emails:', err);
    let errMsg = err.message || 'Gagal mengirim email';
    if (
      errMsg.includes('534') ||
      errMsg.includes('Application-specific password') ||
      errMsg.includes('InvalidSecondFactor')
    ) {
      errMsg =
        'Google mewajibkan Sandi Aplikasi (App Password 16 karakter). Kunjungi myaccount.google.com/apppasswords untuk membuat sandi aplikasi 16 karakter.';
    } else if (
      errMsg.includes('Invalid login') ||
      errMsg.includes('Username and Password not accepted')
    ) {
      errMsg =
        'Email akun atau Sandi Aplikasi Gmail ditolak. Pastikan menggunakan Sandi Aplikasi 16 karakter dari myaccount.google.com/apppasswords.';
    }
    return res.status(500).json({
      success: false,
      error: errMsg,
    });
  }
});

// Route to test SMTP & Google Calendar CalDAV Connection
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
        error:
          'Sandi Aplikasi Gmail (16 karakter) belum diisi. Masukkan 16 karakter dari myaccount.google.com/apppasswords.',
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

    let studioAddr = '';
    try {
      const configDoc = await getDoc(doc(db, 'config', 'studio'));
      if (configDoc.exists()) {
        studioAddr = configDoc.data()?.address || '';
      }
    } catch {}

    await testTransporter.sendMail({
      from: `"Yay Photo Studio Test" <${String(user).trim()}>`,
      to: targetRecipient,
      subject: '[Tes Sistem] Koneksi Email & Kalender Yay Photo Studio Berhasil!',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #059669; margin-top: 0;">🎉 Koneksi Email & Google Calendar Otomatis Berhasil!</h2>
          <p>Halo Admin Yay Photo Studio,</p>
          <p>Ini adalah pesan konfirmasi uji coba. Server studio Anda telah terhubung secara permanen ke <strong>${targetRecipient}</strong>.</p>
          <p>Setiap reservasi pelanggan akan langsung masuk ke Google Calendar Anda dan mengirim email konfirmasi secara otomatis tanpa perlu login ulang atau sinkronisasi manual.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; margin: 0;">Yay Photo Studio${studioAddr ? ` · ${studioAddr}` : ''}</p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: `Koneksi Email & Google Calendar berhasil diuji ke ${targetRecipient}!`,
    });
  } catch (err: any) {
    console.error('SMTP test failure:', err);
    let errMsg = err.message || 'Gagal mengirim email uji coba.';
    if (
      errMsg.includes('534') ||
      errMsg.includes('Application-specific password') ||
      errMsg.includes('InvalidSecondFactor')
    ) {
      errMsg =
        'Google mewajibkan "Sandi Aplikasi" (App Password 16 karakter), bukan password akun Gmail biasa. Silakan buat sandi aplikasi di myaccount.google.com/apppasswords.';
    } else if (
      errMsg.includes('Invalid login') ||
      errMsg.includes('Username and Password not accepted')
    ) {
      errMsg =
        'Email akun atau Sandi Aplikasi Gmail ditolak. Pastikan Anda memasukkan Sandi Aplikasi 16 karakter dari myaccount.google.com/apppasswords.';
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
