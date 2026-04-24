import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
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

const PublicLandingPage = () => {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 680, border: "1px solid #2b2b2b", borderRadius: 12, padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Pheme Dashboard</h1>
        <p style={{ opacity: 0.8, marginBottom: 20 }}>Choose your portal to continue.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link to="/login" style={{ padding: "10px 14px", border: "1px solid #2b2b2b", borderRadius: 8 }}>
            Student Login
          </Link>
          <Link to="/official-login" style={{ padding: "10px 14px", border: "1px solid #2b2b2b", borderRadius: 8 }}>
            Institute/Dev Login
          </Link>
        </div>
      </div>
    </div>
  );
};

const StudentLoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password, "student");
      navigate("/student", { replace: true });
    } catch (err) {
      setError((err as Error).message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form onSubmit={onSubmit} style={{ width: "100%", maxWidth: 420, border: "1px solid #2b2b2b", borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Student Login</h2>
        <p style={{ opacity: 0.8, marginBottom: 16 }}>Sign in with your student credentials.</p>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid #2b2b2b" }} />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span>Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid #2b2b2b" }} />
        </label>
        {error ? <p style={{ color: "#ef4444", marginBottom: 10 }}>{error}</p> : null}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #2b2b2b" }}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
};

const OfficialLoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [portal, setPortal] = useState<"institute" | "dev">("institute");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password, portal);
      if (user.role === "student") {
        navigate("/student", { replace: true });
      } else {
        navigate("/portal-unavailable", { replace: true });
      }
    } catch (err) {
      setError((err as Error).message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form onSubmit={onSubmit} style={{ width: "100%", maxWidth: 460, border: "1px solid #2b2b2b", borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Institute/Dev Login</h2>
        <p style={{ opacity: 0.8, marginBottom: 16 }}>Use institute or developer portal credentials.</p>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span>Portal</span>
          <select value={portal} onChange={(e) => setPortal(e.target.value as "institute" | "dev")} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid #2b2b2b" }}>
            <option value="institute">Institute</option>
            <option value="dev">Developer</option>
          </select>
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid #2b2b2b" }} />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span>Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid #2b2b2b" }} />
        </label>
        {error ? <p style={{ color: "#ef4444", marginBottom: 10 }}>{error}</p> : null}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #2b2b2b" }}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
};

const PortalUnavailablePage = () => (
  <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
    <div style={{ width: "100%", maxWidth: 640, border: "1px solid #2b2b2b", borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Portal UI Not Included</h2>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
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
