import { 
  auth, 
  loginWithGoogle, 
  logout, 
  db, 
  UserProfile, 
  LogEntry, 
  ProjectGroup,
  OperationType, 
  handleFirestoreError,
  getAuthErrorMessage
} from '../firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

export const API_BASE_URL = 'http://localhost:8000';

export async function syncUserToPostgres(userData: UserProfile) {
  try {
    const res = await fetch(`${API_BASE_URL}/mahasiswa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: userData.name,
        email: userData.email,
        id: userData.uid,
        role: userData.role
      })
    });
    if (!res.ok) {
      const errorData = await res.json();
      console.error("Postgres sync error:", errorData);
    }
  } catch (err) {
    console.error("Failed to sync user to Postgres:", err);
  }
}

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  
  const uploadRes = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error('Gagal mengunggah file ke server');
  }

  return await uploadRes.json();
}

export async function createLogEntry(logData: any) {
  return await addDoc(collection(db, 'logs'), {
    ...logData,
    timestamp: serverTimestamp(),
  });
}

export async function syncLogToPostgres(logData: any, profile: UserProfile, group: ProjectGroup) {
  try {
    // Find student in Postgres by email
    const studentRes = await fetch(`${API_BASE_URL}/mahasiswa`);
    const students = await studentRes.json();
    const pgStudent = students.find((s: any) => s.email === profile.email);

    // Find group in Postgres by name
    const groupRes = await fetch(`${API_BASE_URL}/grup`);
    const groupsList = await groupRes.json();
    const pgGroup = groupsList.find((g: any) => g.nama === group.name);

    if (pgStudent && pgGroup) {
      await fetch(`${API_BASE_URL}/logbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_number: logData.weekNumber,
          description: logData.description,
          evidence_url: logData.evidenceUrl,
          evidence_name: logData.evidenceName,
          evidence_type: logData.evidenceType,
          mahasiswa_id: logData.studentId,
          grup_id: pgGroup.id
        })
      });
    }
  } catch (err) {
    console.error("Failed to sync logbook to Postgres:", err);
  }
}
