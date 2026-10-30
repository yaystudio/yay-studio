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
const GCAL_USER_EMAIL_KEY = 'yay_studio_gcal_user_email_v1';

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory with localStorage fallback.
let cachedAccessToken: string | null = (typeof window !== 'undefined' ? localStorage.getItem(GCAL_ACCESS_TOKEN_KEY) : null);

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const storedToken = (typeof window !== 'undefined' ? localStorage.getItem(GCAL_ACCESS_TOKEN_KEY) : null);
      const activeToken = cachedAccessToken || storedToken;
      if (activeToken) {
        cachedAccessToken = activeToken;
        if (onAuthSuccess) onAuthSuccess(user, activeToken);
      } else if (!isSigningIn) {
        // User logged in but no calendar token cached yet
        if (onAuthSuccess) onAuthSuccess(user, '');
      }
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem(GCAL_ACCESS_TOKEN_KEY);
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
    if (typeof window !== 'undefined') {
      localStorage.setItem(GCAL_ACCESS_TOKEN_KEY, credential.accessToken);
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

export const getAccessToken = async (): Promise<string | null> => {
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
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(GCAL_ACCESS_TOKEN_KEY);
    localStorage.removeItem(GCAL_USER_EMAIL_KEY);
  }
};

