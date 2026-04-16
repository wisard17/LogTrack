import { useState, useEffect } from 'react';
import { 
  auth, 
  logout, 
  db, 
  UserProfile, 
  getAuthErrorMessage
} from '../firebase';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  Timestamp 
} from 'firebase/firestore';
import { toast } from 'sonner';
import { syncUserToPostgres } from '../services/api';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const isUnsrat = firebaseUser?.email?.endsWith('@unsrat.ac.id') || firebaseUser?.email?.endsWith('.unsrat.ac.id');
      
      if (firebaseUser && !isUnsrat) {
        await logout();
        toast.error('Akses ditolak. Gunakan email institusi Unsrat');
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            setProfile(userData);
            setIsAdmin(firebaseUser.email === ADMIN_EMAIL || userData.role === 'admin');
            await syncUserToPostgres(userData);
          } else {
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Mahasiswa',
              email: firebaseUser.email || '',
              role: 'student',
              createdAt: Timestamp.now(),
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setProfile(newProfile);
            setIsAdmin(firebaseUser.email === ADMIN_EMAIL);
            await syncUserToPostgres(newProfile);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
      setIsAuthReady(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, profile, loading, isAuthReady, isAdmin };
}
