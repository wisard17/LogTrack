import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  BookOpen,
  GraduationCap,
  Plus, 
  FileText, 
  Trash2, 
  Users,
  Settings,
  CheckCircle2,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';
import type { Course, LogEntry, ProjectGroup, UserProfile } from '../../types';
import { 
  deleteLogFromPostgres, 
  createGroupInPostgres, 
  deleteGroupFromPostgres, 
  updateStudentGroupInPostgres,
  updateUserRoleInPostgres
} from '../../services/api';
import { CourseManagement } from './CourseManagement';
import { formatDate } from '@/lib/utils-date';

interface AdminDashboardProps {
  courses: Course[];
  onCourseChange: (id: string) => void;
  courseId: string;
  courseName: string;
  onChanged: () => void;
  logs: LogEntry[];
  logsLoading: boolean;
  logsError: string;
  groups: ProjectGroup[];
  allGroups: ProjectGroup[];
  allUsers: UserProfile[];
}

export function AdminDashboard({ logs, logsLoading, logsError, groups, allGroups, allUsers, courseId, courseName, onChanged, courses, onCourseChange }: AdminDashboardProps) {
  const [adminTab, setAdminTab] = useState('courses');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !courseId) return;
    try {
      await createGroupInPostgres(newGroupName.trim(), courseId);
      setNewGroupName('');
      onChanged();
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
      onChanged();
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
        await updateStudentGroupInPostgres(userId, null, courseId);
        onChanged();
        toast.success('Anggota dihapus dari kelompok');
      } else {
        // Assign one group in this course without changing other course memberships.
        await updateStudentGroupInPostgres(userId, groupId, courseId);
        onChanged();
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
      onChanged();
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
      onChanged();
      toast.success('Logbook dihapus');
    } catch (error) {
      console.error("Gagal menghapus logbook:", error);
      toast.error('Gagal menghapus logbook');
    }
  };

  useEffect(() => {
    setNewGroupName('');
    setSelectedGroupId('all');
  }, [courseId, courseName]);

  const activeGroupId = groups.some(g => g.id === selectedGroupId) ? selectedGroupId : 'all';
  const filteredLogs = logs.filter(log => log.courseId === courseId &&
    (activeGroupId === 'all' || log.groupId === activeGroupId));

  const courseFilter = (id: string, label = 'Mata Kuliah') => (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-2 block text-sm font-medium">{label}</label>
      <select id={id} value={courseId} disabled={!courses.length}
        onChange={e => { setSelectedGroupId('all'); onCourseChange(e.target.value); }}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
        {!courses.length && <option value="">Belum ada mata kuliah</option>}
        {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Panel Admin</h2>
        <p className="text-slate-500">Kelola mata kuliah, mahasiswa, kelompok, dan pantau laporan kegiatan.</p>
      </div>
      <Tabs value={adminTab} onValueChange={value => setAdminTab(String(value))} className="gap-6">
        <div className="overflow-x-auto">
          <TabsList aria-label="Menu admin" className="min-w-max">
            <TabsTrigger value="courses"><BookOpen />Matakuliah</TabsTrigger>
            <TabsTrigger value="students"><GraduationCap />Mahasiswa</TabsTrigger>
            <TabsTrigger value="groups"><Users />Kelompok/Grup</TabsTrigger>
            <TabsTrigger value="logs"><FileText />Monitoring Log</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="courses" className="space-y-6">
          <CourseManagement courses={courses} groups={allGroups} users={allUsers} onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="students" className="space-y-6">
          {courseFilter('student-course')}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Settings className="h-5 w-5 text-primary" />
                Manajemen Mahasiswa ({allUsers.length})
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
                                <DialogTitle>Pilih Kelompok — {courseName}</DialogTitle>
                                <DialogDescription>Pindahkan {student.name} ke kelompok:</DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-2 py-4">
                                {courseId && <Button variant="outline" onClick={async () => {
                                  try { await updateStudentGroupInPostgres(student.uid, null, courseId); onChanged(); toast.success('Terdaftar pada MK tanpa kelompok'); }
                                  catch { toast.error('Gagal mendaftarkan mahasiswa'); }
                                }}>Daftarkan ke MK tanpa kelompok</Button>}
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

        </TabsContent>
        <TabsContent value="groups" className="space-y-6">
          {courseFilter('group-course')}
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
                <Button disabled={!courseId} type="submit">Buat Kelompok</Button>
              </form>
            </CardContent>
          </Card>


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

        </TabsContent>
        <TabsContent value="logs">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {courseFilter('monitor-course', 'Filter MK')}
            <div className="flex-1">
              <label htmlFor="monitor-group" className="mb-2 block text-sm font-medium">Filter Kelompok/Grup</label>
              <select id="monitor-group" disabled={!courseId || !groups.length}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={activeGroupId}
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
                {logsLoading ? 'Memuat...' : `${filteredLogs.length} Log`}
              </div>
            </div>
          </div>


          <Card className="border-none shadow-sm bg-slate-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Ringkasan Log per Kelompok</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {groups.map(group => {
                  const logCount = logs.filter(l => l.groupId === group.id).length;
                  return (
                    <div key={group.id} className="bg-white px-3 py-1.5 rounded-full border border-slate-200 text-xs font-medium shadow-sm flex items-center gap-2">
                      <span className="text-slate-600">{group.name}</span>
                      <Badge variant="secondary" className="h-5 px-1.5 bg-primary/10 text-primary border-none">
                        {logCount} log
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {logsLoading && <p role="status" className="p-8 text-center text-slate-500">Memuat logbook...</p>}
            {!logsLoading && !logsError && filteredLogs.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">Belum ada log sesuai filter yang dipilih.</p>}
            {filteredLogs.map((log) => {
                const studentGroup = groups.find(g => g.id === log.groupId);
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

        </TabsContent>
      </Tabs>
    </div>
  );
}
