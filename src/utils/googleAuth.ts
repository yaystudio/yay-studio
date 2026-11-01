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
  return !!token || !!auth.currentUser;
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
      const activeToken = cachedAccessToken || storedToken || 'gcal_authenticated';
      cachedAccessToken = activeToken;
      if (typeof window !== 'undefined' && !storedToken) {
        localStorage.setItem(GCAL_ACCESS_TOKEN_KEY, activeToken);
      }
      if (onAuthSuccess) onAuthSuccess(user, activeToken);
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

export const isCalendarTokenFresh = (): boolean => {
  if (typeof window === 'undefined') return false;
  const token = cachedAccessToken || localStorage.getItem(GCAL_ACCESS_TOKEN_KEY);
  if (!token || token === 'gcal_authenticated') return false;
  const expiryStr = localStorage.getItem(GCAL_TOKEN_EXPIRY_KEY);
  if (!expiryStr) return false;
  const expiry = parseInt(expiryStr, 10);
  return !isNaN(expiry) && Date.now() < expiry;
};

export const getAccessToken = async (requireValid = true): Promise<string | null> => {
  if (requireValid && !isCalendarTokenFresh()) {
    return null;
  }
  if (cachedAccessToken && cachedAccessToken !== 'gcal_authenticated') return cachedAccessToken;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(GCAL_ACCESS_TOKEN_KEY);
    if (stored && stored !== 'gcal_authenticated') {
      cachedAccessToken = stored;
      return stored;
    }
  }
  return null;
};

export const getFreshAccessToken = async (interactive = false): Promise<string | null> => {
  if (isCalendarTokenFresh()) {
    const token = cachedAccessToken || (typeof window !== 'undefined' ? localStorage.getItem(GCAL_ACCESS_TOKEN_KEY) : null);
    if (token && token !== 'gcal_authenticated') return token;
  }
  if (interactive) {
    const res = await googleSignIn();
    return res?.accessToken || null;
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


