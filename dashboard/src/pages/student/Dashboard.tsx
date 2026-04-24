import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICard from '@/components/dashboard/KPICard';
import PageHeader from '@/components/dashboard/PageHeader';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { KPIData } from '@/types';
import { useNavigate } from 'react-router-dom';
import { Clock, BookOpen, Timer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listMyAssignments, listMySessions } from '@/lib/backendApi';
import { useAuth } from '@/contexts/AuthContext';

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: exams = [] } = useQuery({ queryKey: ['dashboard', 'student', 'assignments'], queryFn: listMyAssignments });
  const { data: sessions = [] } = useQuery({ queryKey: ['dashboard', 'student', 'sessions'], queryFn: listMySessions });

  const completedCount = sessions.filter((session) => session.status === 'completed' || session.status === 'submitted').length;
  const activeExamIds = new Set([
    ...exams.filter((exam) => exam.status === 'live').map((exam) => exam.id),
    ...sessions.filter((session) => session.status === 'in_progress').map((session) => session.exam_id),
  ]);
  const upcomingCount = exams.filter((exam) => exam.status === 'scheduled' && !activeExamIds.has(exam.id)).length;
  const liveCount = activeExamIds.size;

  const kpis: KPIData[] = [
    { title: 'Assigned Exams', value: exams.length, icon: 'BookOpen', colorIndex: 1 },
    { title: 'Completed', value: completedCount, icon: 'FileText', colorIndex: 4 },
    { title: 'Upcoming', value: upcomingCount, icon: 'Clock', colorIndex: 2 },
    { title: 'Live Now', value: liveCount, change: liveCount > 0 ? 'Available now' : 'No active exam', changeType: 'neutral', icon: 'Activity', colorIndex: 5 },
  ];

  const studentSubtitle = [user?.name, user?.batchCode].filter(Boolean).join(' — ') || user?.email || '';

  return (
    <DashboardLayout>
      <PageHeader title="Student Dashboard" subtitle={studentSubtitle} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi, i) => <KPICard key={i} data={kpi} />)}
      </div>

      <div className="bg-card rounded-lg p-5 shadow-card">
        <h3 className="text-sm font-semibold text-card-foreground mb-4">Your Exams</h3>
        <div className="space-y-3">
          {exams.map(e => {
            const isLive = e.status === 'live' || activeExamIds.has(e.id);
            const examStatus = isLive ? 'live' : e.status;
            return (
              <div key={e.id} onClick={() => navigate('/student/exams')} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-sm">{e.title}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.duration} min</span>
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{e.totalMarks} marks</span>
                    <span>{new Date(e.startDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={examStatus} />
                  {isLive && (
                    <div className="flex items-center gap-1 text-xs text-success font-medium animate-pulse-soft">
                      <Timer className="h-3.5 w-3.5" />LIVE
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
