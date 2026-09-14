import React from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Settings, User as UserIcon } from 'lucide-react';
import { logout } from '../../firebase';
import type { Course } from '../../types';
import { toast } from 'sonner';

interface NavbarProps {
  courses: Course[];
  courseId: string;
  onCourseChange: (id: string) => void;
  user: any;
  profile: any;
  isAdmin: boolean;
  view: 'student' | 'admin';
  setView: (view: 'student' | 'admin') => void;
}

export function Navbar({ user, profile, isAdmin, view, setView, courses, courseId, onCourseChange }: NavbarProps) {
  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Berhasil keluar');
    } catch (error) {
      toast.error('Gagal keluar');
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 min-h-16 flex-wrap gap-3 py-2">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary p-1.5">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Logbook</span>
          </div>
          
          {isAdmin && (
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 sm:flex">
              <Button 
                variant={view === 'student' ? 'secondary' : 'ghost'}
                size="sm" 
                className={`h-8 gap-2 ${view === 'student' ? 'shadow-sm' : ''}`}
                onClick={() => setView('student')}
              >
                Mahasiswa
              </Button>
              <Button 
                variant={view === 'admin' ? 'secondary' : 'ghost'}
                size="sm" 
                className={`h-8 gap-2 ${view === 'admin' ? 'shadow-sm' : ''}`}
                onClick={() => setView('admin')}
              >
                <Settings className="h-4 w-4" />
                Admin
              </Button>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-4">
          {courses.length > 1 && !(isAdmin && view === 'admin') && (
            <select aria-label="Pilih mata kuliah" value={courseId} onChange={e => onCourseChange(e.target.value)}
              className="max-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:max-w-[240px]">
              {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          )}
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-sm font-semibold text-slate-900">{profile?.name}</span>
            <span className="text-xs text-slate-500">{user?.email}</span>
          </div>
          <div className="h-10 w-10 rounded-full bg-slate-100 p-0.5 ring-2 ring-slate-100">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="h-full w-full rounded-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserIcon className="h-5 w-5" />
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-500 hover:text-destructive">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
