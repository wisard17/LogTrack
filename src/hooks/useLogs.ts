import { useState, useEffect } from 'react';
import { 
  db, 
  LogEntry, 
  ProjectGroup,
  OperationType, 
  handleFirestoreError
} from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  orderBy,
  User as FirebaseUser
} from 'firebase/firestore';

export function useLogs(user: any, isAdmin: boolean, isAuthReady: boolean, groups: ProjectGroup[]) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!user || !isAuthReady) {
        setLogs([]);
        return;
    }

    const userGroup = groups.find(g => g.members.includes(user.uid));
    
    let qLogs;
    if (isAdmin) {
      qLogs = query(collection(db, 'logs'), orderBy('weekNumber', 'desc'));
    } else if (userGroup) {
      qLogs = query(collection(db, 'logs'), where('groupId', '==', userGroup.id), orderBy('weekNumber', 'desc'));
    } else {
      qLogs = query(collection(db, 'logs'), where('studentId', '==', user.uid), orderBy('weekNumber', 'desc'));
    }

    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LogEntry[];
      setLogs(logsData);
    }, (error) => {
      if (error.message.includes('permission-denied')) {
        console.warn("Permission denied for logs query. This might be expected if user is not in a group yet.");
        setLogs([]);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'logs');
      }
    });

    return () => unsubLogs();
  }, [user, isAuthReady, isAdmin, groups]);

  return { logs, setLogs };
}
