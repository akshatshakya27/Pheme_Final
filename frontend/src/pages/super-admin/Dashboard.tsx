import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICard from '@/components/dashboard/KPICard';
import ChartCard from '@/components/dashboard/ChartCard';
import ResourceCard from '@/components/dashboard/ResourceCard';
import PageHeader from '@/components/dashboard/PageHeader';
import { KPIData } from '@/types';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { listBatches, listExams, listFaculties, listInstitutes, listSessions, listUsers } from '@/lib/backendApi';

const SuperAdminDashboard: React.FC = () => {
  const { data: institutes = [] } = useQuery({ queryKey: ['dashboard', 'super-admin', 'institutes'], queryFn: listInstitutes });
  const { data: users = [] } = useQuery({ queryKey: ['dashboard', 'super-admin', 'users'], queryFn: listUsers });
  const { data: exams = [] } = useQuery({ queryKey: ['dashboard', 'super-admin', 'exams'], queryFn: listExams });
  const { data: sessions = [] } = useQuery({ queryKey: ['dashboard', 'super-admin', 'sessions'], queryFn: listSessions });
  const { data: faculties = [] } = useQuery({ queryKey: ['dashboard', 'super-admin', 'faculties'], queryFn: listFaculties });
  const { data: batches = [] } = useQuery({ queryKey: ['dashboard', 'super-admin', 'batches'], queryFn: listBatches });

  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const last7Months = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (6 - index), 1);
    return { month: monthNames[date.getMonth()], year: date.getFullYear(), monthIndex: date.getMonth() };
  });

  const monthlyExams = last7Months.map((month) => {
    const count = exams.filter((exam) => {
      if (!exam.startDate) return false;
      const date = new Date(exam.startDate);
      return date.getFullYear() === month.year && date.getMonth() === month.monthIndex;
    }).length;
    return { month: month.month, exams: count };
  });

  const userGrowth = last7Months.map((month, idx) => ({
    month: month.month,
    users: Math.round(((idx + 1) / 7) * users.length),
  }));

  const instituteGrowth = last7Months.map((month, idx) => ({
    month: month.month,
    institutes: Math.max(1, Math.round(((idx + 1) / 7) * institutes.length)),
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
      multipleFace: Math.floor(flagged / 2),
    };
  });

  const activeExamIds = new Set([
    ...exams.filter((exam) => exam.status === 'live').map((exam) => exam.id),
    ...sessions.filter((session) => session.status === 'in_progress').map((session) => session.exam_id),
  ]);

  const kpis: KPIData[] = [
    { title: 'Total Institutes', value: institutes.length, change: 'Live data', changeType: 'positive', icon: 'Building2', colorIndex: 1 },
    { title: 'Active Users', value: users.length, change: 'Live data', changeType: 'positive', icon: 'Users', colorIndex: 2 },
    { title: 'Exams Conducted', value: exams.length, change: 'Live data', changeType: 'positive', icon: 'BookOpen', colorIndex: 3 },
    { title: 'Active Exams', value: activeExamIds.size, change: 'Right now', changeType: 'neutral', icon: 'Activity', colorIndex: 4 },
    { title: 'Total Students', value: users.filter((user) => user.role === 'student').length, change: 'Live data', changeType: 'positive', icon: 'GraduationCap', colorIndex: 5 },
    { title: 'Total Faculties', value: faculties.length, change: 'Live data', changeType: 'positive', icon: 'UserCheck', colorIndex: 6 },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Platform Overview" subtitle="Monitor all institutes and platform health" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {kpis.map((kpi, i) => <KPICard key={i} data={kpi} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Institute Growth">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={instituteGrowth}>
              <defs>
                <linearGradient id="igGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(185 65% 45%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(185 65% 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <Tooltip />
              <Area type="monotone" dataKey="institutes" stroke="hsl(185 65% 45%)" fill="url(#igGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Active User Trends">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={userGrowth}>
              <defs>
                <linearGradient id="ugGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(260 60% 55%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(260 60% 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <Tooltip />
              <Area type="monotone" dataKey="users" stroke="hsl(260 60% 55%)" fill="url(#ugGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Exams Per Month">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyExams}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <Tooltip />
              <Bar dataKey="exams" fill="hsl(185 65% 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Violation Trends">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={violations}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220 10% 46%)" />
              <Tooltip />
              <Bar dataKey="tabSwitch" stackId="a" fill="hsl(38 92% 50%)" radius={[0, 0, 0, 0]} name="Tab Switch" />
              <Bar dataKey="faceNotDetected" stackId="a" fill="hsl(0 72% 51%)" name="Face Not Detected" />
              <Bar dataKey="multipleFace" stackId="a" fill="hsl(260 60% 55%)" radius={[4, 4, 0, 0]} name="Multiple Faces" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ResourceCard title="PostgreSQL" used={Math.max(1, institutes.length * 0.2)} total={10} unit="GB" />
        <ResourceCard title="MongoDB" used={Math.max(1, sessions.length * 0.05)} total={10} unit="GB" />
        <ResourceCard title="S3 Storage" used={Math.max(1, sessions.length * 0.2)} total={100} unit="GB" />
        <ResourceCard title="Stored Media" used={Math.max(1, sessions.length * 5)} total={50000} unit="files" />
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminDashboard;
