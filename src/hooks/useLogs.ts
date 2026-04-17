import { useState, useEffect } from 'react';
import { 
  LogEntry, 
  ProjectGroup
} from '../firebase';
import { toDate } from '@/lib/utils-date';
import { getLogsFromPostgres } from '../services/api';

export function useLogs(user: any, isAdmin: boolean, isAuthReady: boolean, groups: ProjectGroup[]) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!user || !isAuthReady) {
        setLogs([]);
        return;
    }

    const fetchLogs = async () => {
      try {
        const userGroup = groups.find(g => g.members.includes(user.uid));
        const pgLogs = await getLogsFromPostgres(user.email, isAdmin, userGroup?.name);
        
        // Filter di sisi klien jika API belum mendukung filter spesifik
        let filteredLogs = [...pgLogs];
        if (!isAdmin) {
          if (userGroup) {
            filteredLogs = pgLogs.filter(log => log.groupId === userGroup.id);
          } else {
            filteredLogs = pgLogs.filter(log => log.studentId === user.uid);
          }
        }
        
        // Urutkan berdasarkan weekNumber desc
        filteredLogs.sort((a, b) => {
          const weekDiff = b.weekNumber - a.weekNumber;
          if (weekDiff !== 0) return weekDiff;
          
          // Jika minggu sama, urutkan berdasarkan timestamp desc secara aman
          const dateA = toDate(a.timestamp)?.getTime() || 0;
          const dateB = toDate(b.timestamp)?.getTime() || 0;
          return dateB - dateA;
        });
        
        setLogs(filteredLogs);
      } catch (err) {
        console.error("Gagal mengambil log dari Postgres:", err);
      }
    };

    fetchLogs();
  }, [user, isAuthReady, isAdmin, groups]);

  return { logs, setLogs };
}
