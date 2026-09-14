import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Course, ProjectGroup, UserProfile } from '../../types';
import { saveCourse } from '../../services/api';

interface CourseManagementProps {
  courses: Course[];
  groups: ProjectGroup[];
  users: UserProfile[];
  onChanged: () => void;
}

export function CourseManagement({ courses, groups, users, onChanged }: CourseManagementProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const openForm = (course?: Course) => {
    setEditingId(course?.id);
    setName(course?.name || '');
    setIsOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await saveCourse(name.trim(), editingId);
      onChanged();
      setIsOpen(false);
      toast.success(editingId ? 'Nama mata kuliah diperbarui' : 'Mata kuliah ditambahkan');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan mata kuliah');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <CardTitle>Matakuliah</CardTitle>
          <CardDescription>Klik mata kuliah untuk melihat kelompok dan nama anggotanya.</CardDescription>
        </div>
        <Button onClick={() => openForm()} className="w-fit"><Plus />Tambah MK</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[480px] text-left text-sm">
            <caption className="sr-only">Daftar mata kuliah, jumlah kelompok, dan jumlah mahasiswa terdaftar</caption>
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">MK</th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">Jumlah Kelompok</th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">Jumlah Mahasiswa</th>
              </tr>
            </thead>
            <tbody>
              {courses.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-slate-500">Belum ada mata kuliah. Klik Tambah MK untuk membuatnya.</td></tr>}
              {courses.map(course => {
                const courseGroups = groups.filter(group => group.courseId === course.id);
                const expanded = expandedId === course.id;
                const toggle = () => setExpandedId(expanded ? null : course.id);
                return (
                  <React.Fragment key={course.id}>
                    <tr onClick={toggle} className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${expanded ? 'bg-primary/5' : ''}`}>
                      <th scope="row" className="px-4 py-3 font-medium">
                        <button type="button" aria-expanded={expanded} aria-controls={`course-details-${course.id}`}
                          onClick={event => { event.stopPropagation(); toggle(); }}
                          className="flex items-center gap-2 rounded text-left text-slate-900 focus-visible:outline-2 focus-visible:outline-primary">
                          {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                          {course.name}
                        </button>
                      </th>
                      <td className="px-4 py-3 text-center">{courseGroups.length}</td>
                      <td className="px-4 py-3 text-center">{new Set(course.members).size}</td>
                    </tr>
                    {expanded && <tr id={`course-details-${course.id}`}>
                      <td colSpan={3} className="border-t border-slate-100 bg-slate-50/50 p-4">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <h3 className="flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4" />Kelompok — {course.name}</h3>
                          <Button variant="outline" size="sm" onClick={() => openForm(course)}>Ubah Nama MK</Button>
                        </div>
                        {courseGroups.length === 0 ? (
                          <p className="py-4 text-slate-500">Belum ada kelompok pada mata kuliah ini.</p>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2">
                            {courseGroups.map(group => (
                              <section key={group.id} className="rounded-lg border border-slate-200 bg-white p-4">
                                <h4 className="font-semibold text-slate-900">{group.name}</h4>
                                <p className="mb-3 text-xs text-slate-500">{group.members.length} anggota</p>
                                {group.members.length === 0 ? <p className="text-slate-500">Belum ada anggota.</p> : (
                                  <ul className="list-inside list-disc space-y-1 text-slate-600">
                                    {group.members.map(id => <li key={id}>{users.find(user => user.uid === id)?.name || 'Nama mahasiswa belum tersedia'}</li>)}
                                  </ul>
                                )}
                              </section>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={isOpen} onOpenChange={open => { if (!saving) setIsOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Ubah Nama MK' : 'Tambah Matakuliah'}</DialogTitle>
            <DialogDescription>{editingId ? 'Perbarui nama mata kuliah ini.' : 'Masukkan nama mata kuliah baru.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="course-name" className="font-medium">Nama MK</label>
              <Input id="course-name" value={name} onChange={event => setName(event.target.value)}
                placeholder="Contoh: Pemrograman Web" maxLength={150} required disabled={saving} autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setIsOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Menyimpan...' : 'Simpan MK'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
