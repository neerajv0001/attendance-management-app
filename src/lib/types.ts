export enum UserRole {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}

export interface User {
  id: string;
  username: string; // Student ID or Email for teacher/admin
  passwordHash: string;
  role: UserRole;
  name: string;
  email?: string;
  phone?: string;
  isApproved?: boolean; // For teachers
  subject?: string; // For teachers
  qualification?: string; // For teachers
  experience?: string; // For teachers
  department?: string; // For students (Course name)
  courseId?: string; // For teachers (selected course id)
  createdAt: string;
}

export interface Student extends User {
  role: UserRole.STUDENT;
  attendance: AttendanceRecord[];
}

export interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  status: 'PRESENT' | 'ABSENT';
  studentId: string;
  teacherId?: string;
  subject?: string;
  teacherName?: string;
}

export interface TimetableEntry {
  id: string;
  subject: string;
  day: string; // Monday, Tuesday...
  startTime: string;
  endTime: string;
  teacherId: string;
  isCancelled?: boolean;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface Course {
  id: string;
  name: string;
  subjects: string[];
}

export interface Notice {
  id: string;
  title: string;
  message: string;
  authorId?: string;
  createdAt: string;
}
