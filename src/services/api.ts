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

export const API_BASE_URL = '';

let cachedCsrfToken: string | null = null;

async function getCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch('/csrf-token', { credentials: 'include' });
    const data = await res.json();
    cachedCsrfToken = data['X-CSRF-Token'];
    return cachedCsrfToken;
  } catch (error) {
    console.error('Gagal mengambil CSRF token:', error);
    return null;
  }
}

async function fetchWithCsrf(url: string, options: RequestInit = {}) {
  // Add CSRF token to all requests except /csrf-token
  if (url !== '/csrf-token') {
    const token = await getCsrfToken();
    if (token) {
      options.headers = {
        ...options.headers,
        'X-CSRF-Token': token
      };
    }
  }
  
  // allow credentials to send/receive cookies
  options.credentials = 'include';
  
  const res = await fetch(url, options);
  
  // If unauthorized due to CSRF (403), try to refresh token once
  if (res.status === 403 && url !== '/csrf-token') {
     cachedCsrfToken = null;
     const newToken = await getCsrfToken();
     if (newToken) {
       if (options.headers) {
         (options.headers as any)['X-CSRF-Token'] = newToken;
       }
       return fetch(url, options);
     }
  }
  
  return res;
}

export async function syncUserToPostgres(userData: UserProfile) {
  try {
    const res = await fetchWithCsrf('/mahasiswa', {
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
  
  const uploadRes = await fetchWithCsrf('/upload', {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error('Gagal mengunggah file ke server');
  }

  const result = await uploadRes.json();
  if (!result.url) {
    throw new Error('Response API upload tidak valid (missing url)');
  }
  return result;
}

export async function createLogEntry(logData: any, profile: UserProfile, group: ProjectGroup) {
  // Find student in Postgres by email
  const studentRes = await fetchWithCsrf(`/mahasiswa?email=eq.${profile.email}`);
  const students = await studentRes.json();
  const pgStudent = students[0];

  // Find group in Postgres by name
  const groupRes = await fetchWithCsrf(`/grup?nama=eq.${encodeURIComponent(group.name)}`);
  const groupsList = await groupRes.json();
  const pgGroup = groupsList[0];

  if (!pgStudent || !pgGroup) {
    throw new Error('Data mahasiswa atau kelompok tidak ditemukan di database PostgreSQL');
  }

  const res = await fetchWithCsrf('/logbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      week_number: logData.weekNumber,
      description: logData.description,
      evidence_url: logData.evidenceUrl,
      evidence_name: logData.evidenceName,
      evidence_type: logData.evidenceType,
      mahasiswa_id: pgStudent.id,
      grup_id: pgGroup.id
    })
  });

  if (!res.ok) {
    throw new Error('Gagal menyimpan logbook ke PostgreSQL');
  }

  return await res.json();
}

export async function getLogsFromPostgres(studentEmail?: string, isAdmin?: boolean, groupName?: string) {
  const res = await fetchWithCsrf('/logbook');
  if (!res.ok) throw new Error('Gagal mengambil data logbook');
  const allLogs = await res.json();

  // Map backend data to frontend format
  const mappedLogs = allLogs.map((log: any) => ({
    id: log.id,
    weekNumber: log.week_number,
    description: log.description,
    evidenceUrl: log.evidence_url,
    evidenceName: log.evidence_name,
    evidenceType: log.evidence_type,
    studentId: log.mahasiswa_id,
    groupId: log.grup_id,
    studentName: log.mahasiswa?.nama,
    timestamp: { seconds: new Date(log.created_at).getTime() / 1000, nanoseconds: 0 } // Mock Firebase timestamp for compatibility
  }));

  // Jika evidenceUrl adalah path lokal (misal /uploads/...), kita mungkin butuh mekanisme
  // untuk mengambilnya dengan CSRF jika backend memproteksinya.
  // Namun untuk saat ini kita biarkan karena browser <img src> tidak mendukung custom headers.

  if (isAdmin) return mappedLogs;
  
  // Filter by student email if needed, or by group
  // Assuming the backend might support filtering, but here we do it client side for now
  // based on the existing pattern.
  return mappedLogs; 
}

export async function getGroupsFromPostgres() {
  const res = await fetchWithCsrf('/grup?select=*,mahasiswa(*)');
  if (!res.ok) throw new Error('Gagal mengambil data grup');
  const groups = await res.json();
  
  return groups.map((g: any) => ({
    id: g.id.toString(),
    name: g.nama,
    members: g.mahasiswa?.map((m: any) => m.id) || []
  }));
}

export async function getUsersFromPostgres() {
  const res = await fetchWithCsrf('/mahasiswa');
  if (!res.ok) throw new Error('Gagal mengambil data mahasiswa');
  const users = await res.json();
  
  return users.map((u: any) => ({
    uid: u.id,
    name: u.nama,
    email: u.email,
    role: u.role,
    groupId: u.grup_id
  }));
}

export async function updateUserRoleInPostgres(uid: string, role: 'admin' | 'student') {
  const res = await fetchWithCsrf(`/mahasiswa?id=eq.${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: role })
  });
  if (!res.ok) throw new Error('Gagal memperbarui role mahasiswa di PostgreSQL');
  return true;
}

export async function createGroupInPostgres(name: string) {
  const res = await fetchWithCsrf('/grup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: name })
  });
  if (!res.ok) throw new Error('Gagal membuat grup di PostgreSQL');
  return await res.json();
}

export async function deleteGroupFromPostgres(id: string) {
  const res = await fetchWithCsrf(`/grup?id=${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Gagal menghapus grup dari PostgreSQL');
  return true;
}

export async function updateStudentGroupInPostgres(studentId: string, groupId: string | null) {
  const res = await fetchWithCsrf(`/mahasiswa?id=${studentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grup_id: groupId })
  });
  if (!res.ok) throw new Error('Gagal memperbarui grup mahasiswa di PostgreSQL');
  return true;
}

export async function deleteLogFromPostgres(logId: string) {
  const res = await fetchWithCsrf(`/logbook?id=${logId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Gagal menghapus logbook dari PostgreSQL');
  return true;
}
