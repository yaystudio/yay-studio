import { Booking, BlockedSlot, BookingStatus, Service, StudioConfig } from '../types';
import { INITIAL_BOOKINGS, SERVICES, STUDIO_CONFIG, BACKDROP_OPTIONS } from '../data/studioData';

const BOOKINGS_KEY = 'yay_studio_bookings_v3';
const BLOCKED_SLOTS_KEY = 'yay_studio_blocked_slots_v3';
const SERVICES_DATA_KEY = 'yay_studio_services_v3';
const STUDIO_CONFIG_KEY = 'yay_studio_config_v3';

export function getStoredServices(): Service[] {
  try {
    const raw = localStorage.getItem(SERVICES_DATA_KEY);
    if (!raw) {
      localStorage.setItem(SERVICES_DATA_KEY, JSON.stringify(SERVICES));
      return SERVICES;
    }
    const parsed: Service[] = JSON.parse(raw);
    // Ensure all services have personPricing and backdrops merged if missing from older storage versions
    const merged = parsed.map((svc) => {
      const defaultSvc = SERVICES.find((s) => s.id === svc.id);
      const updatedSvc = { ...svc };
      if (!updatedSvc.personPricing && defaultSvc?.personPricing) {
        updatedSvc.personPricing = { ...defaultSvc.personPricing };
      }
      if (!updatedSvc.backdrops || updatedSvc.backdrops.length === 0) {
        updatedSvc.backdrops = defaultSvc?.backdrops ? [...defaultSvc.backdrops] : [...BACKDROP_OPTIONS];
      }
      return updatedSvc;
    });

    // Ensure all default services (including Photo by Photographer) exist
    for (const defSvc of SERVICES) {
      if (!merged.some((s) => s.id === defSvc.id)) {
        merged.push({ ...defSvc });
      }
    }

    // Sort to maintain canonical order: self-photo-reguler, profile-self-photo, photo-by-photographer
    const orderMap: Record<string, number> = {
      'self-photo-reguler': 0,
      'profile-self-photo': 1,
      'photo-by-photographer': 2,
    };
    merged.sort((a, b) => (orderMap[a.id] ?? 99) - (orderMap[b.id] ?? 99));

    try {
      localStorage.setItem(SERVICES_DATA_KEY, JSON.stringify(merged));
    } catch {}

    return merged;
  } catch (e) {
    console.error('Failed to load services from localStorage', e);
    return SERVICES;
  }
}

/**
 * Calculates total price for a given number of people based on admin custom person pricing tiers
 */
export function calculateServicePrice(service: Service, peopleCount: number): number {
  const count = Math.max(1, peopleCount);
  if (service.personPricing && service.personPricing[count] !== undefined) {
    return service.personPricing[count];
  }
  
  if (service.personPricing && Object.keys(service.personPricing).length > 0) {
    const tiers = Object.keys(service.personPricing).map(Number).sort((a, b) => a - b);
    const maxTier = tiers[tiers.length - 1];
    if (count > maxTier) {
      const maxPrice = service.personPricing[maxTier];
      const extraRate = service.extraPersonPrice || 30000;
      return maxPrice + (count - maxTier) * extraRate;
    }
    // If lower than lowest tier, return lowest tier
    const minTier = tiers[0];
    if (count < minTier) {
      return service.personPricing[minTier];
    }
  }

  // Fallback if no personPricing is configured
  const extraCount = Math.max(0, count - service.maxPeople);
  return service.price + extraCount * (service.extraPersonPrice || 30000);
}

export function updateService(updatedService: Service): Service[] {
  const current = getStoredServices();
  const next = current.map((s) => (s.id === updatedService.id ? updatedService : s));
  localStorage.setItem(SERVICES_DATA_KEY, JSON.stringify(next));
  return next;
}

export function updateServiceImage(serviceId: string, imageUrl: string): Service[] {
  const current = getStoredServices();
  const next = current.map((s) => (s.id === serviceId ? { ...s, image: imageUrl } : s));
  localStorage.setItem(SERVICES_DATA_KEY, JSON.stringify(next));
  return next;
}

export function getStoredStudioConfig(): StudioConfig {
  try {
    const raw = localStorage.getItem(STUDIO_CONFIG_KEY);
    if (!raw) {
      localStorage.setItem(STUDIO_CONFIG_KEY, JSON.stringify(STUDIO_CONFIG));
      return STUDIO_CONFIG;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load studio config', e);
    return STUDIO_CONFIG;
  }
}

export function updateStudioConfig(newConfig: StudioConfig): StudioConfig {
  localStorage.setItem(STUDIO_CONFIG_KEY, JSON.stringify(newConfig));
  return newConfig;
}

export function resetServicesAndConfig(): { services: Service[]; config: StudioConfig } {
  localStorage.setItem(SERVICES_DATA_KEY, JSON.stringify(SERVICES));
  localStorage.setItem(STUDIO_CONFIG_KEY, JSON.stringify(STUDIO_CONFIG));
  return { services: SERVICES, config: STUDIO_CONFIG };
}

export function getStoredBookings(): Booking[] {
  try {
    const raw = localStorage.getItem(BOOKINGS_KEY);
    if (!raw) {
      localStorage.setItem(BOOKINGS_KEY, JSON.stringify(INITIAL_BOOKINGS));
      return INITIAL_BOOKINGS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load bookings from localStorage', e);
    return INITIAL_BOOKINGS;
  }
}

export function saveBooking(booking: Booking): Booking[] {
  const current = getStoredBookings();
  const updated = [booking, ...current];
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated));
  return updated;
}

export function updateBookingStatus(id: string, status: BookingStatus): Booking[] {
  const current = getStoredBookings();
  const updated = current.map((b) => (b.id === id ? { ...b, status } : b));
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteBooking(id: string): Booking[] {
  const current = getStoredBookings();
  const updated = current.filter((b) => b.id !== id);
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated));
  return updated;
}

export function getStoredBlockedSlots(): BlockedSlot[] {
  try {
    const raw = localStorage.getItem(BLOCKED_SLOTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load blocked slots', e);
    return [];
  }
}

export function toggleBlockSlot(date: string, timeSlot: string): BlockedSlot[] {
  const current = getStoredBlockedSlots();
  const exists = current.some((s) => s.date === date && s.timeSlot === timeSlot);
  let updated: BlockedSlot[];
  if (exists) {
    updated = current.filter((s) => !(s.date === date && s.timeSlot === timeSlot));
  } else {
    updated = [...current, { date, timeSlot }];
  }
  localStorage.setItem(BLOCKED_SLOTS_KEY, JSON.stringify(updated));
  return updated;
}

export function isSlotAvailable(date: string, timeSlot: string): { available: boolean; reason?: 'booked' | 'blocked' } {
  const blockedSlots = getStoredBlockedSlots();
  if (blockedSlots.some((s) => s.date === date && s.timeSlot === timeSlot)) {
    return { available: false, reason: 'blocked' };
  }

  const bookings = getStoredBookings();
  const isBooked = bookings.some(
    (b) => b.date === date && b.timeSlot === timeSlot && b.status !== 'cancelled'
  );

  if (isBooked) {
    return { available: false, reason: 'booked' };
  }

  return { available: true };
}

export function getMakassarDateTime(): {
  todayDate: string;
  currentTimeStr: string;
  currentHour: number;
  currentMinute: number;
  currentMinutesTotal: number;
} {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const getVal = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const yyyy = getVal('year');
  const mm = getVal('month');
  const dd = getVal('day');
  let hh = parseInt(getVal('hour'), 10);
  if (hh === 24) hh = 0;
  const min = parseInt(getVal('minute'), 10);
  return {
    todayDate: `${yyyy}-${mm}-${dd}`,
    currentTimeStr: `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
    currentHour: hh,
    currentMinute: min,
    currentMinutesTotal: hh * 60 + min,
  };
}

export interface ServiceTimeSlot {
  time: string;
  period: string;
}

/**
 * Menghasilkan daftar slot jam sesi secara dinamis mengikuti durasi layanan (durationMinutes)
 * serta rentang jam buka & tutup studio.
 */
export function generateServiceTimeSlots(
  openTimeStr: string = '10:00',
  closeTimeStr: string = '21:30',
  durationMinutes: number = 30
): ServiceTimeSlot[] {
  const duration = Math.max(10, Number(durationMinutes) || 30);

  const [openH, openM] = (openTimeStr || '10:00').split(':').map(Number);
  const [closeH, closeM] = (closeTimeStr || '21:30').split(':').map(Number);

  const startTotalMinutes = (isNaN(openH) ? 10 : openH) * 60 + (isNaN(openM) ? 0 : openM);
  const endTotalMinutes = (isNaN(closeH) ? 21 : closeH) * 60 + (isNaN(closeM) ? 30 : closeM);

  const slots: ServiceTimeSlot[] = [];

  let current = startTotalMinutes;
  // Sesi harus selesai sebelum atau tepat pada jam tutup studio
  while (current + duration <= endTotalMinutes) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    let period = 'Pagi';
    if (h >= 12 && h < 15) period = 'Siang';
    else if (h >= 15 && h < 18) period = 'Sore';
    else if (h >= 18) period = 'Malam';

    slots.push({ time: timeStr, period });
    current += duration;
  }

  // Fallback bila rentang waktu tidak mencukupi satu kelipatan
  if (slots.length === 0 && startTotalMinutes < endTotalMinutes) {
    const h = Math.floor(startTotalMinutes / 60);
    const m = startTotalMinutes % 60;
    slots.push({
      time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      period: h >= 18 ? 'Malam' : h >= 15 ? 'Sore' : h >= 12 ? 'Siang' : 'Pagi',
    });
  }

  return slots;
}

/**
 * Mengambil slot yang tersedia untuk booking:
 * - Menghitung slot sesuai durasi layanan
 * - Menghilangkan jam yang sudah lewat pada hari ini (Waktu Makassar GMT+8)
 * - Menghilangkan jam yang sudah terisi/dipesan oleh pelanggan lain
 */
export function getAvailableSlotsForDate(
  service: Service | null | undefined,
  selectedDate: string
): ServiceTimeSlot[] {
  if (!service || !selectedDate) return [];

  const rawSlots = generateServiceTimeSlots(
    service.openTime || '10:00',
    service.closeTime || '21:30',
    service.durationMinutes || 30
  );

  const makassarNow = getMakassarDateTime();
  const bookings = getStoredBookings();
  const blockedSlots = getStoredBlockedSlots();

  return rawSlots.filter((slot) => {
    // 1. Jika tanggal sudah lewat kemarin, tidak ada slot
    if (selectedDate < makassarNow.todayDate) {
      return false;
    }

    // 2. Jika tanggal adalah HARI INI: jam yang kosong dan sudah lewat dihilangkan
    if (selectedDate === makassarNow.todayDate) {
      const [sH, sM] = slot.time.split(':').map(Number);
      const slotMinutes = (isNaN(sH) ? 0 : sH) * 60 + (isNaN(sM) ? 0 : sM);
      // Jika jam sesi sudah lewat dari waktu sekarang di Makassar, hilangkan dari pilihan
      if (slotMinutes <= makassarNow.currentMinutesTotal) {
        return false;
      }
    }

    // 3. Hilangkan slot yang sudah terisi (booked)
    const isBooked = bookings.some(
      (b) => b.date === selectedDate && b.timeSlot === slot.time && b.status !== 'cancelled'
    );
    if (isBooked) {
      return false;
    }

    // 4. Hilangkan slot yang diblokir (jika ada)
    const isBlocked = blockedSlots.some(
      (s) => s.date === selectedDate && s.timeSlot === slot.time
    );
    if (isBlocked) {
      return false;
    }

    return true;
  });
}

export function resetDemoData(): void {
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(INITIAL_BOOKINGS));
  localStorage.setItem(BLOCKED_SLOTS_KEY, JSON.stringify([]));
  localStorage.setItem(SERVICES_DATA_KEY, JSON.stringify(SERVICES));
  localStorage.setItem(STUDIO_CONFIG_KEY, JSON.stringify(STUDIO_CONFIG));
}

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export const TIMEZONE_ID = 'Asia/Makassar';
export const TIMEZONE_LABEL = 'WITA (GMT+8 · Makassar)';

export function formatTimeWITA(timeSlot: string): string {
  if (!timeSlot) return '';
  return timeSlot.includes('WITA') ? timeSlot : `${timeSlot} WITA`;
}

export function formatDateIndo(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Use UTC noon to prevent date shift across time zones
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: TIMEZONE_ID,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function generateBookingId(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `YAY-${day}${month}-${randomChars}`;
}

