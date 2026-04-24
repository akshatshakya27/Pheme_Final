import { Batch, Exam, ExamResult, Faculty, Institute, ProctoringSession, Question, User, UserRole } from '@/types';

const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined)
)?.replace(/\/$/, '') || '/api';
const ACCESS_TOKEN_KEY = 'proctorx_access_token';

type LoginPortal = 'student' | 'institute' | 'dev';

interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  role: string;
}

interface BackendUser {
  id: string;
  institute_id?: string | null;
  batch_id?: string | null;
  batch_code?: string | null;
  batch_year?: string | null;
  course_name?: string | null;
  name?: string | null;
  email: string;
  role: string;
  code?: string | null;
  roll_no?: string | null;
  section?: string | null;
}

interface BackendInstitute {
  id: string;
  institute_code: string;
  name: string;
  address?: string | null;
  contact_email?: string | null;
  created_at?: string | null;
}

interface BackendInstituteOverview {
  institute: {
    id: string;
    institute_code: string;
    name: string;
    address?: string | null;
    contact_email?: string | null;
    created_at?: string | null;
  };
  counts: {
    admins: number;
    faculties: number;
    batches: number;
    students: number;
    exams: number;
    sessions: number;
    violations: number;
  };
  admins: Array<{
    id: string;
    name: string;
    email: string;
    emp_id: string;
    admin_code?: string | null;
    created_at?: string | null;
  }>;
  faculties: Array<{
    id: string;
    name: string;
    email: string;
    dept_code: string;
    emp_id: string;
    faculty_code?: string | null;
    created_at?: string | null;
  }>;
  batches: Array<{
    id: string;
    batch_code?: string | null;
    course_code: string;
    batch_year: string;
    course_name: string;
    created_at?: string | null;
  }>;
  students: Array<{
    id: string;
    name: string;
    email: string;
    batch_id: string;
    section: string;
    roll_no: string;
    student_code?: string | null;
    created_at?: string | null;
  }>;
  exams: Array<{
    id: string;
    title: string;
    subject_code: string;
    exam_type: string;
    exam_year: string;
    duration_minutes: number;
    passing_marks: number;
    scheduled_time?: string | null;
    end_time?: string | null;
  }>;
  sessions: Array<{
    id: string;
    exam_id: string;
    student_id: string;
    status: string;
    score?: number | null;
    violation_found?: boolean;
    started_at?: string | null;
    completed_at?: string | null;
  }>;
}

interface BackendFaculty {
  id: string;
  institute_id: string;
  name: string;
  dept_code: string;
  emp_id: string;
  email: string;
}

interface BackendBatch {
  id: string;
  institute_id: string;
  course_code: string;
  batch_year: string;
  batch_code?: string | null;
  course_name: string;
  name: string;
  members: string[];
}

interface BackendExam {
  id: string;
  institute_id: string;
  faculty_id: string;
  subject_code: string;
  exam_type: string;
  exam_year: string;
  exam_code?: string | null;
  title: string;
  duration_minutes: number;
  passing_marks: number;
  scheduled_time?: string | null;
  end_time?: string | null;
}

interface BackendSession {
  id: string;
  institute_id?: string | null;
  student_id: string;
  student_code?: string | null;
  student_name?: string | null;
  exam_id: string;
  exam_code?: string | null;
  exam_title?: string | null;
  score?: number | null;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  violation_found?: boolean;
  violation_count?: number | null;
  mongo_log_ref?: string | null;
  violation_logs_id?: string | null;
}

interface BackendAssignment {
  id: string;
  institute_id?: string | null;
  exam_id: string;
  batch_id: string;
}

interface BackendQuestion {
  id: string;
  exam_id: string;
  type?: string;
  text: string;
  marks: number;
  data?: {
    options?: string[];
    correct_answer?: string;
  };
}

interface BackendProctoringLog {
  id: string;
  exam_id: string;
  student_id: string;
  action: string;
  remark?: string | null;
  mode?: string | null;
  proctor_id?: string | null;
  proctor_email?: string | null;
  created_at: string;
}

interface BackendProctorMessage {
  id: string;
  session_id: string;
  sender: string;
  message: string;
  timestamp: string;
}

function normalizeBackendRole(role: string): UserRole {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'institute_admin') return 'institute_admin';
  if (role === 'student') return 'student';
  return 'faculty';
}

function computeExamStatus(scheduledAt?: string | null, endAt?: string | null): Exam['status'] {
  if (!scheduledAt) return 'draft';
  const now = Date.now();
  const start = new Date(scheduledAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : Number.NaN;
  if (!Number.isNaN(end) && now > end) return 'completed';
  if (now >= start && (Number.isNaN(end) || now <= end)) return 'live';
  return 'scheduled';
}

function mapUser(payload: BackendUser): User {
  return {
    id: payload.id,
    name: payload.name || payload.email,
    email: payload.email,
    role: normalizeBackendRole(payload.role),
    instituteId: payload.institute_id || undefined,
    batchId: payload.batch_id || undefined,
    batchCode: payload.batch_code || undefined,
    batchYear: payload.batch_year || undefined,
    courseName: payload.course_name || undefined,
    code: payload.code || undefined,
    rollNo: payload.roll_no || undefined,
    section: payload.section || undefined,
  };
}

function mapInstitute(row: BackendInstitute): Institute {
  return {
    id: row.id,
    name: row.name,
    email: row.contact_email || '',
    phone: row.address || '',
    adminName: '',
    adminEmail: '',
    status: 'active',
    totalBatches: 0,
    totalStudents: 0,
    totalFaculties: 0,
    totalExams: 0,
    riskScore: 0,
    createdAt: row.created_at ? row.created_at.split('T')[0] : '',
  };
}

function mapFaculty(row: BackendFaculty): Faculty {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.dept_code,
    designation: 'Faculty',
    batchIds: [],
    status: 'active',
  };
}

function mapBatch(row: BackendBatch): Batch {
  return {
    id: row.id,
    name: row.batch_code || row.name,
    department: row.course_code,
    year: row.batch_year,
    totalStudents: row.members.length,
    totalExams: 0,
    avgScore: 0,
    riskSummary: 'low',
  };
}

function mapExam(row: BackendExam): Exam {
  return {
    id: row.id,
    title: row.title,
    description: `${row.subject_code} · ${row.exam_type}`,
    duration: row.duration_minutes,
    totalMarks: row.passing_marks,
    mode: 'online',
    status: computeExamStatus(row.scheduled_time, row.end_time),
    batches: [],
    proctors: [row.faculty_id],
    startDate: row.scheduled_time || '',
    endDate: row.end_time || '',
    createdBy: row.faculty_id,
    totalQuestions: 0,
  };
}

function mapSessionToResult(row: BackendSession, examById: Record<string, Exam>): ExamResult {
  const exam = examById[row.exam_id];
  let totalMarks = exam?.totalMarks || 100;
  const rawScore = row.score ?? 0;
  let score = Math.max(0, rawScore);

  // Legacy/seeded rows may store score as percentage (0-100) while exam.totalMarks
  // may be mapped from passing marks (e.g., 40/50). Normalize to avoid >100% output.
  let percentage = 0;
  if (totalMarks > 0 && score > totalMarks) {
    totalMarks = 100;
    score = Math.min(score, 100);
    percentage = Math.round(score);
  } else {
    percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  }

  percentage = Math.min(Math.max(percentage, 0), 100);

  return {
    sessionId: row.id,
    studentId: row.student_id,
    studentName: row.student_name || row.student_code || 'Student',
    examId: row.exam_id,
    examTitle: row.exam_title || exam?.title || row.exam_code || 'Exam',
    score,
    totalMarks,
    percentage,
    violations: row.violation_logs_id ? 1 : 0,
    released: row.status === 'completed',
  };
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const err = await response.json();
      detail = err.detail || detail;
    } catch {
      // no-op
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function loginRequest(email: string, password: string, portal: LoginPortal): Promise<TokenResponse> {
  const loginWithRole = async (role: 'student' | 'proctor' | 'admin') => {
    const body = new FormData();
    body.append('email', email);
    body.append('password', password);
    body.append('role', role);
    return apiRequest<TokenResponse>('/login', { method: 'POST', body });
  };

  if (portal === 'student') {
    return loginWithRole('student');
  }

  if (portal === 'dev') {
    return loginWithRole('admin');
  }

  // Institute portal supports both proctor(faculty) and admins.
  try {
    return await loginWithRole('proctor');
  } catch {
    return loginWithRole('admin');
  }
}

export async function getMe(): Promise<User> {
  const me = await apiRequest<BackendUser>('/me');
  return mapUser(me);
}

export async function listInstitutes(): Promise<Institute[]> {
  const [rows, users, faculties, batches, exams, sessions] = await Promise.all([
    apiRequest<BackendInstitute[]>('/institutes/'),
    listUsers().catch(() => []),
    apiRequest<BackendFaculty[]>('/faculties/').catch(() => []),
    apiRequest<BackendBatch[]>('/batches/').catch(() => []),
    apiRequest<BackendExam[]>('/exams/').catch(() => []),
    apiRequest<BackendSession[]>('/sessions/').catch(() => []),
  ]);

  return rows.map((row) => {
    const instituteAdmins = users.filter((user) => user.role === 'institute_admin' && user.institute_id === row.id);
    const primaryAdmin = instituteAdmins[0];
    const instituteBatches = batches.filter((batch) => batch.institute_id === row.id);
    const instituteUsers = users.filter((user) => user.institute_id === row.id);
    const instituteFaculties = faculties.filter((faculty) => faculty.institute_id === row.id);
    const instituteExams = exams.filter((exam) => exam.institute_id === row.id);
    const instituteSessions = sessions.filter((session) => session.institute_id === row.id);
    const violations = instituteSessions.filter((session) => session.violation_found).length;
    const riskScore = instituteSessions.length ? Math.round((violations / instituteSessions.length) * 100) : 0;

    return {
      ...mapInstitute(row),
      adminName: primaryAdmin?.name || 'Not assigned',
      adminEmail: primaryAdmin?.email || '',
      totalBatches: instituteBatches.length,
      totalStudents: instituteUsers.filter((user) => user.role === 'student').length,
      totalFaculties: instituteFaculties.length,
      totalExams: instituteExams.length,
      riskScore,
    };
  });
}

export async function createInstitute(payload: {
  instituteCode: string;
  name: string;
  address?: string;
  contactEmail?: string;
}): Promise<Institute> {
  const row = await apiRequest<BackendInstitute>('/institutes/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      institute_code: payload.instituteCode,
      name: payload.name,
      address: payload.address || null,
      contact_email: payload.contactEmail || null,
    }),
  });
  return mapInstitute(row);
}

export async function updateInstitute(
  instituteId: string,
  payload: { name?: string; address?: string; contactEmail?: string }
): Promise<Institute> {
  const row = await apiRequest<BackendInstitute>(`/institutes/${instituteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      address: payload.address,
      contact_email: payload.contactEmail,
    }),
  });
  return mapInstitute(row);
}

export async function deleteInstitute(payload: { instituteId: string; confirmDelete: boolean; password: string }): Promise<void> {
  await apiRequest<void>(`/institutes/${payload.instituteId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      confirm_delete: payload.confirmDelete,
      password: payload.password,
    }),
  });
}

export async function resetInstituteAdminPassword(payload: {
  instituteId: string;
  newPassword: string;
  adminEmail?: string;
}): Promise<number> {
  const row = await apiRequest<{ updated: number }>(`/institutes/${payload.instituteId}/admin-password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      new_password: payload.newPassword,
      admin_email: payload.adminEmail || undefined,
    }),
  });
  return row.updated;
}

export async function getInstituteOverview(instituteId: string): Promise<BackendInstituteOverview> {
  return apiRequest<BackendInstituteOverview>(`/institutes/${instituteId}/overview`);
}

export async function importInstituteAdmins(
  instituteId: string,
  rows: Array<{ name: string; email: string; password: string; empId?: string }>
): Promise<{ created: number }> {
  return apiRequest<{ created: number }>(`/institutes/${instituteId}/admins/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      admins: rows.map((row) => ({
        name: row.name,
        email: row.email,
        password: row.password,
        emp_id: row.empId || undefined,
      })),
    }),
  });
}

export async function createUser(payload: {
  instituteId?: string;
  batchId?: string;
  name: string;
  email: string;
  password: string;
  role: 'institute_admin' | 'exam_admin' | 'student';
  empId?: string;
  deptCode?: string;
  section?: string;
  rollNo?: string;
}): Promise<void> {
  await apiRequest('/users/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      institute_id: payload.instituteId,
      batch_id: payload.batchId,
      name: payload.name,
      email: payload.email,
      password: payload.password,
      role: payload.role,
      emp_id: payload.empId,
      dept_code: payload.deptCode,
      section: payload.section,
      roll_no: payload.rollNo,
    }),
  });
}

export async function listUsers(): Promise<BackendUser[]> {
  return apiRequest<BackendUser[]>('/users/');
}

export async function listFaculties(): Promise<Faculty[]> {
  const rows = await apiRequest<BackendFaculty[]>('/faculties/');
  return rows.map(mapFaculty);
}

export async function createFaculty(payload: {
  instituteId: string;
  name: string;
  email: string;
  deptCode: string;
  empId: string;
}): Promise<Faculty> {
  const row = await apiRequest<BackendFaculty>('/faculties/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      institute_id: payload.instituteId,
      name: payload.name,
      email: payload.email,
      dept_code: payload.deptCode,
      emp_id: payload.empId,
    }),
  });
  return mapFaculty(row);
}

export async function importFaculties(
  rows: Array<{ name: string; email: string; deptCode: string; empId?: string }>
): Promise<{ created: number }> {
  return apiRequest<{ created: number }>('/faculties/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      faculties: rows.map((row) => ({
        name: row.name,
        email: row.email,
        dept_code: row.deptCode,
        emp_id: row.empId || undefined,
      })),
    }),
  });
}

export async function updateFaculty(
  facultyId: string,
  payload: { name?: string; email?: string; deptCode?: string }
): Promise<Faculty> {
  const row = await apiRequest<BackendFaculty>(`/faculties/${facultyId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      dept_code: payload.deptCode,
    }),
  });
  return mapFaculty(row);
}

export async function hardDeleteFaculty(payload: { facultyId: string; confirmDelete: boolean; password: string }): Promise<void> {
  await apiRequest<void>(`/faculties/${payload.facultyId}/hard-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      confirm_delete: payload.confirmDelete,
      password: payload.password,
    }),
  });
}

export async function listBatches(): Promise<Batch[]> {
  const [rows, assignments, sessions, users] = await Promise.all([
    apiRequest<BackendBatch[]>('/batches/'),
    apiRequest<BackendAssignment[]>('/assignments/').catch(() => []),
    apiRequest<BackendSession[]>('/sessions/').catch(() => []),
    listUsers().catch(() => []),
  ]);

  const studentBatchById: Record<string, string> = {};
  users.forEach((user) => {
    if (user.role === 'student' && user.batch_id) {
      studentBatchById[user.id] = user.batch_id;
    }
  });

  return rows.map((row) => {
    const mapped = mapBatch(row);
    const assignedExams = new Set(assignments.filter((item) => item.batch_id === row.id).map((item) => item.exam_id));
    const batchSessions = sessions.filter((session) => studentBatchById[session.student_id] === row.id);
    const scored = batchSessions.filter((session) => typeof session.score === 'number');
    const avgScore = scored.length
      ? Math.round(scored.reduce((sum, session) => sum + (session.score || 0), 0) / scored.length)
      : 0;
    const violationRate = batchSessions.length
      ? (batchSessions.filter((session) => session.violation_found).length / batchSessions.length) * 100
      : 0;
    const riskSummary: Batch['riskSummary'] = violationRate > 20 ? 'high' : violationRate > 8 ? 'medium' : 'low';

    return {
      ...mapped,
      totalExams: assignedExams.size,
      avgScore,
      riskSummary,
    };
  });
}

export async function createBatch(payload: {
  instituteId?: string;
  courseCode: string;
  batchYear: string;
  courseName: string;
}): Promise<Batch> {
  const row = await apiRequest<BackendBatch>('/batches/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      institute_id: payload.instituteId,
      course_code: payload.courseCode,
      batch_year: payload.batchYear,
      course_name: payload.courseName,
      members: [],
    }),
  });
  return mapBatch(row);
}

export async function updateBatch(
  batchId: string,
  payload: { courseName?: string; courseCode?: string; batchYear?: string }
): Promise<Batch> {
  const row = await apiRequest<BackendBatch>(`/batches/${batchId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      course_name: payload.courseName,
      course_code: payload.courseCode,
      batch_year: payload.batchYear,
    }),
  });
  return mapBatch(row);
}

export async function hardDeleteBatch(payload: { batchId: string; confirmDelete: boolean; password: string }): Promise<void> {
  await apiRequest<void>(`/batches/${payload.batchId}/hard-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      confirm_delete: payload.confirmDelete,
      password: payload.password,
    }),
  });
}

export async function importBatches(
  rows: Array<{ courseName: string; courseCode: string; batchYear: string }>
): Promise<{ created: number }> {
  return apiRequest<{ created: number }>('/batches/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batches: rows.map((row) => ({
        course_name: row.courseName,
        course_code: row.courseCode,
        batch_year: row.batchYear,
      })),
    }),
  });
}

export async function updateStudent(
  studentId: string,
  payload: { name?: string; email?: string; batchId?: string; section?: string; rollNo?: string }
): Promise<BackendUser> {
  return apiRequest<BackendUser>(`/students/${studentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      batch_id: payload.batchId,
      section: payload.section,
      roll_no: payload.rollNo,
    }),
  });
}

export async function hardDeleteStudent(payload: { studentId: string; confirmDelete: boolean; password: string }): Promise<void> {
  await apiRequest<void>(`/students/${payload.studentId}/hard-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      confirm_delete: payload.confirmDelete,
      password: payload.password,
    }),
  });
}

export async function importStudents(
  rows: Array<{ name: string; email: string; batchCode?: string; batchId?: string; section: string; rollNo: string; password?: string }>
): Promise<{ created: number }> {
  return apiRequest<{ created: number }>('/students/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      students: rows.map((row) => ({
        name: row.name,
        email: row.email,
        batch_code: row.batchCode || undefined,
        batch_id: row.batchId || undefined,
        section: row.section,
        roll_no: row.rollNo,
        password: row.password || undefined,
      })),
    }),
  });
}

export async function listExams(): Promise<Exam[]> {
  const rows = await apiRequest<BackendExam[]>('/exams/');
  return rows.map(mapExam);
}

export async function listExamsWithActivity(): Promise<Exam[]> {
  const rows = await apiRequest<BackendExam[]>('/exams/');
  const activeExamIds = await apiRequest<BackendSession[]>('/sessions/')
    .then((sessions) => new Set(sessions.filter((session) => session.status === 'in_progress').map((session) => session.exam_id)))
    .catch(() => new Set<string>());

  return rows.map((row) => {
    const exam = mapExam(row);
    if (activeExamIds.has(exam.id)) {
      return { ...exam, status: 'live' };
    }
    return exam;
  });
}

export async function listMyAssignments(): Promise<Exam[]> {
  const rows = await apiRequest<Array<{ exam: BackendExam }>>('/assignments/me');
  return rows.map((row) => mapExam(row.exam));
}

export async function listMySessions(): Promise<BackendSession[]> {
  return apiRequest<BackendSession[]>('/sessions/me/details');
}

export async function createExam(payload: {
  title: string;
  subjectCode: string;
  examType: string;
  examYear: string;
  duration: number;
  passingMarks: number;
  scheduledTime?: string;
  endTime?: string;
}): Promise<Exam> {
  const row = await apiRequest<BackendExam>('/exams/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: payload.title,
      subject_code: payload.subjectCode,
      exam_type: payload.examType,
      exam_year: payload.examYear,
      duration: payload.duration,
      passing_marks: payload.passingMarks,
      scheduled_time: payload.scheduledTime || null,
      end_time: payload.endTime || null,
    }),
  });
  return mapExam(row);
}

export async function updateExam(
  examId: string,
  payload: { title?: string; duration?: number; passingMarks?: number; scheduledTime?: string; endTime?: string }
): Promise<Exam> {
  const row = await apiRequest<BackendExam>(`/exams/${examId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: payload.title,
      duration: payload.duration,
      passing_marks: payload.passingMarks,
      scheduled_time: payload.scheduledTime,
      end_time: payload.endTime,
    }),
  });
  return mapExam(row);
}

export async function hardDeleteExam(payload: { examId: string; confirmDelete: boolean; password: string }): Promise<void> {
  await apiRequest<void>(`/exams/${payload.examId}/hard-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      confirm_delete: payload.confirmDelete,
      password: payload.password,
    }),
  });
}

export async function createQuestion(payload: {
  examId: string;
  text: string;
  marks: number;
  options: string[];
  correctAnswer: string;
}): Promise<void> {
  await apiRequest('/questions/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exam_id: payload.examId,
      text: payload.text,
      marks: payload.marks,
      data: {
        options: payload.options,
        correct_answer: payload.correctAnswer,
      },
    }),
  });
}

export async function listQuestionsForExam(examId: string): Promise<Question[]> {
  const rows = await apiRequest<BackendQuestion[]>(`/questions/exam/${examId}`);
  return rows.map((row) => ({
    id: row.id,
    type: row.type?.toLowerCase() === 'short_answer' ? 'short_answer' : 'mcq',
    text: row.text,
    options: row.data?.options || [],
    correctAnswer: row.data?.correct_answer || '',
    marks: row.marks,
  }));
}

export async function createAssignment(examId: string, batchId: string): Promise<void> {
  await apiRequest('/assignments/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exam_id: examId, batch_id: batchId }),
  });
}

export async function listFacultyResults(): Promise<ExamResult[]> {
  const [sessions, exams] = await Promise.all([
    apiRequest<BackendSession[]>('/sessions/'),
    listExams(),
  ]);
  const examById: Record<string, Exam> = {};
  exams.forEach((exam) => {
    examById[exam.id] = exam;
  });
  return sessions.map((row) => mapSessionToResult(row, examById));
}

export async function listStudentResults(): Promise<ExamResult[]> {
  const rows = await apiRequest<BackendSession[]>('/sessions/me/details');
  const exams = await listMyAssignments().catch(() => []);
  const examById: Record<string, Exam> = {};
  exams.forEach((exam) => {
    examById[exam.id] = exam;
  });
  return rows.map((row) => mapSessionToResult(row, examById));
}

export async function listSessions(): Promise<BackendSession[]> {
  return apiRequest<BackendSession[]>('/sessions/');
}

export async function createOrUpdateSession(payload: {
  studentId: string;
  examId: string;
  status: 'in_progress' | 'submitted' | 'completed' | 'terminated' | 'missed';
  score?: number;
  integrity?: number;
}): Promise<BackendSession> {
  return apiRequest<BackendSession>('/sessions/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: payload.studentId,
      exam_id: payload.examId,
      status: payload.status,
      score: payload.score,
      integrity: payload.integrity,
    }),
  });
}

export async function setResultRelease(sessionId: string, released: boolean): Promise<void> {
  await apiRequest(`/sessions/${sessionId}/release`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ released }),
  });
}

export async function listProctoringSessions(): Promise<ProctoringSession[]> {
  const sessions = await listSessions();
  const storedProfileRaw = localStorage.getItem('proctorx_user_profile');
  let role: UserRole | null = null;
  if (storedProfileRaw) {
    try {
      role = (JSON.parse(storedProfileRaw)?.role as UserRole) || null;
    } catch {
      role = null;
    }
  }

  const canReadUsers = role === 'super_admin' || role === 'institute_admin';
  const users = canReadUsers ? await listUsers().catch(() => []) : [];
  const userById = users.reduce<Record<string, string>>((acc, user) => {
    if (user.role === 'student') {
      acc[user.id] = user.name || user.email;
    }
    return acc;
  }, {});

  const liveSessions = sessions.filter((session) => {
    if (session.status !== 'in_progress') return false;
    if (session.completed_at) return false;
    return true;
  });

  // Keep only the latest active session per exam/student to avoid stale socket targets.
  const latestByCandidate = new Map<string, BackendSession>();
  for (const session of liveSessions) {
    const key = `${session.exam_id}:${session.student_id}`;
    const current = latestByCandidate.get(key);
    if (!current) {
      latestByCandidate.set(key, session);
      continue;
    }

    const currentTs = new Date(current.started_at || 0).getTime();
    const nextTs = new Date(session.started_at || 0).getTime();
    if (nextTs >= currentTs) {
      latestByCandidate.set(key, session);
    }
  }
  const normalizedSessions = Array.from(latestByCandidate.values());

  const resolveViolationCount = (session: BackendSession) => {
    const explicit = Number(session.violation_count);
    if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);

    const candidates = [session.violation_logs_id, session.mongo_log_ref]
      .map((value) => (value || '').toString())
      .filter((value) => value.length > 0);

    for (const value of candidates) {
      const exactNumber = Number(value);
      if (Number.isFinite(exactNumber) && exactNumber > 0) {
        return Math.floor(exactNumber);
      }

      const match = value.match(/(\d{1,4})/);
      if (match) {
        const parsed = Number(match[1]);
        if (Number.isFinite(parsed) && parsed > 0) {
          return Math.floor(parsed);
        }
      }
    }

    return session.violation_found ? 1 : 0;
  };

  return normalizedSessions.map((session) => {
    const violationCount = resolveViolationCount(session);
    const hasViolation = violationCount > 0;
    const status: ProctoringSession['status'] = hasViolation ? 'warning' : 'connected';
    const riskLevel: ProctoringSession['riskLevel'] = hasViolation ? 'high' : 'medium';
    return {
      sessionId: session.id,
      studentId: session.student_id,
      examId: session.exam_id,
      studentName: userById[session.student_id] || session.student_code || `Student ${session.student_id.slice(0, 8)}`,
      status,
      riskLevel,
      faceDetected: !hasViolation,
      networkStrength: hasViolation ? 'moderate' : 'strong',
      progress: 60,
      violations: Array.from({ length: violationCount }).map((_, index) => ({
        id: `${session.id}-${index + 1}`,
        type: `AI Integrity Alert ${index + 1}`,
        timestamp: new Date(session.completed_at || session.started_at || Date.now()).toLocaleTimeString(),
        severity: 'high' as const,
        description: 'AI proctor detected a potential integrity issue.',
      })),
    };
  });
}

export async function createProctoringLog(payload: {
  sessionId: string;
  examId: string;
  studentId: string;
  action: 'warning' | 'remark' | 'mode_change';
  remark?: string;
  mode?: 'one-way' | 'two-way';
}): Promise<BackendProctoringLog> {
  const messageText = (payload.remark || `${payload.action}${payload.mode ? ` (${payload.mode})` : ''}`).trim();
  const message = await apiRequest<{ id: string; message: string; timestamp: string }>('/proctoring/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: payload.sessionId,
      message: messageText,
    }),
  });

  return {
    id: message.id,
    exam_id: payload.examId,
    student_id: payload.studentId,
    action: payload.action,
    remark: message.message,
    mode: payload.mode || 'one-way',
    created_at: message.timestamp,
  };
}

export async function listProctorMessages(sessionId: string): Promise<BackendProctorMessage[]> {
  const response = await apiRequest<{ messages: BackendProctorMessage[] }>(`/proctoring/messages/${sessionId}`);
  return Array.isArray(response.messages) ? response.messages : [];
}

export async function sendProctorMessage(sessionId: string, message: string): Promise<BackendProctorMessage> {
  return apiRequest<BackendProctorMessage>('/proctoring/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      message,
    }),
  });
}
