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
import { Service, StudioConfig, Booking } from '../types';
import { getStoredServices, getStoredStudioConfig, getStoredBookings } from './storage';
import { SERVICES } from '../data/studioData';

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
          onConfigUpdate(data);
          try {
            localStorage.setItem('yay_studio_config_v3', JSON.stringify(data));
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
