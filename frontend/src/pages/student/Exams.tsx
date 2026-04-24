import React, { useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { Button } from '@/components/ui/button';
import { Clock, BookOpen, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listMyAssignments, listMySessions } from '@/lib/backendApi';
import { Exam } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

const StudentExamsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: exams = [], error } = useQuery({
    queryKey: ['exams', 'student-assignments'],
    queryFn: listMyAssignments,
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ['exams', 'student-sessions'],
    queryFn: listMySessions,
  });

  const activeExamIds = new Set([
    ...exams.filter((exam) => exam.status === 'live').map((exam) => exam.id),
    ...sessions.filter((session) => session.status === 'in_progress').map((session) => session.exam_id),
  ]);

  useEffect(() => {
    if (error) {
      toast({ title: 'Failed to load assigned exams', description: (error as Error).message, variant: 'destructive' });
    }
  }, [error, toast]);

  return (
    <DashboardLayout>
      <PageHeader title="My Exams" subtitle="View all assigned exams" breadcrumbs={[{ label: 'Dashboard', path: '/student' }, { label: 'Exams' }]} />
      <div className="space-y-4">
        {exams.map(e => {
          const isLive = e.status === 'live' || activeExamIds.has(e.id);
          const isScheduled = e.status === 'scheduled' && !isLive;
          const examStatus = isLive ? 'live' : e.status;
          return (
            <div key={e.id} className="bg-card rounded-lg p-6 shadow-card">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{e.title}</h3>
                  <p className="text-sm text-muted-foreground">{e.description}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{e.duration} min</span>
                    <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" />{e.totalMarks} marks</span>
                    <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{new Date(e.startDate).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={examStatus} />
                  {isLive && (
                    <Button
                      onClick={() => {
                        sessionStorage.setItem('student_active_exam_id', e.id);
                        navigate('/student/system-check');
                      }}
                      className="bg-success text-success-foreground hover:bg-success/90"
                    >
                      Start Exam
                    </Button>
                  )}
                  {isScheduled && (
                    <Button disabled variant="outline">Not Yet Available</Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
};

export default StudentExamsPage;
