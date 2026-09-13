import { Course, UserProfile, ProjectGroup } from '../firebase';

export const API_BASE_URL = '';

let cachedCsrfToken: string | null = null;
let pendingCsrfToken: Promise<string | null> | null = null;

async function getCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  if (!pendingCsrfToken) {
    pendingCsrfToken = fetch('/csrf-token', { credentials: 'include' }).then(async res => {
      if (!res.ok) throw new Error('Gagal mengambil CSRF token');
      const data = await res.json();
      cachedCsrfToken = data['X-CSRF-Token'];
      return cachedCsrfToken;
    }).finally(() => { pendingCsrfToken = null; });
  }
  return pendingCsrfToken;
}

export async function fetchWithCsrf(url: string, options: RequestInit = {}) {
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
  const res = await fetchWithCsrf('/logbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      week_number: logData.weekNumber,
      description: logData.description,
      evidence_url: logData.evidenceUrl,
      evidence_name: logData.evidenceName,
      evidence_type: logData.evidenceType,
      mahasiswa_id: profile.uid,
      grup_id: group.id,
      matakuliah_id: group.courseId
    })
  });

  if (!res.ok) {
    throw new Error('Gagal menyimpan logbook ke PostgreSQL');
  }

  return await res.json();
}

export async function getLogsFromPostgres(courseId: string, studentId?: string) {
  const res = await fetchWithCsrf(`/logbook?matakuliah_id=${encodeURIComponent(courseId)}${studentId ? `&mahasiswa_id=${encodeURIComponent(studentId)}` : ''}`);
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
    courseId: log.matakuliah_id,
    studentName: log.mahasiswa?.nama,
    timestamp: { seconds: new Date(log.created_at).getTime() / 1000, nanoseconds: 0 } // Mock Firebase timestamp for compatibility
  }));

  return mappedLogs; 
}

export async function getGroupsFromPostgres() {
  const res = await fetchWithCsrf('/grup?select=*,mahasiswa(*)');
  if (!res.ok) throw new Error('Gagal mengambil data grup');
  const groups = await res.json();
  
  return groups.map((g: any) => ({
    id: g.id.toString(),
    name: g.nama,
    courseId: g.matakuliah_id,
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

export async function createGroupInPostgres(name: string, courseId: string) {
  const res = await fetchWithCsrf('/grup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: name, matakuliah_id: courseId })
  });
  if (!res.ok) throw new Error('Gagal membuat grup di PostgreSQL');
  return await res.json();
}

export async function deleteGroupFromPostgres(id: string) {
  const res = await fetchWithCsrf(`/grup/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Gagal menghapus grup dari PostgreSQL');
  return true;
}

export async function updateStudentGroupInPostgres(studentId: string, groupId: string | null, courseId: string) {
  const res = await fetchWithCsrf(`/matakuliah/${courseId}/peserta/${encodeURIComponent(studentId)}`, {
    method: 'PUT',
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

export async function getCourses(studentId?: string): Promise<Course[]> {
  const res = await fetchWithCsrf('/matakuliah' + (studentId ? '?mahasiswa_id=' + encodeURIComponent(studentId) : ''));
  if (!res.ok) throw new Error('Gagal mengambil mata kuliah');
  return (await res.json()).map((c: any) => ({ id: c.id, name: c.nama, members: c.members }));
}

export async function saveCourse(name: string, id?: string) {
  const res = await fetchWithCsrf(id ? '/matakuliah/' + id : '/matakuliah', {
    method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: name.trim() }),
  });
  if (!res.ok) throw new Error('Gagal menyimpan mata kuliah. Pastikan nama belum digunakan.');
  return res.json();
}
