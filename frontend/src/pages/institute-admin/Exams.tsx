import React, { useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';
import DataTable from '@/components/dashboard/DataTable';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { Exam } from '@/types';
import { listExams } from '@/lib/backendApi';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

const InstituteExamsPage: React.FC = () => {
  const { toast } = useToast();
  const { data: exams = [], error } = useQuery<Exam[]>({
    queryKey: ['exams', 'institute'],
    queryFn: listExams,
  });

  useEffect(() => {
    if (error) {
      toast({ title: 'Failed to load exams', description: (error as Error).message, variant: 'destructive' });
    }
  }, [error, toast]);

  const columns = [
    { key: 'title', label: 'Exam Title' },
    { key: 'duration', label: 'Duration', render: (e: Exam) => `${e.duration} min` },
    { key: 'totalMarks', label: 'Marks' },
    { key: 'totalQuestions', label: 'Questions' },
    { key: 'status', label: 'Status', render: (e: Exam) => <StatusBadge status={e.status} /> },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="All Exams" subtitle="View all exams across batches" breadcrumbs={[{ label: 'Dashboard', path: '/institute' }, { label: 'Exams' }]} />
      <DataTable data={exams as unknown as Record<string, unknown>[]} columns={columns as any} />
    </DashboardLayout>
  );
};

export default InstituteExamsPage;
