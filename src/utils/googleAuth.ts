import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { auth } from './firebase';

export const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

const GCAL_ACCESS_TOKEN_KEY = 'yay_studio_gcal_access_token_v1';
const GCAL_TOKEN_EXPIRY_KEY = 'yay_studio_gcal_token_expiry_v1';
const GCAL_USER_EMAIL_KEY = 'yay_studio_gcal_user_email_v1';

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory with localStorage fallback.
let cachedAccessToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem(GCAL_ACCESS_TOKEN_KEY) : null;

export const isCalendarTokenValid = (): boolean => {
  if (typeof window === 'undefined') return false;
  const token = cachedAccessToken || localStorage.getItem(GCAL_ACCESS_TOKEN_KEY);
  if (!token) return false;
  const expiryStr = localStorage.getItem(GCAL_TOKEN_EXPIRY_KEY);
  if (expiryStr) {
    const expiry = parseInt(expiryStr, 10);
    // Allow grace window before marking invalid, clearing only on actual API 401
    if (!isNaN(expiry) && Date.now() >= expiry + 1800 * 1000) {
      return false;
    }
  }
  return true;
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
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const storedToken =
        typeof window !== 'undefined' ? localStorage.getItem(GCAL_ACCESS_TOKEN_KEY) : null;
      const activeToken = cachedAccessToken || storedToken;
      const isValid = isCalendarTokenValid();
      if (activeToken && isValid) {
        cachedAccessToken = activeToken;
        if (onAuthSuccess) onAuthSuccess(user, activeToken);
      } else {
        // User logged in via Firebase Auth, but Google Calendar token is not available or expired
        if (onAuthSuccess) onAuthSuccess(user, '');
      }
    } else {
      clearStoredToken();
      if (typeof window !== 'undefined') {
        localStorage.removeItem(GCAL_USER_EMAIL_KEY);
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google.');
    }

    cachedAccessToken = credential.accessToken;
    // Google OAuth access tokens are valid for 3600 seconds (1 hour); store expiry with safety buffer
    const expiryTimestamp = Date.now() + 3500 * 1000;
    if (typeof window !== 'undefined') {
      localStorage.setItem(GCAL_ACCESS_TOKEN_KEY, credential.accessToken);
      localStorage.setItem(GCAL_TOKEN_EXPIRY_KEY, String(expiryTimestamp));
      if (result.user.email) {
        localStorage.setItem(GCAL_USER_EMAIL_KEY, result.user.email);
      }
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (requireValid = true): Promise<string | null> => {
  if (requireValid && !isCalendarTokenValid()) {
    return null;
  }
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(GCAL_ACCESS_TOKEN_KEY);
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  }
  return null;
};

export const getStoredGoogleUserEmail = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(GCAL_USER_EMAIL_KEY);
  }
  return null;
};

export const logout = async () => {
  await signOut(auth);
  clearStoredToken();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(GCAL_USER_EMAIL_KEY);
  }
};


