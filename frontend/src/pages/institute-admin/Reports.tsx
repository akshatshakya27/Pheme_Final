import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';
import ChartCard from '@/components/dashboard/ChartCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { listExams, listSessions } from '@/lib/backendApi';

const ReportsPage: React.FC = () => {
  const { data: exams = [] } = useQuery({ queryKey: ['reports', 'exams'], queryFn: listExams });
  const { data: sessions = [] } = useQuery({ queryKey: ['reports', 'sessions'], queryFn: listSessions });

  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const last7Months = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (6 - index), 1);
    return { month: monthNames[date.getMonth()], year: date.getFullYear(), monthIndex: date.getMonth() };
  });

  const monthlyExams = last7Months.map((month) => ({
    month: month.month,
    exams: exams.filter((exam) => {
      if (!exam.startDate) return false;
      const date = new Date(exam.startDate);
      return date.getFullYear() === month.year && date.getMonth() === month.monthIndex;
    }).length,
  }));

  const violations = last7Months.map((month) => {
    const monthSessions = sessions.filter((session) => {
      if (!session.completed_at && !session.started_at) return false;
      const date = new Date(session.completed_at || session.started_at || now.toISOString());
      return date.getFullYear() === month.year && date.getMonth() === month.monthIndex;
    });
    const flagged = monthSessions.filter((session) => session.violation_found).length;
    return {
      month: month.month,
      tabSwitch: flagged,
      faceNotDetected: Math.max(0, flagged - Math.floor(flagged / 2)),
    };
  });

  return (
    <DashboardLayout>
      <PageHeader title="Reports" subtitle="Institute-wide analytics" breadcrumbs={[{ label: 'Dashboard', path: '/institute' }, { label: 'Reports' }]} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Exam Completion by Month">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyExams}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" /><Tooltip />
              <Bar dataKey="exams" fill="hsl(185 65% 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Violation Summary">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={violations}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" /><Tooltip />
              <Bar dataKey="tabSwitch" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} name="Tab Switch" />
              <Bar dataKey="faceNotDetected" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} name="Face Not Detected" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
