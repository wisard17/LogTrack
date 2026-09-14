import { useState, useEffect } from 'react';
import type { LogEntry } from '../types';
import { toDate } from '@/lib/utils-date';
import { getLogsFromPostgres } from '../services/api';

export function useLogs(user: any, isAdmin: boolean, isAuthReady: boolean, revision: number, courseId: string) {
  const scope = JSON.stringify([user?.uid, isAdmin, courseId]);
  const [result, setResult] = useState<{ scope: string; logs: LogEntry[]; error: string }>({ scope: '', logs: [], error: '' });
  const enabled = Boolean(user && isAuthReady && courseId);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let busy = false;
    const fetchLogs = async () => {
      if (busy) return;
      busy = true;
      try {
        const logs = await getLogsFromPostgres(courseId, isAdmin ? undefined : user.uid);
        logs.sort((a: LogEntry, b: LogEntry) => b.weekNumber - a.weekNumber ||
          (toDate(b.timestamp)?.getTime() || 0) - (toDate(a.timestamp)?.getTime() || 0));
        if (active) setResult({ scope, logs, error: '' });
      } catch {
        if (active) setResult(previous => ({ scope,
          logs: previous.scope === scope ? previous.logs : [],
          error: 'Gagal memuat logbook mata kuliah ini. Data akan dicoba kembali.',
        }));
      } finally { busy = false; }
    };
    fetchLogs();
    // Group polling must not invalidate a slower log request. Skip ticks while busy.
    const timer = setInterval(fetchLogs, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [user?.uid, enabled, isAdmin, courseId, scope, revision]);
  const current = enabled && result.scope === scope;
  return {
    logs: current ? result.logs.filter(log => log.courseId === courseId) : [],
    error: current ? result.error : '',
    loading: enabled && !current,
  };
}
