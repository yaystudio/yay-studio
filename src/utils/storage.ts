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
  let found = false;
  const next = current.map((s) => {
    if (s.id === updatedService.id) {
      found = true;
      return updatedService;
    }
    return s;
  });
  if (!found) {
    next.push(updatedService);
  }
  try {
    localStorage.setItem(SERVICES_DATA_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('LocalStorage save warning:', e);
  }
  return next;
}

export function updateServiceImage(serviceId: string, imageUrl: string): Service[] {
  const current = getStoredServices();
  const next = current.map((s) => (s.id === serviceId ? { ...s, image: imageUrl } : s));
  try {
    localStorage.setItem(SERVICES_DATA_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('LocalStorage save warning:', e);
  }
  return next;
}

export function getStoredStudioConfig(): StudioConfig {
  try {
    const raw = localStorage.getItem(STUDIO_CONFIG_KEY);
    if (!raw) {
      localStorage.setItem(STUDIO_CONFIG_KEY, JSON.stringify(STUDIO_CONFIG));
      return STUDIO_CONFIG;
    }
    const parsed = JSON.parse(raw);
    const merged: StudioConfig = { ...STUDIO_CONFIG, ...parsed };
    // Clear legacy preset addresses so user has full control to set custom address from Admin Panel
    if (
      merged.address &&
      (merged.address.includes('Senopati') ||
        merged.address.includes('Jakarta') ||
        merged.address.includes('Pasar Segar') ||
        merged.address.includes('Pengayoman'))
    ) {
      merged.address = '';
      try {
        localStorage.setItem(STUDIO_CONFIG_KEY, JSON.stringify(merged));
      } catch {}
    }
    if (!merged.adminEmail) {
      merged.adminEmail = STUDIO_CONFIG.adminEmail;
    }
    return merged;
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

/**
 * Mengubah string format jam "HH:MM" (e.g. "10:00", "18:30 WITA") ke total menit dari 00:00
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Menghitung durasi sesi (dalam menit) dari suatu booking
 */
export function getBookingDurationMinutes(booking: Booking, services?: Service[]): number {
  if (booking.durationMinutes && booking.durationMinutes > 0) {
    return Number(booking.durationMinutes);
  }
  const allServices = services || getStoredServices();
  const matchedService = allServices.find(
    (s) => s.id === booking.serviceId || s.name.toLowerCase() === booking.serviceName?.toLowerCase()
  );
  if (matchedService && matchedService.durationMinutes) {
    return Number(matchedService.durationMinutes);
  }
  if (
    booking.serviceId === 'profile-self-photo' ||
    booking.serviceName?.toLowerCase().includes('profile')
  ) {
    return 40;
  }
  if (
    booking.serviceId === 'photo-by-photographer' ||
    booking.serviceName?.toLowerCase().includes('photographer')
  ) {
    return 60;
  }
  return 30; // default 30 menit untuk reguler self photo
}

/**
 * Mengecek apakah dua rentang waktu (interval) saling berbenturan / bertabrakan di studio fisik.
 * Dua interval bertabrakan jika slotStart < otherEnd && slotEnd > otherStart.
 */
export function isIntervalOverlapping(
  startA: number,
  durationA: number,
  startB: number,
  durationB: number
): boolean {
  const endA = startA + durationA;
  const endB = startB + durationB;
  return startA < endB && endA > startB;
}

/**
 * Mengecek apakah suatu slot jam tersedia dengan memperhitungkan durasi sesi
 * agar tidak bertabrakan dengan layanan lain yang sedang berlangsung di studio.
 */
export function isSlotAvailable(
  date: string,
  timeSlot: string,
  durationMinutes: number = 30
): { available: boolean; reason?: 'booked' | 'blocked' } {
  const slotStartMin = parseTimeToMinutes(timeSlot);
  const slotDuration = durationMinutes || 30;
  const slotEndMin = slotStartMin !== null ? slotStartMin + slotDuration : null;

  const blockedSlots = getStoredBlockedSlots();
  const isBlocked = blockedSlots.some((s) => {
    if (s.date !== date) return false;
    if (slotStartMin === null) return s.timeSlot === timeSlot;
    const blockStartMin = parseTimeToMinutes(s.timeSlot);
    if (blockStartMin === null) return s.timeSlot === timeSlot;
    const blockEndMin = blockStartMin + 30;
    return slotStartMin < blockEndMin && slotEndMin! > blockStartMin;
  });

  if (isBlocked) {
    return { available: false, reason: 'blocked' };
  }

  const bookings = getStoredBookings();
  const allServices = getStoredServices();

  const isBooked = bookings.some((b) => {
    if (b.date !== date || b.status === 'cancelled') return false;
    if (slotStartMin === null) return b.timeSlot === timeSlot;
    const bStartMin = parseTimeToMinutes(b.timeSlot);
    if (bStartMin === null) return b.timeSlot === timeSlot;
    const bDuration = getBookingDurationMinutes(b, allServices);
    const bEndMin = bStartMin + bDuration;

    return slotStartMin < bEndMin && slotEndMin! > bStartMin;
  });

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
 * - Menghitung slot sesuai durasi layanan yang dipilih
 * - Menghilangkan jam yang sudah lewat pada hari ini (Waktu Makassar GMT+8)
 * - Menghilangkan jam yang bertabrakan dengan durasi sesi booking manapun yang sudah ada di studio
 *   (misal: Profile Self Photo 40 menit dari 10:00 - 10:40 akan memblokir slot 10:00 & 10:30 untuk Reguler Self Photo)
 */
export function getAvailableSlotsForDate(
  service: Service | null | undefined,
  selectedDate: string
): ServiceTimeSlot[] {
  if (!service || !selectedDate) return [];

  const serviceDuration = Math.max(10, Number(service.durationMinutes) || 30);

  const rawSlots = generateServiceTimeSlots(
    service.openTime || '10:00',
    service.closeTime || '21:30',
    serviceDuration
  );

  const makassarNow = getMakassarDateTime();
  const bookings = getStoredBookings();
  const blockedSlots = getStoredBlockedSlots();
  const allServices = getStoredServices();

  return rawSlots.filter((slot) => {
    // 1. Jika tanggal sudah lewat kemarin, tidak ada slot
    if (selectedDate < makassarNow.todayDate) {
      return false;
    }

    const slotStartMin = parseTimeToMinutes(slot.time);
    if (slotStartMin === null) return false;
    const slotEndMin = slotStartMin + serviceDuration;

    // 2. Jika tanggal adalah HARI INI: jam yang kosong dan sudah lewat dihilangkan
    if (selectedDate === makassarNow.todayDate) {
      // Jika jam sesi sudah lewat dari waktu sekarang di Makassar, hilangkan dari pilihan
      if (slotStartMin <= makassarNow.currentMinutesTotal) {
        return false;
      }
    }

    // 3. Hilangkan slot yang bertabrakan dengan sesi foto yang sudah dibooking di studio (shared room)
    const isBooked = bookings.some((b) => {
      if (b.date !== selectedDate || b.status === 'cancelled') {
        return false;
      }
      const bStartMin = parseTimeToMinutes(b.timeSlot);
      if (bStartMin === null) {
        return b.timeSlot === slot.time;
      }
      const bDuration = getBookingDurationMinutes(b, allServices);
      const bEndMin = bStartMin + bDuration;

      // Benturan terjadi jika rentang waktu sesi yang dipilih bersinggungan dengan sesi yang sudah ada
      return slotStartMin < bEndMin && slotEndMin > bStartMin;
    });

    if (isBooked) {
      return false;
    }

    // 4. Hilangkan slot yang diblokir oleh admin
    const isBlocked = blockedSlots.some((s) => {
      if (s.date !== selectedDate) return false;
      const blockStartMin = parseTimeToMinutes(s.timeSlot);
      if (blockStartMin === null) {
        return s.timeSlot === slot.time;
      }
      const blockEndMin = blockStartMin + 30;
      return slotStartMin < blockEndMin && slotEndMin > blockStartMin;
    });

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

