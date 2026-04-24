import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';
import ChartCard from '@/components/dashboard/ChartCard';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { listBatches, listExams, listSessions, listUsers } from '@/lib/backendApi';

const pieData = [
  { name: 'Low Risk', value: 65, color: 'hsl(152 60% 40%)' },
  { name: 'Medium Risk', value: 25, color: 'hsl(38 92% 50%)' },
  { name: 'High Risk', value: 10, color: 'hsl(0 72% 51%)' },
];

const AnalyticsPage: React.FC = () => {
  const { data: users = [] } = useQuery({ queryKey: ['analytics', 'users'], queryFn: listUsers });
  const { data: exams = [] } = useQuery({ queryKey: ['analytics', 'exams'], queryFn: listExams });
  const { data: sessions = [] } = useQuery({ queryKey: ['analytics', 'sessions'], queryFn: listSessions });
  const { data: batches = [] } = useQuery({ queryKey: ['analytics', 'batches'], queryFn: listBatches });

  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const last7Months = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (6 - index), 1);
    return { month: monthNames[date.getMonth()], year: date.getFullYear(), monthIndex: date.getMonth() };
  });

  const userGrowth = last7Months.map((month, idx) => ({ month: month.month, users: Math.round(((idx + 1) / 7) * users.length) }));
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
    return { month: month.month, tabSwitch: flagged, faceNotDetected: Math.max(0, flagged - Math.floor(flagged / 2)) };
  });

  const batchPerformance = batches.slice(0, 8).map((batch) => {
    const batchSessions = sessions.filter((session) => session.student_code?.startsWith(batch.name));
    const scored = batchSessions.filter((session) => typeof session.score === 'number');
    const avgScore = scored.length ? Math.round(scored.reduce((acc, item) => acc + (item.score || 0), 0) / scored.length) : 0;
    const riskScore = batchSessions.length ? Math.round((batchSessions.filter((session) => session.violation_found).length / batchSessions.length) * 100) : 0;
    return { batch: batch.name.slice(0, 6), avgScore, riskScore };
  });

  const total = Math.max(1, sessions.length);
  const flagged = sessions.filter((session) => session.violation_found).length;
  const pieData = [
    { name: 'Low Risk', value: Math.max(0, total - flagged), color: 'hsl(152 60% 40%)' },
    { name: 'Medium Risk', value: Math.floor(flagged / 2), color: 'hsl(38 92% 50%)' },
    { name: 'High Risk', value: Math.ceil(flagged / 2), color: 'hsl(0 72% 51%)' },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Platform Analytics" subtitle="Deep insights across all institutes" breadcrumbs={[{ label: 'Dashboard', path: '/super-admin' }, { label: 'Analytics' }]} />
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <ChartCard title="User Growth Trend">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={userGrowth}>
              <defs><linearGradient id="agGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(185 65% 45%)" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(185 65% 45%)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <Tooltip /><Area type="monotone" dataKey="users" stroke="hsl(185 65% 45%)" fill="url(#agGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly Exams">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyExams}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" /><Tooltip />
              <Bar dataKey="exams" fill="hsl(260 60% 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Risk Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Violation Breakdown">
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
        <ChartCard title="Batch Performance">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={batchPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" />
              <XAxis dataKey="batch" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" /><Tooltip />
              <Bar dataKey="avgScore" fill="hsl(185 65% 45%)" radius={[4, 4, 0, 0]} name="Avg Score" />
              <Bar dataKey="riskScore" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} name="Risk Score" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
};

export default AnalyticsPage;
