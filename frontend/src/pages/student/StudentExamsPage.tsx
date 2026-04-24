import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Clock, LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Assignment {
  id: string;
  exam_id: string;
  exam: {
    id: string;
    title: string;
    duration: number;
    start_time?: string | null;
    end_time?: string | null;
  };
}

export default function StudentExamsPage() {
  const { user, logout } = useAuthStore();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [launchingExamId, setLaunchingExamId] = useState<string | null>(null);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const res = await api.get('/assignments/me');
      setAssignments(res.data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const launchDesktopExam = async (examId: string) => {
    setLaunchingExamId(examId);
    try {
      const res = await api.post('/desktop-exam/launch-token', { exam_id: examId });
      const deepLink = res.data?.deep_link;
      if (!deepLink) {
        throw new Error('Desktop launch link is unavailable.');
      }
      window.location.href = deepLink;
    } catch {
      window.location.href = `/exam/${examId}/live`;
    } finally {
      setLaunchingExamId(null);
    }
  };

  const activeExams = useMemo(() => {
    const now = new Date();
    return assignments.filter((assignment) => {
      const start = assignment.exam.start_time ? new Date(assignment.exam.start_time) : null;
      const end = assignment.exam.end_time ? new Date(assignment.exam.end_time) : null;
      if (start && now < start) return false;
      if (end && now > end) return false;
      return true;
    });
  }, [assignments]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight text-foreground">
              KNOWBOTS <span className="text-primary">LMS</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-4 text-sm font-medium text-muted-foreground mr-3">
              <Link to="/student" className="hover:text-primary transition-colors">Dashboard</Link>
              <Link to="/student/exams" className="text-foreground">Exams</Link>
              <Link to="/student/results" className="hover:text-primary transition-colors">Results</Link>
              <a href="#" className="hover:text-primary transition-colors">Support</a>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full relative hover:bg-secondary">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary border border-background" />
            </Button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">{user?.name || user?.email || 'Student'}</p>
              <p className="text-xs text-muted-foreground">Student</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary to-accent p-[1px]">
              <div className="h-full w-full rounded-full bg-background flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-destructive hover:bg-secondary">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Active Exams</h1>
          <p className="text-muted-foreground mt-1">Only exams active in the current time window are shown.</p>
        </div>

        {loading ? (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading exams...</p>
          </Card>
        ) : activeExams.length === 0 ? (
          <Card className="p-6">
            <p className="text-muted-foreground">No active exams right now.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeExams.map((assignment) => (
              <Card key={assignment.id} className="border-border hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-foreground text-lg">{assignment.exam.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground font-mono">{assignment.exam.id}</p>
                  <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> {assignment.exam.duration} minutes
                  </p>
                  <button
                    onClick={() => void launchDesktopExam(assignment.exam.id)}
                    disabled={launchingExamId === assignment.exam.id}
                    className="block w-full text-center px-4 py-2 rounded-md bg-primary hover:opacity-90 text-primary-foreground text-sm font-medium disabled:opacity-60"
                  >
                    {launchingExamId === assignment.exam.id ? 'Launching...' : 'Start Exam'}
                  </button>
                  <Link to={`/exam/${assignment.exam.id}/live`} className="block w-full text-center px-4 py-2 rounded-md border border-border text-foreground text-sm font-medium hover:bg-secondary">
                    Continue in Browser
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
