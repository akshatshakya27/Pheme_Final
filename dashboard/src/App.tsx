import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import StudentLoginPage from "./pages/auth/StudentLoginPage";
import OfficialLoginPage from "./pages/auth/OfficialLoginPage";
import StudentDashboard from "./pages/student/Dashboard";
import StudentExamsPage from "./pages/student/Exams";
import StudentResultsPage from "./pages/student/Results";
import StudentProfilePage from "./pages/student/Profile";
import SystemCheckPage from "./pages/student/SystemCheck";
import ExamAttemptPage from "./pages/student/ExamAttempt";
import ExamSubmittedPage from "./pages/student/ExamSubmitted";

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

const PublicLandingPage = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border bg-card shadow-card p-6">
        <h1 className="text-2xl font-bold mb-2">Pheme Dashboard</h1>
        <p className="text-muted-foreground mb-6">Choose your portal to continue.</p>
        <div className="flex gap-3 flex-wrap">
          <Link to="/login" className="rounded-md border px-4 py-2 hover:bg-muted">
            Student Login
          </Link>
          <Link to="/official-login" className="rounded-md border px-4 py-2 hover:bg-muted">
            Institute/Dev Login
          </Link>
        </div>
      </div>
    </div>
  );
};

const PortalUnavailablePage = () => (
  <div className="min-h-screen bg-background flex items-center justify-center p-6">
    <div className="w-full max-w-2xl rounded-2xl border bg-card shadow-card p-6">
      <h2 className="text-2xl font-bold mb-2">Portal UI Not Included</h2>
      <p className="text-muted-foreground mb-4">
        This deployed frontend bundle currently includes student pages only. Institute and dev dashboards are not part of this extracted dashboard package.
      </p>
      <Link to="/">Back to Landing</Link>
    </div>
  </div>
);

const AppRoutes = () => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<PublicLandingPage />} />
        <Route path="/login" element={<StudentLoginPage />} />
        <Route path="/official-login" element={<OfficialLoginPage />} />
        <Route path="/institute-login" element={<Navigate to="/official-login" replace />} />
        <Route path="/dev-login" element={<Navigate to="/official-login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (user?.role !== "student") {
    return (
      <Routes>
        <Route path="/portal-unavailable" element={<PortalUnavailablePage />} />
        <Route path="*" element={<Navigate to="/portal-unavailable" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Student */}
      <Route path="/student" element={<StudentDashboard />} />
      <Route path="/student/exams" element={<StudentExamsPage />} />
      <Route path="/student/system-check" element={<SystemCheckPage />} />
      <Route path="/student/exam-attempt" element={<ExamAttemptPage />} />
      <Route path="/student/exam-submitted" element={<ExamSubmittedPage />} />
      <Route path="/student/results" element={<StudentResultsPage />} />
      <Route path="/student/profile" element={<StudentProfilePage />} />
      {/* Default */}
      <Route path="/" element={<Navigate to="/student" replace />} />
      <Route path="*" element={<Navigate to="/student" replace />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
