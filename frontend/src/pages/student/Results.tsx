import React, { useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from '@/components/dashboard/ChartCard';
import { ExamResult } from '@/types';
import { listStudentResults } from '@/lib/backendApi';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

const StudentResultsPage: React.FC = () => {
  const { toast } = useToast();
  const { data: myResults = [], error } = useQuery<ExamResult[]>({
    queryKey: ['results', 'student'],
    queryFn: listStudentResults,
  });

  useEffect(() => {
    if (error) {
      toast({ title: 'Failed to load results', description: (error as Error).message, variant: 'destructive' });
    }
  }, [error, toast]);

  const released = myResults.filter(r => r.released);
  const unreleased = myResults.filter(r => !r.released);

  return (
    <DashboardLayout>
      <PageHeader title="My Results" subtitle="View your exam performance" breadcrumbs={[{ label: 'Dashboard', path: '/student' }, { label: 'Results' }]} />

      {released.length > 0 && (
        <div className="space-y-4 mb-6">
          {released.map(r => (
            <div key={r.sessionId} className="bg-card rounded-lg p-6 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{r.examTitle}</h3>
                  <div className="flex items-center gap-6 mt-2 text-sm">
                    <span>Score: <strong>{r.score}/{r.totalMarks}</strong></span>
                    <span className={`font-bold ${r.percentage >= 70 ? 'text-success' : r.percentage >= 50 ? 'text-warning' : 'text-destructive'}`}>
                      {r.percentage}%
                    </span>
                    {r.violations > 0 && <span className="text-destructive">{r.violations} violation(s)</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <ChartCard title="Performance Overview">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={released.map(r => ({ name: r.examTitle.split(' ')[0], score: r.percentage }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" domain={[0, 100]} />
                <Tooltip /><Bar dataKey="score" fill="hsl(185 65% 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {unreleased.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Pending Results</h3>
          {unreleased.map(r => (
            <div key={r.sessionId} className="bg-muted/50 rounded-lg p-4 border border-border">
              <p className="font-medium">{r.examTitle}</p>
              <p className="text-sm text-muted-foreground mt-1">Results have not been released yet.</p>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default StudentResultsPage;
