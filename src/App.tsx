/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  auth, 
  loginWithGoogle, 
  logout, 
  db, 
  storage,
  UserProfile, 
  LogEntry, 
  ProjectGroup,
  OperationType, 
  handleFirestoreError,
  getAuthErrorMessage
} from './firebase';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where,
  orderBy, 
  serverTimestamp, 
  addDoc,
  Timestamp,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  LogOut, 
  Plus, 
  FileText, 
  Calendar, 
  User as UserIcon, 
  Upload, 
  FileUp, 
  Trash2, 
  ExternalLink,
  Loader2,
  CheckCircle2,
  Users,
  Settings,
  LayoutDashboard,
  ChevronRight,
  UserPlus,
  UserMinus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const API_BASE_URL = 'http://localhost:8000';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<'student' | 'admin'>('student');
  const [adminTab, setAdminTab] = useState<'groups' | 'logs'>('groups');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  // Form State
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

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
        // Check/Create Profile
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            setProfile(userData);
            setIsAdmin(firebaseUser.email === ADMIN_EMAIL || userData.role === 'admin');

            // Sync with Postgres on login
            try {
              const res = await fetch(`${API_BASE_URL}/mahasiswa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  nama: userData.name,
                  email: userData.email,
                  id: userData.uid,
                  role: userData.role
                })
              });
              if (!res.ok) {
                const errorData = await res.json();
                console.error("Postgres sync error:", errorData);
              } else {
                console.log("Postgres sync success for existing user");
              }
            } catch (err) {
              console.error("Failed to sync user to Postgres:", err);
            }
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

            // Sync new user with Postgres
            try {
              const res = await fetch(`${API_BASE_URL}/mahasiswa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  nama: newProfile.name,
                  email: newProfile.email,
                  id: newProfile.uid,
                  role: newProfile.role
                })
              });
              if (!res.ok) {
                const errorData = await res.json();
                console.error("Postgres sync error:", errorData);
              } else {
                console.log("Postgres sync success for new user");
              }
            } catch (err) {
              console.error("Failed to sync new user to Postgres:", err);
            }
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        setProfile(null);
        setLogs([]);
        setIsAdmin(false);
      }
      setIsAuthReady(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthReady) return;

    // Logs listener - filter by group for students, or show all for admin
    const userGroup = groups.find(g => g.members.includes(user.uid));
    
    let qLogs;
    if (isAdmin) {
      qLogs = query(collection(db, 'logs'), orderBy('weekNumber', 'desc'));
    } else if (userGroup) {
      qLogs = query(collection(db, 'logs'), where('groupId', '==', userGroup.id), orderBy('weekNumber', 'desc'));
    } else {
      // If student not in group, only show their own logs (or empty if they haven't submitted any)
      qLogs = query(collection(db, 'logs'), where('studentId', '==', user.uid), orderBy('weekNumber', 'desc'));
    }

    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LogEntry[];
      setLogs(logsData);
    }, (error) => {
      // If it's a permission error because of the query, we handle it
      if (error.message.includes('permission-denied')) {
        console.warn("Permission denied for logs query. This might be expected if user is not in a group yet.");
        setLogs([]);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'logs');
      }
    });

    // Groups listener
    const qGroups = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ProjectGroup[];
      setGroups(groupsData);
    });

    // Users listener (only for admin)
    let unsubUsers = () => {};
    if (isAdmin) {
      const qUsers = query(collection(db, 'users'), orderBy('name', 'asc'));
      unsubUsers = onSnapshot(qUsers, (snapshot) => {
        const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
        setAllUsers(usersData);
      });
    }

    return () => {
      unsubLogs();
      unsubGroups();
      unsubUsers();
    };
  }, [user, isAuthReady, isAdmin]);

  const handleLogin = async () => {
    try {
      const result = await loginWithGoogle();

      // Redirect flow does not immediately return a user in this lifecycle.
      if (!result) {
        toast.info('Mengarahkan ke login Google...');
        return;
      }

      const userEmail = result.user.email;
      const isUnsrat = userEmail?.endsWith('@unsrat.ac.id') || userEmail?.endsWith('.unsrat.ac.id');
      
      if (!isUnsrat) {
        await logout();
        toast.error('Akses ditolak. Gunakan email institusi Unsrat');
        return;
      }
      
      toast.success('Berhasil masuk');
    } catch (error) {
      const authError = getAuthErrorMessage(error);
      toast.error(authError.message);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Berhasil keluar');
    } catch (error) {
      toast.error('Gagal keluar');
    }
  };

  const handleSubmitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    const userGroup = groups.find(g => g.members.includes(user.uid));
    if (!userGroup) {
      toast.error('Anda harus terdaftar dalam kelompok sebelum mengunggah logbook');
      return;
    }

    if (!file) {
      toast.error('Mohon unggah bukti kegiatan');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload File
      const fileRef = ref(storage, `evidence/${user.uid}/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(uploadResult.ref);

      // 2. Save to Firestore
      const logData = {
        weekNumber,
        description,
        evidenceUrl: downloadUrl,
        evidenceName: file.name,
        evidenceType: file.type,
        studentId: user.uid,
        studentName: profile.name,
        groupId: userGroup.id,
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, 'logs'), logData);

      // 3. Save to Postgres
      try {
        // Find student in Postgres by email
        const studentRes = await fetch(`${API_BASE_URL}/mahasiswa`);
        const students = await studentRes.json();
        const pgStudent = students.find((s: any) => s.email === profile.email);

        // Find group in Postgres by name
        const groupRes = await fetch(`${API_BASE_URL}/grup`);
        const groupsList = await groupRes.json();
        const pgGroup = groupsList.find((g: any) => g.nama === userGroup.name);

        if (pgStudent && pgGroup) {
          await fetch(`${API_BASE_URL}/logbook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              week_number: weekNumber,
              description,
              evidence_url: downloadUrl,
              evidence_name: file.name,
              evidence_type: file.type,
              mahasiswa_id: user.uid,
              grup_id: pgGroup.id
            })
          });
        }
      } catch (err) {
        console.error("Failed to sync logbook to Postgres:", err);
      }
      
      toast.success('Logbook berhasil disimpan');
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error submitting log:", error);
      toast.error('Gagal menyimpan logbook');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus log ini?')) return;
    
    try {
      await deleteDoc(doc(db, 'logs', logId));
      toast.success('Log berhasil dihapus');
    } catch (error) {
      toast.error('Gagal menghapus log');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      // 1. Save to Firebase
      await addDoc(collection(db, 'groups'), {
        name: newGroupName,
        members: [],
        createdAt: serverTimestamp(),
      });

      // 2. Save to Postgres
      try {
        await fetch(`${API_BASE_URL}/grup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nama: newGroupName })
        });
      } catch (err) {
        console.error("Failed to sync group to Postgres:", err);
      }

      setNewGroupName('');
      toast.success('Kelompok berhasil dibuat');
    } catch (error) {
      toast.error('Gagal membuat kelompok');
    }
  };

  const handleToggleMember = async (groupId: string, studentUid: string, isMember: boolean) => {
    try {
      const groupRef = doc(db, 'groups', groupId);
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      const student = allUsers.find(u => u.uid === studentUid);
      if (!student) return;

      let newMembers = [...group.members];
      if (isMember) {
        newMembers = newMembers.filter(id => id !== studentUid);
      } else {
        newMembers.push(studentUid);
      }

      // 1. Update Firebase
      await updateDoc(groupRef, { members: newMembers });

      // 2. Sync with Postgres
      try {
        // Find group in Postgres by name to get UUID
        const groupListRes = await fetch(`${API_BASE_URL}/grup`);
        const groupList = await groupListRes.json();
        const pgGroup = groupList.find((g: any) => g.nama === group.name);

        if (pgGroup) {
          const res = await fetch(`${API_BASE_URL}/mahasiswa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: student.uid,
              nama: student.name,
              email: student.email,
              role: student.role,
              grup_id: isMember ? null : pgGroup.id
            })
          });
          if (!res.ok) {
            const errorData = await res.json();
            console.error("Postgres member sync error:", errorData);
          }
        }
      } catch (err) {
        console.error("Failed to sync member to Postgres:", err);
      }

      toast.success(isMember ? 'Anggota dihapus' : 'Anggota ditambahkan');
    } catch (error) {
      toast.error('Gagal memperbarui anggota');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm('Hapus kelompok ini?')) return;
    try {
      await deleteDoc(doc(db, 'groups', groupId));
      toast.success('Kelompok dihapus');
    } catch (error) {
      toast.error('Gagal menghapus kelompok');
    }
  };

  const handleToggleAdmin = async (student: UserProfile) => {
    if (student.email === ADMIN_EMAIL) {
      toast.error('Bootstrap admin tidak bisa diubah');
      return;
    }
    
    const newRole = student.role === 'admin' ? 'student' : 'admin';
    if (!window.confirm(`Ubah peran ${student.name} menjadi ${newRole}?`)) return;

    try {
      await updateDoc(doc(db, 'users', student.uid), { role: newRole });
      toast.success(`Berhasil mengubah peran menjadi ${newRole}`);
    } catch (error) {
      toast.error('Gagal mengubah peran');
    }
  };

  const resetForm = () => {
    const myLogs = logs.filter(l => l.studentId === user?.uid);
    const nextWeek = myLogs.length > 0 ? Math.max(...myLogs.map(l => l.weekNumber)) + 1 : 1;
    setWeekNumber(nextWeek);
    setDescription('');
    setFile(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-none shadow-xl">
            <CardHeader className="space-y-1 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Logbook Proyek</CardTitle>
              <CardDescription>
                Masuk dengan email <strong> Unsrat</strong> (@unsrat.ac.id) untuk mencatat progres mingguan proyek Anda
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button onClick={handleLogin} className="w-full py-6 text-lg font-medium" variant="outline">
                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkFYRSdi0jS84juZY9vGQ-Zfi8nxNEcdk5k8GbwdSPJT8vtu_x7uEbVp7qHzNt3FjX7rSiZnVjej37a7PTYSOMVy4gTwbk&s&ec=121624339" alt="Google" className="mr-2 h-5 w-5" />
                Masuk dengan Google
              </Button>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 text-center text-xs text-muted-foreground">
              <p>Khusus Mahasiswa Universitas Sam Ratulangi</p>
            </CardFooter>
          </Card>
        </motion.div>
        <Toaster position="top-center" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Logbook Proyek</h1>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <div className="mr-4 flex rounded-lg bg-slate-100 p-1">
                <Button 
                  variant={view === 'student' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-8 gap-2"
                  onClick={() => setView('student')}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Mahasiswa
                </Button>
                <Button 
                  variant={view === 'admin' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-8 gap-2"
                  onClick={() => setView('admin')}
                >
                  <Settings className="h-4 w-4" />
                  Admin
                </Button>
              </div>
            )}
            <div className="hidden items-center gap-2 md:flex">
              <div className="text-right">
                <p className="text-sm font-medium leading-none">{profile?.name}</p>
                <p className="text-xs text-muted-foreground">{profile?.email}</p>
              </div>
              <div className="h-8 w-8 overflow-hidden rounded-full bg-slate-200">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={profile?.name} referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="h-full w-full p-1.5 text-slate-500" />
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Keluar">
              <LogOut className="h-5 w-5 text-slate-500" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-8">
        {view === 'student' ? (
          <>
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard Mahasiswa</h2>
                <p className="text-slate-500">Pantau dan laporkan progres mingguan proyek Anda.</p>
              </div>
              
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (open) resetForm();
              }}>
                <DialogTrigger render={<Button className="gap-2 shadow-lg shadow-primary/20" />}>
                  <Plus className="h-4 w-4" />
                  Tambah Log Mingguan
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <form onSubmit={handleSubmitLog}>
                    <DialogHeader>
                      <DialogTitle>Tambah Logbook Baru</DialogTitle>
                      <DialogDescription>
                        Isi detail kegiatan mingguan dan unggah bukti pendukung.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <label htmlFor="week" className="text-sm font-medium">Minggu Ke-</label>
                        <Input 
                          id="week" 
                          type="number" 
                          min="1" 
                          max="52" 
                          value={weekNumber} 
                          onChange={(e) => setWeekNumber(parseInt(e.target.value))}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="description" className="text-sm font-medium">Deskripsi Kegiatan</label>
                        <Textarea 
                          id="description" 
                          placeholder="Apa saja yang Anda kerjakan minggu ini?" 
                          className="min-h-[120px]"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Bukti Kegiatan (.pdf, .jpg, .png)</label>
                        <div className="relative">
                          <Input 
                            type="file" 
                            accept=".pdf,.jpg,.jpeg,.png" 
                            className="hidden" 
                            id="file-upload"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                          />
                          <label 
                            htmlFor="file-upload" 
                            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${file ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50'}`}
                          >
                            {file ? (
                              <div className="flex items-center gap-2 text-primary">
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="max-w-[300px] truncate text-sm font-medium">{file.name}</span>
                              </div>
                            ) : (
                              <>
                                <FileUp className="mb-2 h-8 w-8 text-slate-400" />
                                <span className="text-sm text-slate-600">Klik untuk unggah file</span>
                              </>
                            )}
                          </label>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Mengunggah...
                          </>
                        ) : (
                          'Simpan Logbook'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Stats Summary */}
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Total Log</CardDescription>
                  <CardTitle className="text-2xl">{logs.filter(l => l.studentId === user.uid).length}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Minggu Terakhir</CardDescription>
                  <CardTitle className="text-2xl">
                    {logs.filter(l => l.studentId === user.uid).length > 0 
                      ? Math.max(...logs.filter(l => l.studentId === user.uid).map(l => l.weekNumber)) 
                      : '-'}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Kelompok</CardDescription>
                  <CardTitle className="text-2xl text-primary">
                    {groups.find(g => g.members.includes(user.uid))?.name || 'Belum Ada'}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Logs List */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Riwayat Kegiatan</h3>
              
              <AnimatePresence mode="popLayout">
                {logs.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-20 text-center"
                  >
                    <div className="mb-4 rounded-full bg-slate-100 p-4">
                      <Calendar className="h-8 w-8 text-slate-400" />
                    </div>
                    <h4 className="text-lg font-medium text-slate-900">Belum ada log</h4>
                    <p className="text-slate-500">Mulai catat progres mingguan Anda sekarang.</p>
                  </motion.div>
                ) : (
                  <div className="grid gap-4">
                    {logs.map((log) => (
                      <motion.div
                        key={log.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <Card className="overflow-hidden border-none shadow-sm transition-shadow hover:shadow-md">
                          <div className="flex flex-col sm:flex-row">
                            <div className="flex w-full flex-col p-6 sm:w-3/4">
                              <div className="mb-2 flex items-center gap-2">
                                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                  Minggu {log.weekNumber}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {log.timestamp?.toDate().toLocaleDateString('id-ID', { 
                                    day: 'numeric', 
                                    month: 'long', 
                                    year: 'numeric' 
                                  })}
                                </span>
                              </div>
                              <h4 className="mb-2 font-semibold text-slate-900">
                                {log.studentId === user.uid ? 'Laporan Saya' : log.studentName}
                              </h4>
                              <p className="text-sm leading-relaxed text-slate-600">
                                {log.description}
                              </p>
                            </div>
                            <div className="flex w-full flex-col border-t border-slate-100 bg-slate-50/50 p-6 sm:w-1/4 sm:border-l sm:border-t-0">
                              <div className="mb-4 flex flex-col gap-2">
                                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Bukti Kegiatan</span>
                                <a 
                                  href={log.evidenceUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-sm transition-colors hover:border-primary hover:text-primary"
                                >
                                  <Upload className="h-4 w-4 text-slate-400 group-hover:text-primary" />
                                  <span className="truncate">{log.evidenceName || 'Lihat File'}</span>
                                  <ExternalLink className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100" />
                                </a>
                              </div>
                              {log.studentId === user.uid && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="mt-auto h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => log.id && handleDeleteLog(log.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Hapus Log
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Panel Admin</h2>
                <p className="text-slate-500">Kelola kelompok dan pantau progres seluruh mahasiswa.</p>
              </div>
              <div className="flex rounded-lg border border-slate-200 bg-white p-1">
                <Button 
                  variant={adminTab === 'groups' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-8 gap-2"
                  onClick={() => setAdminTab('groups')}
                >
                  <Users className="h-4 w-4" />
                  Kelompok
                </Button>
                <Button 
                  variant={adminTab === 'logs' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-8 gap-2"
                  onClick={() => setAdminTab('logs')}
                >
                  <FileText className="h-4 w-4" />
                  Monitoring Log
                </Button>
              </div>
            </div>

            {adminTab === 'groups' ? (
              <>
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Buat Kelompok Baru</CardTitle>
                    <CardDescription>Tambahkan nama kelompok untuk memulai pengelompokan mahasiswa.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateGroup} className="flex gap-4">
                      <Input 
                        placeholder="Nama Kelompok (Contoh: Kelompok 1 - AI)" 
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="max-w-md"
                      />
                      <Button type="submit">Buat Kelompok</Button>
                    </form>
                  </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <Users className="h-5 w-5 text-primary" />
                      Daftar Kelompok ({groups.length})
                    </h3>
                    <ScrollArea className="h-[500px] rounded-xl border border-slate-200 bg-white p-4">
                      <div className="space-y-4">
                        {groups.map((group) => (
                          <Card key={group.id} className="border-slate-100 shadow-none">
                            <CardHeader className="p-4 pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{group.name}</CardTitle>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => group.id && handleDeleteGroup(group.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <CardDescription>{group.members.length} Anggota</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                              <div className="flex flex-wrap gap-2">
                                {group.members.map(uid => {
                                  const member = allUsers.find(u => u.uid === uid);
                                  return (
                                    <Badge key={uid} variant="secondary" className="gap-1">
                                      {member?.name || 'Unknown'}
                                      <button onClick={() => group.id && handleToggleMember(group.id, uid, true)}>
                                        <UserMinus className="h-3 w-3 text-destructive" />
                                      </button>
                                    </Badge>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <UserPlus className="h-5 w-5 text-primary" />
                      Mahasiswa Terdaftar ({allUsers.length})
                    </h3>
                    <ScrollArea className="h-[500px] rounded-xl border border-slate-200 bg-white p-4">
                      <div className="space-y-2">
                        {allUsers.map((student) => {
                          const studentGroup = groups.find(g => g.members.includes(student.uid));
                          return (
                            <div key={student.uid} className="flex items-center justify-between rounded-lg border border-slate-50 p-3 transition-colors hover:bg-slate-50">
                              <div>
                                <p className="text-sm font-medium">{student.name}</p>
                                <p className="text-xs text-muted-foreground">{student.email}</p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {studentGroup && (
                                    <Badge variant="outline" className="text-[10px] h-4">
                                      {studentGroup.name}
                                    </Badge>
                                  )}
                                  {student.role === 'admin' && (
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px] h-4">
                                      Admin
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className={`h-8 w-8 p-0 ${student.role === 'admin' ? 'text-amber-600' : 'text-slate-400'}`}
                                  onClick={() => handleToggleAdmin(student)}
                                  title={student.role === 'admin' ? 'Hapus Admin' : 'Jadikan Admin'}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                                <Dialog>
                                  <DialogTrigger render={<Button variant="ghost" size="sm" className="h-8 w-8 p-0" />}>
                                    <Plus className="h-4 w-4" />
                                  </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Pilih Kelompok</DialogTitle>
                                    <DialogDescription>Pindahkan {student.name} ke kelompok:</DialogDescription>
                                  </DialogHeader>
                                  <div className="grid gap-2 py-4">
                                    {groups.map(g => (
                                      <Button 
                                        key={g.id} 
                                        variant={studentGroup?.id === g.id ? 'secondary' : 'outline'}
                                        className="justify-start"
                                        onClick={() => g.id && handleToggleMember(g.id, student.uid, studentGroup?.id === g.id)}
                                      >
                                        {g.name}
                                        {studentGroup?.id === g.id && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
                                      </Button>
                                    ))}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="mb-2 block text-sm font-medium">Filter Kelompok</label>
                    <select 
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                    >
                      <option value="all">Semua Kelompok</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="mb-2 block text-sm font-medium">Total Log Ditemukan</label>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold">
                      {logs.filter(log => {
                        if (selectedGroupId === 'all') return true;
                        const group = groups.find(g => g.id === selectedGroupId);
                        return group?.members.includes(log.studentId);
                      }).length} Log
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {logs
                    .filter(log => {
                      if (selectedGroupId === 'all') return true;
                      const group = groups.find(g => g.id === selectedGroupId);
                      return group?.members.includes(log.studentId);
                    })
                    .map((log) => {
                      const studentGroup = groups.find(g => g.members.includes(log.studentId));
                      return (
                        <Card key={log.id} className="overflow-hidden border-none shadow-sm">
                          <div className="flex flex-col sm:flex-row">
                            <div className="flex w-full flex-col p-6 sm:w-3/4">
                              <div className="mb-2 flex items-center gap-2">
                                <Badge variant="secondary" className="bg-primary/10 text-primary">
                                  Minggu {log.weekNumber}
                                </Badge>
                                <Badge variant="outline" className="border-slate-200 text-slate-500">
                                  {studentGroup?.name || 'Tanpa Kelompok'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {log.timestamp?.toDate().toLocaleDateString('id-ID', { 
                                    day: 'numeric', 
                                    month: 'long', 
                                    year: 'numeric' 
                                  })}
                                </span>
                              </div>
                              <h4 className="mb-1 font-semibold text-slate-900">{log.studentName}</h4>
                              <p className="text-sm leading-relaxed text-slate-600">{log.description}</p>
                            </div>
                            <div className="flex w-full flex-col border-t border-slate-100 bg-slate-50/50 p-6 sm:w-1/4 sm:border-l sm:border-t-0">
                              <span className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">Bukti</span>
                              <a 
                                href={log.evidenceUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-sm transition-colors hover:border-primary hover:text-primary"
                              >
                                <Upload className="h-4 w-4 text-slate-400" />
                                <span className="truncate">{log.evidenceName || 'Lihat File'}</span>
                              </a>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="mt-4 h-8 text-destructive hover:bg-destructive/10"
                                onClick={() => log.id && handleDeleteLog(log.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Hapus
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  
                  {logs.filter(log => {
                    if (selectedGroupId === 'all') return true;
                    const group = groups.find(g => g.id === selectedGroupId);
                    return group?.members.includes(log.studentId);
                  }).length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-20 text-center">
                      <FileText className="mb-4 h-12 w-12 text-slate-300" />
                      <h4 className="text-lg font-medium text-slate-900">Tidak ada log ditemukan</h4>
                      <p className="text-slate-500">Belum ada mahasiswa dari kelompok ini yang mengunggah logbook.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
