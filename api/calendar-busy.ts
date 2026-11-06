import type { Request, Response } from 'express';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

interface ParsedExternalCalendarBlock {
  uid: string;
  summary: string;
  date: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  isAllDay?: boolean;
}

function parseIcsDateTimeToEpochMs(
  propParams: string,
  rawVal: string
): { epochMs: number; isAllDay: boolean; dateOnly?: string } | null {
  const val = (rawVal || '').trim();
  if (!val) return null;

  if (/^\d{8}$/.test(val) || propParams.toUpperCase().includes('VALUE=DATE')) {
    const y = val.slice(0, 4);
    const m = val.slice(4, 6);
    const d = val.slice(6, 8);
    const epochMs = Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0);
    return { epochMs, isAllDay: true, dateOnly: `${y}-${m}-${d}` };
  }

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
  if (
    upperParams.includes('ASIA/JAKARTA') ||
    upperParams.includes('ASIA/PONTIANAK') ||
    upperParams.includes('ASIA/BANGKOK')
  ) {
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

    if (status === 'CANCELLED' || transp === 'TRANSPARENT') continue;
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

export default async function handler(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
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
      return res.status(200).json({
        success: false,
        blocks: [],
        error: 'Missing studio App Password credentials',
      });
    }

    const nowMs = Date.now();
    const startWindow =
      new Date(nowMs - 2 * 24 * 3600 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] +
      'Z';
    const endWindow =
      new Date(nowMs + 90 * 24 * 3600 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] +
      'Z';

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

    const calRes = await fetch(reportUrl, {
      method: 'REPORT',
      headers: {
        Authorization: `Basic ${authHeader}`,
        Depth: '1',
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body: reportXml,
    });

    if (calRes.ok || calRes.status === 207) {
      const xmlText = await calRes.text();
      const blocks = parseVeventsToExternalBlocks(xmlText);
      const updatedAt = new Date().toISOString();

      try {
        await setDoc(doc(db, 'config', 'calendarBlocks'), {
          blocks,
          updatedAt,
        });
      } catch {}

      return res.status(200).json({
        success: true,
        blocks,
        updatedAt,
      });
    }

    return res.status(200).json({
      success: false,
      blocks: [],
      error: `CalDAV HTTP ${calRes.status}`,
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      blocks: [],
      error: err?.message || 'CalDAV error',
    });
  }
}
