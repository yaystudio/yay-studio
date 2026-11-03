import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

const GCAL_ACCESS_TOKEN_KEY = 'yay_studio_gcal_access_token_v1';
const GCAL_TOKEN_EXPIRY_KEY = 'yay_studio_gcal_token_expiry_v1';
const GCAL_USER_EMAIL_KEY = 'yay_studio_gcal_user_email_v1';

// Clean up any legacy fake placeholder token immediately on module load
if (typeof window !== 'undefined') {
  const existing = localStorage.getItem(GCAL_ACCESS_TOKEN_KEY);
  if (existing === 'gcal_authenticated') {
    localStorage.removeItem(GCAL_ACCESS_TOKEN_KEY);
    localStorage.removeItem(GCAL_TOKEN_EXPIRY_KEY);
  }
}

let cachedAccessToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem(GCAL_ACCESS_TOKEN_KEY) : null;

export const getStoredGoogleUserEmail = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(GCAL_USER_EMAIL_KEY) || auth.currentUser?.email || null;
  }
  return auth.currentUser?.email || null;
};

export const isAdminBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!auth.currentUser || !!localStorage.getItem(GCAL_USER_EMAIL_KEY);
};

export const isCalendarTokenFresh = (): boolean => {
  if (typeof window === 'undefined') return false;
  const token = cachedAccessToken || localStorage.getItem(GCAL_ACCESS_TOKEN_KEY);
  if (!token || token === 'gcal_authenticated') return false;
  const expiryStr = localStorage.getItem(GCAL_TOKEN_EXPIRY_KEY);
  if (!expiryStr) return false;
  const expiry = parseInt(expiryStr, 10);
  return !isNaN(expiry) && Date.now() + 30000 < expiry;
};

export const isCalendarTokenValid = (): boolean => {
  return isCalendarTokenFresh();
};

export const getImmediateFreshAccessToken = (): string | null => {
  if (!isCalendarTokenFresh()) return null;
  const token =
    cachedAccessToken ||
    (typeof window !== 'undefined' ? localStorage.getItem(GCAL_ACCESS_TOKEN_KEY) : null);
  return token && token !== 'gcal_authenticated' ? token : null;
};

export const saveTokenEverywhere = (
  accessToken: string,
  expiryTimestamp: number,
  email?: string | null
) => {
  cachedAccessToken = accessToken;
  if (typeof window !== 'undefined') {
    localStorage.setItem(GCAL_ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(GCAL_TOKEN_EXPIRY_KEY, String(expiryTimestamp));
    if (email) {
      localStorage.setItem(GCAL_USER_EMAIL_KEY, email);
    }
  }
  // Persist to Cloud Firestore config/studio so server and other sessions can auto-sync bookings
  setDoc(
    doc(db, 'config', 'studio'),
    {
      googleAccessToken: accessToken,
      googleTokenExpiry: expiryTimestamp,
      ...(email ? { googleUserEmail: email } : {}),
    },
    { merge: true }
  ).catch((err) => {
    console.warn('Could not persist Google token to Firestore:', err);
  });
};

export const loadTokenFromCloud = async (): Promise<string | null> => {
  try {
    const snap = await getDoc(doc(db, 'config', 'studio'));
    if (snap.exists()) {
      const data = snap.data();
      const cloudToken = data?.googleAccessToken;
      const cloudExpiry = Number(data?.googleTokenExpiry || 0);
      const cloudEmail = data?.googleUserEmail;
      if (
        cloudToken &&
        cloudToken !== 'gcal_authenticated' &&
        cloudExpiry > Date.now() + 60000
      ) {
        cachedAccessToken = cloudToken;
        if (typeof window !== 'undefined') {
          localStorage.setItem(GCAL_ACCESS_TOKEN_KEY, cloudToken);
          localStorage.setItem(GCAL_TOKEN_EXPIRY_KEY, String(cloudExpiry));
          if (cloudEmail && !localStorage.getItem(GCAL_USER_EMAIL_KEY)) {
            localStorage.setItem(GCAL_USER_EMAIL_KEY, cloudEmail);
          }
        }
        return cloudToken;
      }
    }
  } catch (e) {
    console.warn('Cloud token check note:', e);
  }
  return null;
};

export const clearStoredToken = () => {
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(GCAL_ACCESS_TOKEN_KEY);
    localStorage.removeItem(GCAL_TOKEN_EXPIRY_KEY);
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Hydrate token from Firestore on boot if local token is expired
  if (!isCalendarTokenFresh()) {
    loadTokenFromCloud().catch(() => {});
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (typeof window !== 'undefined' && user.email) {
        localStorage.setItem(GCAL_USER_EMAIL_KEY, user.email);
      }
      let activeToken = getImmediateFreshAccessToken();
      if (!activeToken) {
        activeToken = await loadTokenFromCloud();
      }
      if (onAuthSuccess) onAuthSuccess(user, activeToken || '');
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const hintEmail =
      getStoredGoogleUserEmail() || auth.currentUser?.email || 'yayphotostudio@gmail.com';
    provider.setCustomParameters({
      login_hint: hintEmail,
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google.');
    }

    const expiryTimestamp = Date.now() + 3500 * 1000;
    saveTokenEverywhere(credential.accessToken, expiryTimestamp, result.user.email || hintEmail);

    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  }
};

export const getAccessToken = async (requireValid = true): Promise<string | null> => {
  const immediate = getImmediateFreshAccessToken();
  if (immediate) return immediate;

  const fromCloud = await loadTokenFromCloud();
  if (fromCloud) return fromCloud;

  if (!requireValid && cachedAccessToken && cachedAccessToken !== 'gcal_authenticated') {
    return cachedAccessToken;
  }
  return null;
};

export const getFreshAccessToken = async (interactive = false): Promise<string | null> => {
  // 1. Check immediate local fresh token first (synchronous)
  const immediate = getImmediateFreshAccessToken();
  if (immediate) return immediate;

  // 2. If interactive is true, call googleSignIn() via Firebase Auth popup BEFORE awaiting network calls
  if (interactive) {
    const res = await googleSignIn();
    return res?.accessToken || null;
  }

  // 3. Non-interactive: check Cloud Firestore config/studio for a fresh token
  const cloudToken = await loadTokenFromCloud();
  if (cloudToken) return cloudToken;

  return null;
};

export const logout = async () => {
  await signOut(auth);
  clearStoredToken();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(GCAL_USER_EMAIL_KEY);
  }
};




