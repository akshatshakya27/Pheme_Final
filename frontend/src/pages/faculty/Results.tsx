import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';
import DataTable from '@/components/dashboard/DataTable';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ExamResult } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Eye } from 'lucide-react';
import { listFacultyResults, setResultRelease } from '@/lib/backendApi';
import { useQuery } from '@tanstack/react-query';

const FacultyResultsPage: React.FC = () => {
  const [results, setResults] = useState<ExamResult[]>([]);
  const { toast } = useToast();
  const { data, error } = useQuery({
    queryKey: ['results', 'faculty'],
    queryFn: listFacultyResults,
  });

  useEffect(() => {
    if (data) {
      setResults(data);
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      toast({ title: 'Failed to load results', description: (error as Error).message, variant: 'destructive' });
    }
  }, [error, toast]);

  const toggleRelease = async (sessionId: string) => {
    const target = results.find((row) => row.sessionId === sessionId);
    if (!target) return;

    const nextReleased = !target.released;
    try {
      await setResultRelease(sessionId, nextReleased);
      setResults(prev => prev.map(r => r.sessionId === sessionId ? { ...r, released: nextReleased } : r));
      toast({ title: 'Updated', description: 'Result visibility changed.' });
    } catch (error) {
      toast({ title: 'Failed to update release state', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const columns = [
    { key: 'studentName', label: 'Student' },
    { key: 'examTitle', label: 'Exam' },
    { key: 'score', label: 'Score', render: (r: ExamResult) => `${r.score}/${r.totalMarks}` },
    { key: 'percentage', label: '%', render: (r: ExamResult) => (
      <span className={`font-semibold ${r.percentage >= 70 ? 'text-success' : r.percentage >= 50 ? 'text-warning' : 'text-destructive'}`}>
        {r.percentage}%
      </span>
    )},
    { key: 'violations', label: 'Violations', render: (r: ExamResult) => (
      <span className={r.violations > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>{r.violations}</span>
    )},
    { key: 'released', label: 'Released', render: (r: ExamResult) => (
      <Switch checked={r.released} onCheckedChange={() => void toggleRelease(r.sessionId)} />
    ), sortable: false },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Results" subtitle="Manage exam results and release" breadcrumbs={[{ label: 'Dashboard', path: '/faculty' }, { label: 'Results' }]} />
      <DataTable data={results as unknown as Record<string, unknown>[]} columns={columns as any}
        actions={() => <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>}
      />
    </DashboardLayout>
  );
};

export default FacultyResultsPage;
