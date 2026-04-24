export type UserRole = 'super_admin' | 'institute_admin' | 'faculty' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  instituteId?: string;
  instituteName?: string;
  batchId?: string;
  batchCode?: string;
  batchYear?: string;
  courseName?: string;
  code?: string;
  rollNo?: string;
  section?: string;
}

export interface Institute {
  id: string;
  name: string;
  email: string;
  phone: string;
  adminName: string;
  adminEmail: string;
  status: 'active' | 'suspended';
  totalBatches: number;
  totalStudents: number;
  totalFaculties: number;
  totalExams: number;
  riskScore: number;
  createdAt: string;
}

export interface Batch {
  id: string;
  name: string;
  department: string;
  year: string;
  totalStudents: number;
  totalExams: number;
  avgScore: number;
  riskSummary: 'low' | 'medium' | 'high';
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  duration: number;
  totalMarks: number;
  mode: 'online' | 'hybrid';
  status: 'draft' | 'scheduled' | 'live' | 'completed';
  batches: string[];
  proctors: string[];
  startDate: string;
  endDate: string;
  createdBy: string;
  totalQuestions: number;
}

export interface Question {
  id: string;
  type: 'mcq' | 'short_answer';
  text: string;
  options?: string[];
  correctAnswer: string;
  marks: number;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  batchId: string;
  batchName: string;
  enrollmentNo: string;
  status: 'active' | 'inactive';
}

export interface Faculty {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  batchIds: string[];
  status: 'active' | 'inactive';
}

export interface ProctoringSession {
  studentId: string;
  examId: string;
  studentName: string;
  status?: 'connected' | 'disconnected' | 'warning' | 'waiting';
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  faceDetected?: boolean;
  networkStrength?: 'strong' | 'moderate' | 'weak';
  progress?: number;
  violations?: Violation[];
}

export interface Violation {
  id: string;
  type: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface ExamResult {
  sessionId: string;
  studentId: string;
  studentName: string;
  examId: string;
  examTitle: string;
  score: number;
  totalMarks: number;
  percentage: number;
  violations: number;
  released: boolean;
}

export interface KPIData {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: string;
  colorIndex: 1 | 2 | 3 | 4 | 5 | 6;
  link?: string;
}
