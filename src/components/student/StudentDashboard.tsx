import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Plus, 
  FileText, 
  Calendar, 
  Upload, 
  Trash2, 
  ExternalLink,
  Loader2,
  CheckCircle2,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { db, LogEntry, ProjectGroup, OperationType, handleFirestoreError } from '../../firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { uploadFile, createLogEntry, syncLogToPostgres } from '../../services/api';

interface StudentDashboardProps {
  user: any;
  profile: any;
  logs: LogEntry[];
  groups: ProjectGroup[];
}

export function StudentDashboard({ user, profile, logs, groups }: StudentDashboardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const resetForm = () => {
    setWeekNumber(1);
    setDescription('');
    setFile(null);
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
      const uploadData = await uploadFile(file);
      const downloadUrl = uploadData.url;

      const logData = {
        weekNumber,
        description,
        evidenceUrl: downloadUrl,
        evidenceName: file.name,
        evidenceType: file.type,
        studentId: user.uid,
        studentName: profile.name,
        groupId: userGroup.id,
      };

      await createLogEntry(logData);
      await syncLogToPostgres(logData, profile, userGroup);
      
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
    if (!confirm('Hapus logbook ini?')) return;
    try {
      await deleteDoc(doc(db, 'logs', logId));
      toast.success('Logbook dihapus');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `logs/${logId}`);
      toast.error('Gagal menghapus logbook');
    }
  };

  const userGroup = groups.find(g => g.members.includes(user.uid));

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Halo, {profile?.name}</h2>
          <p className="text-slate-500">Pantau perkembangan mingguan Anda di sini.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="h-12 gap-2 rounded-xl px-6 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
              <Plus className="h-5 w-5" />
              Buat Logbook Baru
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border-none">
            <DialogHeader className="px-6 pt-6 pb-4 bg-slate-50/50 border-b border-slate-100">
              <DialogTitle className="text-xl font-bold text-slate-900">Buat Laporan Mingguan</DialogTitle>
              <DialogDescription className="text-slate-500">Catat aktivitas dan progres proyek Anda minggu ini.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[80vh]">
              <form onSubmit={handleSubmitLog} className="space-y-6 p-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Minggu Ke-
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setWeekNumber(num)}
                        className={`flex h-10 w-10 min-w-[40px] items-center justify-center rounded-xl border-2 text-sm font-bold transition-all ${
                          weekNumber === num 
                          ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20 scale-105' 
                          : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-white'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold  flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Deskripsi Kegiatan
                  </label>
                  <Textarea 
                    placeholder="Ceritakan apa yang Anda kerjakan minggu ini secara mendetail..." 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[150px] rounded-2xl border-slate-200 bg-slate-50/30 p-4 focus:ring-primary/20 transition-all focus:bg-white"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold  flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    Bukti Kegiatan
                  </label>
                  <div 
                    className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all ${
                      file 
                      ? 'border-primary bg-primary/5' 
                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <input 
                      type="file" 
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      accept=".pdf,.jpg,.jpeg,.png,.docx"
                    />
                    {file ? (
                      <div className="text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                          <CheckCircle2 className="h-6 w-6 text-primary" />
                        </div>
                        <span className="block text-sm font-semibold text-slate-900 truncate max-w-[200px]">{file.name}</span>
                        <span className="mt-1 block text-xs text-slate-500">Klik untuk mengganti file</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200/50 text-slate-400">
                          <Upload className="h-6 w-6" />
                        </div>
                        <span className="block text-sm font-semibold text-slate-900">Pilih atau Seret File</span>
                        <span className="mt-1 block text-xs text-slate-500">PDF, Gambar, atau Dokumen (Maks 5MB)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-2xl text-base font-bold shadow-lg shadow-primary/20">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Sedang Menyimpan...
                      </>
                    ) : 'Simpan Laporan Mingguan'}
                  </Button>
                </div>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {/* Group Info Section */}
      {userGroup ? (
        <Card className="border-none bg-indigo-600 text-white shadow-lg shadow-indigo-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardDescription className="text-indigo-100">Grup Saya</CardDescription>
              <CardTitle className="text-2xl">{userGroup.name}</CardTitle>
            </div>
            <Users className="h-8 w-8 text-indigo-300" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-indigo-500/30 text-white hover:bg-indigo-500/40">
                {userGroup.members.length} Anggota
              </Badge>
              <span className="text-xs text-indigo-200">Terdaftar sejak {userGroup.createdAt?.toDate().toLocaleDateString('id-ID')}</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-dashed border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col items-center justify-center py-6 text-center">
            <Users className="mb-2 h-8 w-8 text-amber-500" />
            <p className="font-semibold text-amber-900">Belum memiliki kelompok</p>
            <p className="text-sm text-amber-700">Hubungi admin untuk ditambahkan ke kelompok agar dapat membuat logbook.</p>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
