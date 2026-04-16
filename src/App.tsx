import React, { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useLogs } from './hooks/useLogs';
import { useGroups } from './hooks/useGroups';

// Components
import { LoginForm } from './components/auth/LoginForm';
import { Navbar } from './components/layout/Navbar';
import { StudentDashboard } from './components/student/StudentDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';

export default function App() {
  const { user, profile, loading, isAuthReady, isAdmin } = useAuth();
  const { groups, allUsers } = useGroups(isAdmin);
  const { logs } = useLogs(user, isAdmin, isAuthReady, groups);
  
  const [view, setView] = useState<'student' | 'admin'>('student');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="animate-pulse text-sm font-medium text-slate-500">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginForm />
        <Toaster position="top-center" />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      <Navbar 
        user={user} 
        profile={profile} 
        isAdmin={isAdmin} 
        view={view} 
        setView={setView} 
      />

      <main className="mx-auto max-w-7xl px-4 py-8">
        {isAdmin && view === 'admin' ? (
          <AdminDashboard 
            logs={logs} 
            groups={groups} 
            allUsers={allUsers} 
          />
        ) : (
          <StudentDashboard 
            user={user} 
            profile={profile} 
            logs={logs} 
            groups={groups} 
          />
        )}
      </main>
      
      <Toaster position="top-center" />
    </div>
  );
}
