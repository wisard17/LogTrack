import { useState, useEffect } from 'react';
import { 
  db, 
  ProjectGroup,
  UserProfile
} from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy
} from 'firebase/firestore';

export function useGroups(isAdmin: boolean) {
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const qGroups = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ProjectGroup[];
      setGroups(groupsData);
    });

    let unsubUsers = () => {};
    if (isAdmin) {
      const qUsers = query(collection(db, 'users'), orderBy('name', 'asc'));
      unsubUsers = onSnapshot(qUsers, (snapshot) => {
        const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
        setAllUsers(usersData);
      });
    }

    return () => {
      unsubGroups();
      unsubUsers();
    };
  }, [isAdmin]);

  return { groups, allUsers };
}
