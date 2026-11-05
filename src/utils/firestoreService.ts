import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Service, StudioConfig, Booking, TrafficStats } from '../types';
import { getStoredServices, getStoredStudioConfig, getStoredBookings, getMakassarDateTime } from './storage';
import { SERVICES, STUDIO_CONFIG } from '../data/studioData';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Recursively cleans an object for Firestore by removing any fields with `undefined` values.
 * Firestore setDoc/updateDoc throws an error if any property is `undefined`.
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return {} as T;
  }

  function deepClean(item: any): any {
    if (item === null || item === undefined) {
      return undefined;
    }
    if (Array.isArray(item)) {
      return item
        .map(deepClean)
        .filter((val) => val !== undefined);
    }
    if (typeof item === 'object') {
      const res: Record<string, any> = {};
      for (const [k, v] of Object.entries(item)) {
        const cleanedVal = deepClean(v);
        if (cleanedVal !== undefined) {
          res[k] = cleanedVal;
        }
      }
      return res;
    }
    return item;
  }

  const result = deepClean(data);
  try {
    return JSON.parse(JSON.stringify(result));
  } catch {
    return result;
  }
}

/**
 * Real-time subscription to services collection.
 * Automatically seeds Firestore if empty, ensuring all devices see custom data.
 */
export function subscribeToServices(
  onServicesUpdate: (services: Service[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'services';
  return onSnapshot(
    collection(db, path),
    async (snapshot) => {
      try {
        if (snapshot.empty) {
          // Seed from local/default services if collection is fresh
          const initial = getStoredServices();
          for (const svc of initial) {
            await setDoc(doc(db, 'services', svc.id), cleanForFirestore(svc));
          }
          onServicesUpdate(initial);
        } else {
          const loaded: Service[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as Service;
            const svcId = data.id || d.id;
            loaded.push({ ...data, id: svcId });
          });

          // Ensure all default services exist, especially Photo by Photographer
          for (const defSvc of SERVICES) {
            if (!loaded.some((s) => s.id === defSvc.id)) {
              loaded.push({ ...defSvc });
              // Persist missing service into Cloud Firestore
              setDoc(doc(db, 'services', defSvc.id), cleanForFirestore(defSvc)).catch((saveErr) => {
                console.warn('Could not auto-seed missing service to Firestore:', saveErr);
              });
            }
          }

          // Canonical order: self-photo-reguler, profile-self-photo, photo-by-photographer
          const orderMap: Record<string, number> = {
            'self-photo-reguler': 0,
            'profile-self-photo': 1,
            'photo-by-photographer': 2,
          };
          loaded.sort((a, b) => (orderMap[a.id] ?? 99) - (orderMap[b.id] ?? 99));

          onServicesUpdate(loaded);
          // Sync to localStorage as offline cache
          try {
            localStorage.setItem('yay_studio_services_v3', JSON.stringify(loaded));
          } catch {}
        }
      } catch (err) {
        if (onError) onError(err as Error);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Real-time subscription to studio config.
 */
export function subscribeToStudioConfig(
  onConfigUpdate: (config: StudioConfig) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'config/studio';
  const configDocRef = doc(db, 'config', 'studio');

  return onSnapshot(
    configDocRef,
    async (snapshot) => {
      try {
        if (!snapshot.exists()) {
          const initialConfig = getStoredStudioConfig();
          await setDoc(configDocRef, cleanForFirestore(initialConfig));
          onConfigUpdate(initialConfig);
        } else {
          const data = snapshot.data() as StudioConfig;
          const merged: StudioConfig = { ...STUDIO_CONFIG, ...data };
          // If legacy preset address was stored, clear it so user can define custom address in Admin Panel
          if (
            merged.address &&
            (merged.address.includes('Senopati') ||
              merged.address.includes('Jakarta') ||
              merged.address.includes('Pasar Segar') ||
              merged.address.includes('Pengayoman'))
          ) {
            merged.address = '';
            setDoc(configDocRef, cleanForFirestore(merged)).catch((e) => {
              console.warn('Failed to clear legacy address in Firestore:', e);
            });
          }
          if (!merged.adminEmail) {
            merged.adminEmail = STUDIO_CONFIG.adminEmail;
          }
          onConfigUpdate(merged);
          try {
            localStorage.setItem('yay_studio_config_v3', JSON.stringify(merged));
          } catch {}
        }
      } catch (err) {
        if (onError) onError(err as Error);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Real-time subscription to bookings collection.
 */
export function subscribeToBookings(
  onBookingsUpdate: (bookings: Booking[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'bookings';
  return onSnapshot(
    collection(db, path),
    async (snapshot) => {
      try {
        if (snapshot.empty) {
          const initialBookings = getStoredBookings();
          if (initialBookings.length > 0) {
            for (const b of initialBookings) {
              await setDoc(doc(db, 'bookings', b.id), cleanForFirestore(b));
            }
          }
          onBookingsUpdate(initialBookings);
        } else {
          const loaded: Booking[] = [];
          snapshot.forEach((d) => {
            loaded.push(d.data() as Booking);
          });
          // Sort newest first
          loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          onBookingsUpdate(loaded);
          try {
            localStorage.setItem('yay_studio_bookings_v3', JSON.stringify(loaded));
          } catch {}
        }
      } catch (err) {
        if (onError) onError(err as Error);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Persists a service directly to cloud Firestore and local cache
 */
export async function saveServiceToCloud(service: Service): Promise<void> {
  const path = `services/${service.id}`;
  try {
    const cleaned = cleanForFirestore(service);
    await setDoc(doc(db, 'services', service.id), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Persists studio configuration to cloud Firestore and local cache
 */
export async function saveStudioConfigToCloud(config: StudioConfig): Promise<void> {
  const path = 'config/studio';
  try {
    const cleaned = cleanForFirestore(config);
    await setDoc(doc(db, 'config', 'studio'), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Persists a booking directly to cloud Firestore
 */
export async function saveBookingToCloud(booking: Booking): Promise<void> {
  const path = `bookings/${booking.id}`;
  try {
    const cleaned = cleanForFirestore(booking);
    await setDoc(doc(db, 'bookings', booking.id), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Deletes a booking from cloud Firestore
 */
export async function deleteBookingFromCloud(bookingId: string): Promise<void> {
  const path = `bookings/${bookingId}`;
  try {
    await deleteDoc(doc(db, 'bookings', bookingId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

const TRAFFIC_LOCAL_KEY = 'yay_studio_traffic_v1';
const UNIQUE_VISITOR_PREFIX = 'yay_studio_unique_visitor_';
let lastVisitRecordedTimestamp = 0;

const MONTH_NAMES_INDO = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function formatMonthYearIndo(monthKey: string): string {
  const [y, m] = (monthKey || '').split('-');
  const monthIdx = parseInt(m || '1', 10) - 1;
  const monthName = MONTH_NAMES_INDO[monthIdx] || MONTH_NAMES_INDO[0];
  return `${monthName} ${y || new Date().getFullYear()}`;
}

export function getNextMonthResetIndo(monthKey: string): string {
  const [yStr, mStr] = (monthKey || '').split('-');
  let year = parseInt(yStr || String(new Date().getFullYear()), 10);
  let month = parseInt(mStr || '1', 10); // 1..12
  if (month >= 12) {
    month = 1;
    year += 1;
  } else {
    month += 1;
  }
  const monthName = MONTH_NAMES_INDO[month - 1] || 'Januari';
  return `1 ${monthName} ${year}, 00:00 WITA`;
}

export function getStoredTrafficStats(): TrafficStats {
  const { todayDate } = getMakassarDateTime();
  const currentMonth = todayDate.slice(0, 7);
  const nowIso = new Date().toISOString();

  const defaultStats: TrafficStats = {
    currentMonth,
    monthlyVisits: 1,
    uniqueVisitors: 1,
    todayDate,
    todayVisits: 1,
    lastResetAt: nowIso,
    lastVisitAt: nowIso,
    monthlyHistory: {},
  };

  if (typeof window === 'undefined') return defaultStats;

  try {
    const raw = localStorage.getItem(TRAFFIC_LOCAL_KEY);
    if (!raw) return defaultStats;
    const parsed = JSON.parse(raw) as TrafficStats;
    if (parsed.currentMonth !== currentMonth) {
      const history = { ...(parsed.monthlyHistory || {}) };
      if (parsed.currentMonth) {
        history[parsed.currentMonth] = {
          visits: Number(parsed.monthlyVisits || 0),
          uniqueVisitors: Number(parsed.uniqueVisitors || 0),
        };
      }
      return {
        currentMonth,
        monthlyVisits: 0,
        uniqueVisitors: 0,
        todayDate,
        todayVisits: 0,
        lastResetAt: nowIso,
        lastVisitAt: nowIso,
        monthlyHistory: history,
      };
    }
    if (parsed.todayDate !== todayDate) {
      return {
        ...parsed,
        todayDate,
        todayVisits: 0,
      };
    }
    return parsed;
  } catch {
    return defaultStats;
  }
}

/**
 * Records a page visit and automatically resets monthly counters when a new month starts (WITA).
 */
export async function recordPageVisit(): Promise<void> {
  // Prevent React StrictMode double invocation within 2 seconds
  if (Date.now() - lastVisitRecordedTimestamp < 2000) return;
  lastVisitRecordedTimestamp = Date.now();

  const { todayDate } = getMakassarDateTime();
  const currentMonth = todayDate.slice(0, 7); // YYYY-MM
  const nowIso = new Date().toISOString();

  const uniqueKey = `${UNIQUE_VISITOR_PREFIX}${currentMonth}`;
  let isNewUniqueVisitor = false;
  if (typeof window !== 'undefined') {
    if (!localStorage.getItem(uniqueKey)) {
      isNewUniqueVisitor = true;
      try {
        localStorage.setItem(uniqueKey, nowIso);
      } catch {}
    }
  }

  const trafficRef = doc(db, 'config', 'traffic');

  try {
    const snap = await getDoc(trafficRef);
    let updatedStats: TrafficStats;

    if (!snap.exists()) {
      updatedStats = {
        currentMonth,
        monthlyVisits: 1,
        uniqueVisitors: 1,
        todayDate,
        todayVisits: 1,
        lastResetAt: nowIso,
        lastVisitAt: nowIso,
        monthlyHistory: {},
      };
    } else {
      const data = snap.data() as TrafficStats;
      if (data.currentMonth !== currentMonth) {
        // New month started! Archive previous month and automatically reset monthly counters
        const history = { ...(data.monthlyHistory || {}) };
        if (data.currentMonth) {
          history[data.currentMonth] = {
            visits: Number(data.monthlyVisits || 0),
            uniqueVisitors: Number(data.uniqueVisitors || 0),
          };
        }
        updatedStats = {
          currentMonth,
          monthlyVisits: 1,
          uniqueVisitors: 1,
          todayDate,
          todayVisits: 1,
          lastResetAt: nowIso,
          lastVisitAt: nowIso,
          monthlyHistory: history,
        };
      } else {
        const isSameDay = data.todayDate === todayDate;
        const nextMonthlyVisits = Number(data.monthlyVisits || 0) + 1;
        const nextUniqueVisitors =
          Number(data.uniqueVisitors || 0) + (isNewUniqueVisitor ? 1 : 0);
        const nextTodayVisits = isSameDay ? Number(data.todayVisits || 0) + 1 : 1;

        updatedStats = {
          ...data,
          currentMonth,
          monthlyVisits: nextMonthlyVisits,
          uniqueVisitors: Math.max(1, nextUniqueVisitors),
          todayDate,
          todayVisits: nextTodayVisits,
          lastResetAt: data.lastResetAt || nowIso,
          lastVisitAt: nowIso,
        };
      }
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(TRAFFIC_LOCAL_KEY, JSON.stringify(updatedStats));
      } catch {}
    }

    await setDoc(trafficRef, cleanForFirestore(updatedStats));
  } catch (err) {
    console.warn('Traffic counter update note:', err);
  }
}

/**
 * Real-time subscription to monthly website traffic stats (`config/traffic`).
 * Automatically resets the counter if the month changes while open.
 */
export function subscribeToTrafficStats(
  onTrafficUpdate: (stats: TrafficStats) => void
): () => void {
  const trafficRef = doc(db, 'config', 'traffic');

  return onSnapshot(
    trafficRef,
    async (snapshot) => {
      const { todayDate } = getMakassarDateTime();
      const currentMonth = todayDate.slice(0, 7);
      const nowIso = new Date().toISOString();

      if (!snapshot.exists()) {
        const initial = getStoredTrafficStats();
        onTrafficUpdate(initial);
        return;
      }

      const data = snapshot.data() as TrafficStats;
      if (data.currentMonth !== currentMonth) {
        // Month rolled over! Automatically reset monthly counter
        const history = { ...(data.monthlyHistory || {}) };
        if (data.currentMonth) {
          history[data.currentMonth] = {
            visits: Number(data.monthlyVisits || 0),
            uniqueVisitors: Number(data.uniqueVisitors || 0),
          };
        }
        const resetData: TrafficStats = {
          currentMonth,
          monthlyVisits: 0,
          uniqueVisitors: 0,
          todayDate,
          todayVisits: 0,
          lastResetAt: nowIso,
          lastVisitAt: data.lastVisitAt || nowIso,
          monthlyHistory: history,
        };
        try {
          await setDoc(trafficRef, cleanForFirestore(resetData));
        } catch {}
        onTrafficUpdate(resetData);
      } else {
        const normalized: TrafficStats = {
          ...data,
          todayDate,
          todayVisits: data.todayDate === todayDate ? Number(data.todayVisits || 0) : 0,
        };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(TRAFFIC_LOCAL_KEY, JSON.stringify(normalized));
          } catch {}
        }
        onTrafficUpdate(normalized);
      }
    },
    (err) => {
      console.warn('Traffic subscription note:', err);
    }
  );
}

/**
 * Manually resets the current month's visitor traffic counter to 0.
 */
export async function resetCurrentMonthTraffic(): Promise<TrafficStats> {
  const { todayDate } = getMakassarDateTime();
  const currentMonth = todayDate.slice(0, 7);
  const nowIso = new Date().toISOString();
  const current = getStoredTrafficStats();

  const resetData: TrafficStats = {
    currentMonth,
    monthlyVisits: 0,
    uniqueVisitors: 0,
    todayDate,
    todayVisits: 0,
    lastResetAt: nowIso,
    lastVisitAt: nowIso,
    monthlyHistory: current.monthlyHistory || {},
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TRAFFIC_LOCAL_KEY, JSON.stringify(resetData));
      localStorage.removeItem(`${UNIQUE_VISITOR_PREFIX}${currentMonth}`);
    } catch {}
  }

  await setDoc(doc(db, 'config', 'traffic'), cleanForFirestore(resetData));
  return resetData;
}

