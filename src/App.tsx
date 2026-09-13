import React, { useState, useMemo } from 'react';
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
  const { groups: allGroups, allUsers, courses, error, refresh, revision } = useGroups(user?.uid, isAdmin, isAuthReady);
  const [selection, setSelection] = useState({ userId: '', courseId: '' });
  const courseId = selection.userId === user?.uid && courses.some(c => c.id === selection.courseId)
    ? selection.courseId : courses[0]?.id || '';
  const groups = useMemo(() => allGroups.filter(g => g.courseId === courseId), [allGroups, courseId]);
  const { logs, error: logsError, loading: logsLoading } = useLogs(user, isAdmin, isAuthReady, revision, courseId);
  
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
        courses={courses}
        courseId={courseId}
        onCourseChange={(id) => setSelection({ userId: user.uid, courseId: id })}
        user={user} 
        profile={profile} 
        isAdmin={isAdmin} 
        view={view} 
        setView={setView} 
      />

      <main className="mx-auto max-w-7xl px-4 py-8">
        {(error || logsError) && <p role="alert" className="mb-4 text-red-600">{error || logsError}</p>}
        <div key={user.uid}>
        {isAdmin && view === 'admin' ? (
          <AdminDashboard
            logsLoading={logsLoading}
            logsError={logsError}
            allGroups={allGroups}
            courses={courses}
            onCourseChange={(id) => setSelection({ userId: user.uid, courseId: id })}
            courseId={courseId}
            courseName={courses.find(c => c.id === courseId)?.name || ''}
            onChanged={refresh}
            logs={logs} 
            groups={groups} 
            allUsers={allUsers} 
          />
        ) : (
          <div key={courseId}><StudentDashboard
            courseName={courses.find(c => c.id === courseId)?.name}
            onChanged={refresh}
            user={user} 
            profile={profile} 
            logs={logs} 
            groups={groups} 
          /></div>
        )}
        </div>
      </main>
      
      <Toaster position="top-center" />
    </div>
  );
}
