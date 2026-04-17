import { useState, useEffect } from 'react';
import { 
  ProjectGroup,
  UserProfile
} from '../firebase';
import { getUsersFromPostgres, getGroupsFromPostgres } from '../services/api';

export function useGroups(isAdmin: boolean) {
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    // Ambil data dari Postgres
    const fetchData = async () => {
      try {
        const pgGroups = await getGroupsFromPostgres();
        setGroups(pgGroups);

        if (isAdmin) {
          const pgUsers = await getUsersFromPostgres();
          setAllUsers(pgUsers as UserProfile[]);
        }
      } catch (err) {
        console.error("Gagal mengambil data dari Postgres:", err);
      }
    };

    fetchData();
    
    // Refresh periodically for now since we don't have websocket/realtime for Postgres
    const interval = setInterval(fetchData, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [isAdmin]);

  return { groups, allUsers };
}
