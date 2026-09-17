import { useState, useEffect, useCallback } from 'react';
import type { Course, ProjectGroup, UserProfile } from '../types';
import { getUsersFromPostgres, getGroupsFromPostgres, getCourses } from '../services/api';

export function useGroups(userId: string | undefined, isAdmin: boolean, ready: boolean) {
  const [data, setData] = useState<{ owner?: string; groups: ProjectGroup[]; allUsers: UserProfile[]; courses: Course[] }>({ groups: [], allUsers: [], courses: [] });
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(n => n + 1), []);
  useEffect(() => {
    if (!userId || !ready) return;
    let active = true;
    let busy = false;
    const fetchData = async () => {
      if (busy) return;
      busy = true;
      try {
        const [groups, courses, allUsers] = await Promise.all([
          getGroupsFromPostgres(), getCourses(),
          isAdmin ? getUsersFromPostgres() : Promise.resolve([]),
        ]);
        // Include courses with groups so students can join before they are enrolled.
        const visibleCourses = isAdmin ? courses : courses
          .filter(course => course.members.includes(userId) || groups.some(group => group.courseId === course.id))
          .sort((a, b) => Number(b.members.includes(userId)) - Number(a.members.includes(userId)));
        if (active) { setData({ owner: userId, groups, courses: visibleCourses, allUsers }); setError(''); }
      } catch {
        if (active) setError('Gagal memuat mata kuliah. Periksa koneksi Anda atau coba lagi nanti.');
      } finally { busy = false; }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [userId, isAdmin, ready, revision]);
  const current = data.owner === userId && ready;
  return { groups: current ? data.groups : [], allUsers: current ? data.allUsers : [], courses: current ? data.courses : [], error, refresh, revision };
}
