import { StatCard } from '@/components/ui/stat-card';
import { Monitor, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';

interface ExamSession {
  id: number;
  student_id: string;
  exam_id: number;
  status: string;
}

export default function ProctorDashboard() {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const res = await api.get('/sessions/').catch(() => ({ data: [] }));
      setSessions(res.data || []);
    };
    fetchData();
  }, []);

  const liveSessions = useMemo(
    () => sessions.filter((session) => ['in_progress', 'ongoing', 'active'].includes(session.status)),
    [sessions]
  );
  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Proctoring</p>
        <h1 className="text-2xl font-bold text-foreground">Live Monitoring</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor active examination sessions in real time</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Live Sessions" value={liveSessions.length} icon={Monitor} accent="bg-blue-100" />
        <StatCard title="Total Sessions" value={sessions.length} icon={Users} accent="bg-emerald-100" />
      </div>

      <div className="mt-8 bg-card rounded-xl border border-border card-shadow p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Active Exam Sessions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Live sessions from the database</p>
          </div>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full badge-success text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse inline-block" />
            LIVE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {liveSessions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No active sessions.</div>
          ) : (
            liveSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-lg border p-4 transition-all border-border bg-secondary/30 hover:border-primary/30"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-foreground">Session #{session.id}</span>
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                </div>
                <div className="aspect-video rounded-md bg-muted border border-border flex items-center justify-center mb-3">
                  <Monitor className="h-7 w-7 text-muted-foreground/30" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Exam {session.exam_id}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded badge-success">
                    Ongoing
                  </span>
                </div>
                <Button
                  className="mt-3 w-full"
                  size="sm"
                  onClick={() =>
                    navigate(
                      `/proctor/live/${session.id}?examId=${session.exam_id}&studentId=${session.student_id}&studentName=Student%20${session.student_id}&mode=two-way`
                    )
                  }
                >
                  Open Live Panel
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
