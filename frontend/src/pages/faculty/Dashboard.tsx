import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICard from '@/components/dashboard/KPICard';
import PageHeader from '@/components/dashboard/PageHeader';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { KPIData } from '@/types';
import { useNavigate } from 'react-router-dom';
import { Clock, BookOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listBatches, listExams, listSessions } from '@/lib/backendApi';
import { useAuth } from '@/contexts/AuthContext';

const FacultyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: exams = [] } = useQuery({ queryKey: ['dashboard', 'faculty', 'exams'], queryFn: listExams });
  const { data: batches = [] } = useQuery({ queryKey: ['dashboard', 'faculty', 'batches'], queryFn: listBatches });
  const { data: sessions = [] } = useQuery({ queryKey: ['dashboard', 'faculty', 'sessions'], queryFn: listSessions });

  const kpis: KPIData[] = [
    { title: 'Assigned Batches', value: batches.length, icon: 'BookOpen', colorIndex: 1 },
    { title: 'Upcoming Exams', value: exams.filter((exam) => exam.status === 'scheduled').length, icon: 'Clock', colorIndex: 2 },
    { title: 'Active Proctoring', value: sessions.filter((session) => session.status === 'in_progress').length, change: 'Live now', changeType: 'neutral', icon: 'Monitor', colorIndex: 4 },
    { title: 'Completed Exams', value: exams.filter((exam) => exam.status === 'completed').length, change: 'This semester', changeType: 'neutral', icon: 'FileText', colorIndex: 3 },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Faculty Dashboard" subtitle={user?.name || user?.email || ''} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi, i) => <KPICard key={i} data={kpi} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg p-5 shadow-card">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Assigned Batches</h3>
          <div className="space-y-3">
            {batches.slice(0, 2).map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.department} · {b.totalStudents} students</p>
                </div>
                <StatusBadge status={b.riskSummary} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-lg p-5 shadow-card">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Recent Exams</h3>
          <div className="space-y-3">
            {exams.slice(0, 5).map(e => (
              <div key={e.id} onClick={() => navigate('/faculty/exams')} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors">
                <div>
                  <p className="font-medium text-sm">{e.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.duration} min</span>
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{e.totalMarks} marks</span>
                  </div>
                </div>
                <StatusBadge status={e.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FacultyDashboard;
