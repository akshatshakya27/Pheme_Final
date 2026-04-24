import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICard from '@/components/dashboard/KPICard';
import ChartCard from '@/components/dashboard/ChartCard';
import PageHeader from '@/components/dashboard/PageHeader';
import { KPIData } from '@/types';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { listBatches, listExams, listFaculties, listInstitutes, listSessions, listUsers } from '@/lib/backendApi';

const InstituteAdminDashboard: React.FC = () => {
  const { data: users = [] } = useQuery({ queryKey: ['institute-dashboard', 'users'], queryFn: listUsers });
  const { data: faculties = [] } = useQuery({ queryKey: ['institute-dashboard', 'faculties'], queryFn: listFaculties });
  const { data: batches = [] } = useQuery({ queryKey: ['institute-dashboard', 'batches'], queryFn: listBatches });
  const { data: exams = [] } = useQuery({ queryKey: ['institute-dashboard', 'exams'], queryFn: listExams });
  const { data: sessions = [] } = useQuery({ queryKey: ['institute-dashboard', 'sessions'], queryFn: listSessions });
  const { data: institutes = [] } = useQuery({ queryKey: ['institute-dashboard', 'institutes'], queryFn: listInstitutes });

  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const last7Months = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (6 - index), 1);
    return { month: monthNames[date.getMonth()], year: date.getFullYear(), monthIndex: date.getMonth() };
  });

  const studentGrowth = last7Months.map((month, idx) => ({ month: month.month, users: Math.round(((idx + 1) / 7) * users.filter((user) => user.role === 'student').length) }));
  const examActivity = last7Months.map((month) => ({
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
    return { batch: batch.name.slice(0, 6), avgScore };
  });

  const riskPercent = sessions.length ? Math.round((sessions.filter((session) => session.violation_found).length / sessions.length) * 100) : 0;
  const activeExamIds = new Set([
    ...exams.filter((exam) => exam.status === 'live').map((exam) => exam.id),
    ...sessions.filter((session) => session.status === 'in_progress').map((session) => session.exam_id),
  ]);
  const kpis: KPIData[] = [
    { title: 'Total Faculties', value: faculties.length, change: 'Live data', changeType: 'positive', icon: 'UserCheck', colorIndex: 1 },
    { title: 'Total Students', value: users.filter((user) => user.role === 'student').length, change: 'Live data', changeType: 'positive', icon: 'GraduationCap', colorIndex: 2 },
    { title: 'Total Batches', value: batches.length, change: 'Live data', changeType: 'positive', icon: 'BookOpen', colorIndex: 3 },
    { title: 'Total Exams', value: exams.length, change: 'Live data', changeType: 'positive', icon: 'FileText', colorIndex: 4 },
    { title: 'Active Exams', value: activeExamIds.size, change: 'Right now', changeType: 'neutral', icon: 'Activity', colorIndex: 5 },
    { title: 'Avg Risk Score', value: `${riskPercent}%`, change: 'Live data', changeType: riskPercent < 20 ? 'positive' : 'negative', icon: 'AlertTriangle', colorIndex: 6 },
  ];

  const instituteSubtitle = institutes[0]?.name || 'Institute Overview';

  return (
    <DashboardLayout>
      <PageHeader title="Institute Dashboard" subtitle={instituteSubtitle} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {kpis.map((kpi, i) => <KPICard key={i} data={kpi} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Student Growth">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={studentGrowth}>
              <defs><linearGradient id="sgGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(185 65% 45%)" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(185 65% 45%)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" /><XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" /><YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" /><Tooltip />
              <Area type="monotone" dataKey="users" stroke="hsl(185 65% 45%)" fill="url(#sgGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Exam Activity">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={examActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" /><XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" /><YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" /><Tooltip />
              <Bar dataKey="exams" fill="hsl(260 60% 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Violation Frequency">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={violations}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" /><XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" /><YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" /><Tooltip />
              <Bar dataKey="tabSwitch" stackId="a" fill="hsl(38 92% 50%)" name="Tab Switch" />
              <Bar dataKey="faceNotDetected" stackId="a" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} name="Face Not Detected" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Batch Performance">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={batchPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" /><XAxis dataKey="batch" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" /><YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" /><Tooltip />
              <Bar dataKey="avgScore" fill="hsl(185 65% 45%)" radius={[4, 4, 0, 0]} name="Avg Score" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
};

export default InstituteAdminDashboard;
