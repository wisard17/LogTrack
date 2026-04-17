import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Plus, 
  FileText, 
  Trash2, 
  Users,
  Settings,
  CheckCircle2,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';
import { db, LogEntry, ProjectGroup, UserProfile, OperationType } from '../../firebase';
import { 
  API_BASE_URL, 
  deleteLogFromPostgres, 
  createGroupInPostgres, 
  deleteGroupFromPostgres, 
  updateStudentGroupInPostgres,
  updateUserRoleInPostgres
} from '../../services/api';
import { formatDate } from '@/lib/utils-date';

interface AdminDashboardProps {
  logs: LogEntry[];
  groups: ProjectGroup[];
  allUsers: UserProfile[];
}

export function AdminDashboard({ logs, groups, allUsers }: AdminDashboardProps) {
  const [adminTab, setAdminTab] = useState<'groups' | 'logs'>('groups');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      await createGroupInPostgres(newGroupName);
      setNewGroupName('');
      toast.success('Kelompok berhasil dibuat');
    } catch (error) {
      console.error("Gagal membuat kelompok:", error);
      toast.error('Gagal membuat kelompok');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Hapus kelompok ini?')) return;
    try {
      await deleteGroupFromPostgres(groupId);
      toast.success('Kelompok dihapus');
    } catch (error) {
      console.error("Gagal menghapus kelompok:", error);
      toast.error('Gagal menghapus kelompok');
    }
  };

  const handleToggleMember = async (groupId: string, userId: string, isMember: boolean) => {
    try {
      if (isMember) {
        // Remove from group
        await updateStudentGroupInPostgres(userId, null);
        toast.success('Anggota dihapus dari kelompok');
      } else {
        // Add to group (Postgres handles one group per student via grup_id column usually)
        await updateStudentGroupInPostgres(userId, groupId);
        toast.success('Anggota ditambahkan ke kelompok');
      }
    } catch (error) {
      console.error("Gagal memperbarui anggota kelompok:", error);
      toast.error('Gagal memperbarui anggota kelompok');
    }
  };

  const handleToggleAdmin = async (targetUser: UserProfile) => {
    try {
      const newRole = targetUser.role === 'admin' ? 'student' : 'admin';
      await updateUserRoleInPostgres(targetUser.uid, newRole);
      toast.success(`User berhasil dijadikan ${newRole}`);
    } catch (error) {
      console.error("Gagal mengubah role user:", error);
      toast.error('Gagal mengubah role user');
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Hapus logbook ini?')) return;
    try {
      await deleteLogFromPostgres(logId);
      toast.success('Logbook dihapus');
    } catch (error) {
      console.error("Gagal menghapus logbook:", error);
      toast.error('Gagal menghapus logbook');
    }
  };

  return (
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
                        <CardDescription className="text-xs">
                          {group.members.length} Anggota
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex flex-wrap gap-1">
                          {group.members.map(memberId => {
                            const member = allUsers.find(u => u.uid === memberId);
                            return (
                              <Badge key={memberId} variant="outline" className="text-[10px] font-normal">
                                {member?.name || 'Loading...'}
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
                <Settings className="h-5 w-5 text-primary" />
                Manajemen Mahasiswa
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
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Plus className="h-4 w-4" />
                              </Button>
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
                  <option key={g.id} value={g.id!}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium">Total Log Ditemukan</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold">
                {logs.filter(log => {
                  if (selectedGroupId === 'all') return true;
                  return log.groupId === selectedGroupId;
                }).length} Log
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {logs
              .filter(log => {
                if (selectedGroupId === 'all') return true;
                return log.groupId === selectedGroupId;
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
                            {formatDate(log.timestamp)}
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
          </div>
        </div>
      )}
    </div>
  );
}
