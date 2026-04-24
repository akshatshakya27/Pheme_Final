import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
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

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="*" element={<Navigate to="/student" replace />} />
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
