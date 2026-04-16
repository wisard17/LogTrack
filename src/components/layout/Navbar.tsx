import React from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Settings, User as UserIcon } from 'lucide-react';
import { logout } from '../../firebase';
import { toast } from 'sonner';

interface NavbarProps {
  user: any;
  profile: any;
  isAdmin: boolean;
  view: 'student' | 'admin';
  setView: (view: 'student' | 'admin') => void;
}

export function Navbar({ user, profile, isAdmin, view, setView }: NavbarProps) {
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
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 h-16">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary p-1.5">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Logbook</span>
          </div>
          
          {isAdmin && (
            <div className="hidden rounded-lg border border-slate-200 bg-slate-50 p-1 sm:flex">
              <Button 
                variant={view === 'student' ? 'white' : 'ghost'} 
                size="sm" 
                className={`h-8 gap-2 ${view === 'student' ? 'shadow-sm' : ''}`}
                onClick={() => setView('student')}
              >
                Mahasiswa
              </Button>
              <Button 
                variant={view === 'admin' ? 'white' : 'ghost'} 
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

        <div className="flex items-center gap-4">
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
