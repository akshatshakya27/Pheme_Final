import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import SuperAdminDashboard from "./pages/super-admin/Dashboard";
import InstitutesPage from "./pages/super-admin/Institutes";
import InstituteDetailsPage from "@/pages/super-admin/InstituteDetails";
import AnalyticsPage from "./pages/super-admin/Analytics";
import InstituteAdminDashboard from "./pages/institute-admin/Dashboard";
import FacultiesPage from "./pages/institute-admin/Faculties";
import StudentsPage from "./pages/institute-admin/Students";
import BatchesPage from "./pages/institute-admin/Batches";
import InstituteExamsPage from "./pages/institute-admin/Exams";
import ReportsPage from "./pages/institute-admin/Reports";
import FacultyDashboard from "./pages/faculty/Dashboard";
import CreateExamPage from "./pages/faculty/CreateExam";
import MyExamsPage from "./pages/faculty/MyExams";
import ProctoringPage from "./pages/faculty/Proctoring";
import FacultyResultsPage from "./pages/faculty/Results";
import StudentDashboard from "./pages/student/Dashboard";
import StudentExamsPage from "./pages/student/Exams";
import SystemCheckPage from "./pages/student/SystemCheck";
import ExamAttemptPage from "./pages/student/ExamAttempt";
import ExamSubmittedPage from "./pages/student/ExamSubmitted";
import StudentResultsPage from "./pages/student/Results";
import StudentProfilePage from "./pages/student/Profile";
import SettingsPage from "./pages/shared/SettingsPage";
import DesktopExamPage from "./pages/exam/DesktopExamPage";
import DesktopTermsPage from "./pages/exam/DesktopTermsPage";
import DesktopExamSessionPage from "./pages/exam/DesktopExamSessionPage";
import DesktopExamResultPage from "./pages/exam/DesktopExamResultPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppRoutes = () => {
  const { isAuthenticated, user } = useAuth();
  const isDesktopPath =
    window.location.pathname.startsWith('/desktop') ||
    window.location.hash.startsWith('#/desktop');

  if (isDesktopPath) {
    return (
      <Routes>
        <Route path="/desktop" element={<Navigate to="/desktop/exam" replace />} />
        <Route path="/desktop/exam" element={<DesktopExamPage />} />
        <Route path="/desktop/exam-terms/:examId" element={<DesktopTermsPage />} />
        <Route path="/desktop/exam-session/:sessionId" element={<DesktopExamSessionPage />} />
        <Route path="/desktop/exam-result" element={<DesktopExamResultPage />} />
        <Route path="*" element={<Navigate to="/desktop/exam" replace />} />
      </Routes>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage variant="student" />} />
        <Route path="/login/official" element={<LoginPage variant="official" />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/institute-login" element={<Navigate to="/login/official" replace />} />
        <Route path="/dev-login" element={<Navigate to="/login/official" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/login/official" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/institute-login" element={<Navigate to="/" replace />} />
      <Route path="/dev-login" element={<Navigate to="/" replace />} />
      {/* Super Admin */}
      <Route path="/super-admin" element={<SuperAdminDashboard />} />
      <Route path="/super-admin/institutes" element={<InstitutesPage />} />
      <Route path="/super-admin/institutes/:instituteId" element={<InstituteDetailsPage />} />
      <Route path="/super-admin/analytics" element={<AnalyticsPage />} />
      <Route path="/super-admin/settings" element={<SettingsPage basePath="/super-admin" />} />
      {/* Institute Admin */}
      <Route path="/institute" element={<InstituteAdminDashboard />} />
      <Route path="/institute/faculties" element={<FacultiesPage />} />
      <Route path="/institute/students" element={<StudentsPage />} />
      <Route path="/institute/batches" element={<BatchesPage />} />
      <Route path="/institute/exams" element={<InstituteExamsPage />} />
      <Route path="/institute/reports" element={<ReportsPage />} />
      <Route path="/institute/settings" element={<SettingsPage basePath="/institute" />} />
      {/* Faculty */}
      <Route path="/faculty" element={<FacultyDashboard />} />
      <Route path="/faculty/create-exam" element={<CreateExamPage />} />
      <Route path="/faculty/exams" element={<MyExamsPage />} />
      <Route path="/faculty/proctoring" element={<ProctoringPage />} />
      <Route path="/faculty/results" element={<FacultyResultsPage />} />
      <Route path="/faculty/settings" element={<SettingsPage basePath="/faculty" />} />
      {/* Student */}
      <Route path="/student" element={<StudentDashboard />} />
      <Route path="/student/exams" element={<StudentExamsPage />} />
      <Route path="/student/system-check" element={<SystemCheckPage />} />
      <Route path="/student/exam-attempt" element={<ExamAttemptPage />} />
      <Route path="/student/exam-submitted" element={<ExamSubmittedPage />} />
      <Route path="/student/results" element={<StudentResultsPage />} />
      <Route path="/student/profile" element={<StudentProfilePage />} />
      {/* Default */}
      <Route
        path="/"
        element={
          <Navigate
            to={user?.role === 'super_admin' ? '/super-admin' : user?.role === 'institute_admin' ? '/institute' : user?.role === 'faculty' ? '/faculty' : '/student'}
            replace
          />
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const RouterProvider = (window as any).electronAPI ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <RouterProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </RouterProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
