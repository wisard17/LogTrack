import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
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

// Types
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  projectTitle?: string;
  role?: 'admin' | 'student';
  createdAt: Timestamp;
}

export interface LogEntry {
  id?: string;
  weekNumber: number;
  description: string;
  evidenceUrl: string;
  evidenceName?: string;
  evidenceType?: string;
  studentId: string;
  studentName: string;
  groupId: string;
  timestamp: Timestamp;
}

export interface ProjectGroup {
  id?: string;
  name: string;
  members: string[]; // Array of student UIDs
  createdAt: Timestamp;
}

// Firestore Error Handler
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
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
