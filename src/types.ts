export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  projectTitle?: string;
  role?: 'admin' | 'student';
  createdAt?: string;
}

export interface Course {
  active?: boolean;
  id: string;
  name: string;
  members: string[];
}

export interface LogEntry {
  courseId: string;
  id?: string;
  weekNumber: number;
  description: string;
  evidenceUrl: string;
  evidenceName?: string;
  evidenceType?: string;
  studentId: string;
  studentName: string;
  groupId: string;
  timestamp: string;
}

export interface ProjectGroup {
  courseId: string;
  id?: string;
  name: string;
  members: string[]; // Array of student UIDs
  createdAt?: string;
}

