import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export interface AuthErrorDetail {
  code?: string;
  message: string;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/popup-blocked': 'Popup login diblokir browser. Kami alihkan ke login redirect.',
  'auth/popup-closed-by-user': 'Popup login ditutup sebelum proses selesai.',
  'auth/cancelled-popup-request': 'Permintaan popup login dibatalkan.',
  'auth/operation-not-allowed': 'Login Google belum diaktifkan di Firebase Console (Authentication > Sign-in method).',
  'auth/unauthorized-domain': 'Domain aplikasi belum diizinkan di Firebase (Authentication > Settings > Authorized domains).',
  'auth/network-request-failed': 'Koneksi jaringan bermasalah. Periksa internet Anda lalu coba lagi.'
};

export const getAuthErrorMessage = (error: unknown): AuthErrorDetail => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: string }).code)
    : undefined;

  const fallbackMessage = 'Gagal login dengan Google. Silakan coba lagi.';
  return {
    code,
    message: (code && AUTH_ERROR_MESSAGES[code]) || fallbackMessage,
  };
};

// Auth Helpers
export const loginWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    const { code } = getAuthErrorMessage(error);

    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    throw error;
  }
};

export const logout = () => signOut(auth);
