import { useState, useEffect } from 'react';
import { auth, logout } from '../firebase';
import type { UserProfile } from '../types';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { toast } from 'sonner';
import { syncUserToPostgres } from '../services/api';

export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      const request = ++generation;
      setLoading(true);
      setIsAuthReady(false);
      setProfile(null);
      setError('');
      setUser(firebaseUser);
      if (!firebaseUser) { setLoading(false); return; }
      const email = firebaseUser.email || '';
      if (!email.endsWith('@unsrat.ac.id') && !email.endsWith('.unsrat.ac.id')) {
        setUser(null);
        try { await logout(); } finally {
          toast.error('Akses ditolak. Gunakan email institusi Unsrat');
          if (request === generation) setLoading(false);
        }
        return;
      }
      try {
        const savedProfile = await syncUserToPostgres({ uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Mahasiswa', email });
        if (request !== generation) return;
        setProfile(savedProfile);
        setIsAuthReady(true);
      } catch (error) {
        if (request === generation) setError(error instanceof Error ? error.message : 'Gagal memuat profil');
      } finally {
        if (request === generation) setLoading(false);
      }
    });
    return () => { generation++; unsubscribe(); };
  }, [attempt]);

  return { user, profile, loading, isAuthReady, isAdmin: profile?.role === 'admin', error,
    retry: () => setAttempt(value => value + 1) };
}
