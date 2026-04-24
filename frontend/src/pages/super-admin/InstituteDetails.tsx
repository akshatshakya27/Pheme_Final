import React, { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Upload } from 'lucide-react';

import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';
import DataTable from '@/components/dashboard/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { createUser, getInstituteOverview, importInstituteAdmins } from '@/lib/backendApi';
import { getCsvValue, parseCsv } from '@/lib/csv';

const InstituteDetailsPage: React.FC = () => {
  const { instituteId } = useParams<{ instituteId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
  const [importingAdmins, setImportingAdmins] = useState(false);
  const adminCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    empId: '',
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['institute-overview', instituteId],
    queryFn: () => getInstituteOverview(instituteId || ''),
    enabled: !!instituteId,
  });

  const handleCreateAdmin = async () => {
    if (!instituteId) return;
    if (!adminForm.name || !adminForm.email || !adminForm.password) {
      toast({ title: 'Validation Error', description: 'Name, email, and password are required.', variant: 'destructive' });
      return;
    }
    if (adminForm.password.length < 8) {
      toast({ title: 'Validation Error', description: 'Password must be at least 8 characters.', variant: 'destructive' });
      return;
    }

    try {
      await createUser({
        instituteId,
        name: adminForm.name,
        email: adminForm.email,
        password: adminForm.password,
        role: 'institute_admin',
        empId: adminForm.empId || `ADM${Date.now().toString().slice(-6)}`,
      });
      setCreateAdminOpen(false);
      setAdminForm({ name: '', email: '', password: '', empId: '' });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['institutes'] });
      toast({ title: 'Admin Created', description: 'Institute admin account created successfully.' });
    } catch (createError) {
      toast({ title: 'Failed to create admin', description: (createError as Error).message, variant: 'destructive' });
    }
  };

  const handleDownloadAdminTemplate = () => {
    const template = 'name,email,password,emp_id\nJane Doe,jane.admin@institute.edu,SecurePass123,ADM1001\n';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'institute_admin_import_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAdminsCsv = () => {
    const admins = data?.admins || [];
    const headers = ['name', 'email', 'emp_id', 'admin_code'];
    const rows = admins.map((admin) => [admin.name, admin.email, admin.emp_id, admin.admin_code || ''].join(','));
    const content = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `institute_admins_${data?.institute.institute_code || 'export'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportAdminCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !instituteId) {
      return;
    }

    try {
      setImportingAdmins(true);
      const content = await file.text();
      const rows = parseCsv(content);
      if (!rows.length) {
        toast({ title: 'Import denied', description: 'CSV has no data rows.', variant: 'destructive' });
        return;
      }

      const normalizedRows = rows.map((row, index) => {
        const name = getCsvValue(row, ['name', 'admin_name', 'admin name']);
        const email = getCsvValue(row, ['email', 'admin_email', 'admin email']).toLowerCase();
        const password = getCsvValue(row, ['password', 'admin_password', 'admin password']);
        const empId = getCsvValue(row, ['emp_id', 'employee_id', 'empid', 'employee id']);
        return { index: index + 1, name, email, password, empId };
      });

      const errors: string[] = [];
      const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      const seenEmails = new Set<string>();
      const seenEmpIds = new Set<string>();

      normalizedRows.forEach((row) => {
        if (!row.name) errors.push(`Row ${row.index}: name is required`);
        if (!row.email) errors.push(`Row ${row.index}: email is required`);
        else if (!emailPattern.test(row.email)) errors.push(`Row ${row.index}: invalid email format`);
        if (!row.password || row.password.length < 8) errors.push(`Row ${row.index}: password must be at least 8 characters`);

        if (row.email) {
          if (seenEmails.has(row.email)) errors.push(`Row ${row.index}: duplicate email in file (${row.email})`);
          seenEmails.add(row.email);
        }
        if (row.empId) {
          const key = row.empId.toUpperCase();
          if (seenEmpIds.has(key)) errors.push(`Row ${row.index}: duplicate emp_id in file (${row.empId})`);
          seenEmpIds.add(key);
        }
      });

      if (errors.length) {
        toast({
          title: 'Import denied',
          description: errors.slice(0, 3).join(' • ') + (errors.length > 3 ? ` • +${errors.length - 3} more` : ''),
          variant: 'destructive',
        });
        return;
      }

      const result = await importInstituteAdmins(
        instituteId,
        normalizedRows.map((row) => ({ name: row.name, email: row.email, password: row.password, empId: row.empId || undefined }))
      );

      await refetch();
      queryClient.invalidateQueries({ queryKey: ['institutes'] });
      toast({ title: 'Import completed', description: `${result.created} admin account(s) created.` });
    } catch (importError) {
      toast({ title: 'Import denied', description: (importError as Error).message, variant: 'destructive' });
    } finally {
      setImportingAdmins(false);
    }
  };

  const summaryCards = [
    { label: 'Admins', value: data?.counts.admins || 0, color: 'bg-kpi-1/10 text-kpi-1 border-kpi-1/20' },
    { label: 'Faculties', value: data?.counts.faculties || 0, color: 'bg-kpi-2/10 text-kpi-2 border-kpi-2/20' },
    { label: 'Batches', value: data?.counts.batches || 0, color: 'bg-kpi-3/10 text-kpi-3 border-kpi-3/20' },
    { label: 'Students', value: data?.counts.students || 0, color: 'bg-kpi-4/10 text-kpi-4 border-kpi-4/20' },
    { label: 'Exams', value: data?.counts.exams || 0, color: 'bg-kpi-5/10 text-kpi-5 border-kpi-5/20' },
    { label: 'Sessions', value: data?.counts.sessions || 0, color: 'bg-kpi-6/10 text-kpi-6 border-kpi-6/20' },
    { label: 'Violations', value: data?.counts.violations || 0, color: 'bg-destructive/10 text-destructive border-destructive/20' },
  ];

  const examTitleById = (data?.exams || []).reduce<Record<string, string>>((acc, exam) => {
    acc[exam.id] = exam.title;
    return acc;
  }, {});

  const studentNameById = (data?.students || []).reduce<Record<string, string>>((acc, student) => {
    acc[student.id] = student.name;
    return acc;
  }, {});

  const humanSessions = (data?.sessions || []).map((session) => ({
    ...session,
    exam_title: examTitleById[session.exam_id] || 'Unknown Exam',
    student_name: studentNameById[session.student_id] || 'Unknown Student',
    started_at_display: session.started_at ? new Date(session.started_at).toLocaleString() : 'Not started',
    completed_at_display: session.completed_at ? new Date(session.completed_at).toLocaleString() : 'Not completed',
  }));

  return (
    <DashboardLayout>
      <PageHeader
        title={data?.institute.name || 'Institute Details'}
        subtitle="Detailed institute landing page with complete related data"
        breadcrumbs={[
          { label: 'Dashboard', path: '/super-admin' },
          { label: 'Institutes', path: '/super-admin/institutes' },
          { label: data?.institute.name || 'Details' },
        ]}
      />

      {isLoading && <p className="text-sm text-muted-foreground">Loading institute details...</p>}
      {isError && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {!isLoading && !isError && data && (
        <div className="space-y-6">
          <Card className="border-0 bg-gradient-to-r from-kpi-6/10 via-kpi-2/10 to-kpi-3/10">
            <CardHeader>
              <CardTitle className="text-lg">Institute Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="rounded-md border border-kpi-6/20 bg-kpi-6/5 p-3"><span className="text-muted-foreground">Institute Code:</span> <span className="font-semibold">{data.institute.institute_code}</span></div>
                <div className="rounded-md border border-kpi-2/20 bg-kpi-2/5 p-3"><span className="text-muted-foreground">Contact Email:</span> <span className="font-semibold">{data.institute.contact_email || 'N/A'}</span></div>
                <div className="rounded-md border border-kpi-3/20 bg-kpi-3/5 p-3"><span className="text-muted-foreground">Address:</span> <span className="font-semibold">{data.institute.address || 'N/A'}</span></div>
                <div className="rounded-md border border-kpi-4/20 bg-kpi-4/5 p-3"><span className="text-muted-foreground">Created:</span> <span className="font-semibold">{data.institute.created_at ? new Date(data.institute.created_at).toLocaleDateString() : 'N/A'}</span></div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {summaryCards.map((card) => (
              <Card key={card.label} className={`border ${card.color}`}>
                <CardContent className="p-4">
                  <p className="text-xs opacity-80">{card.label}</p>
                  <p className="text-xl font-semibold">{card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-kpi-1/30">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg text-kpi-1">Institute Admins</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleExportAdminsCsv}>
                  <Download className="h-4 w-4 mr-1.5" />Export CSV
                </Button>
                <Button size="sm" className="bg-kpi-1 text-white hover:bg-kpi-1/90" onClick={() => setCreateAdminOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />Create Admin
                </Button>
                <input
                  ref={adminCsvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleImportAdminCsv}
                />
                <div className="flex items-center gap-1 rounded-full border border-border bg-background px-1 py-1">
                  <Button size="sm" variant="ghost" onClick={handleDownloadAdminTemplate}>
                    <Download className="h-4 w-4 mr-1.5" />Get Template
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => adminCsvInputRef.current?.click()} disabled={importingAdmins}>
                    <Upload className="h-4 w-4 mr-1.5" />{importingAdmins ? 'Importing...' : 'Import'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                data={data.admins as unknown as Record<string, unknown>[]}
                columns={[
                  { key: 'name', label: 'Name' },
                  { key: 'email', label: 'Email' },
                  { key: 'emp_id', label: 'Emp ID' },
                  { key: 'admin_code', label: 'Admin Code' },
                ]}
                importable={false}
                exportable={false}
              />
            </CardContent>
          </Card>

          <Card className="border-kpi-2/30">
            <CardHeader>
              <CardTitle className="text-lg text-kpi-2">Faculties</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={data.faculties as unknown as Record<string, unknown>[]}
                columns={[
                  { key: 'name', label: 'Name' },
                  { key: 'email', label: 'Email' },
                  { key: 'dept_code', label: 'Department' },
                  { key: 'emp_id', label: 'Emp ID' },
                  { key: 'faculty_code', label: 'Faculty Code' },
                ]}
                importable={false}
              />
            </CardContent>
          </Card>

          <Card className="border-kpi-3/30">
            <CardHeader>
              <CardTitle className="text-lg text-kpi-3">Batches</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={data.batches as unknown as Record<string, unknown>[]}
                columns={[
                  { key: 'batch_code', label: 'Batch Code' },
                  { key: 'course_name', label: 'Course Name' },
                  { key: 'course_code', label: 'Course Code' },
                  { key: 'batch_year', label: 'Batch Year' },
                ]}
                importable={false}
              />
            </CardContent>
          </Card>

          <Card className="border-kpi-4/30">
            <CardHeader>
              <CardTitle className="text-lg text-kpi-4">Students</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={data.students as unknown as Record<string, unknown>[]}
                columns={[
                  { key: 'name', label: 'Name' },
                  { key: 'email', label: 'Email' },
                  { key: 'roll_no', label: 'Roll No' },
                  { key: 'section', label: 'Section' },
                  { key: 'student_code', label: 'Student Code' },
                ]}
                importable={false}
              />
            </CardContent>
          </Card>

          <Card className="border-kpi-5/30">
            <CardHeader>
              <CardTitle className="text-lg text-kpi-5">Exams</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={data.exams as unknown as Record<string, unknown>[]}
                columns={[
                  { key: 'title', label: 'Title' },
                  { key: 'subject_code', label: 'Subject' },
                  { key: 'exam_type', label: 'Type' },
                  { key: 'exam_year', label: 'Year' },
                  { key: 'duration_minutes', label: 'Duration (min)' },
                  { key: 'passing_marks', label: 'Passing Marks' },
                ]}
                importable={false}
              />
            </CardContent>
          </Card>

          <Card className="border-kpi-6/30">
            <CardHeader>
              <CardTitle className="text-lg text-kpi-6">Exam Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={humanSessions as unknown as Record<string, unknown>[]}
                columns={[
                  { key: 'exam_title', label: 'Exam' },
                  { key: 'student_name', label: 'Student' },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (row: any) => {
                      const status = String(row.status || '').toLowerCase();
                      const colorClass = status === 'completed'
                        ? 'bg-success/10 text-success border-success/20'
                        : status === 'submitted'
                          ? 'bg-info/10 text-info border-info/20'
                          : status === 'terminated'
                            ? 'bg-destructive/10 text-destructive border-destructive/20'
                            : 'bg-warning/10 text-warning border-warning/20';
                      return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}>{row.status}</span>;
                    },
                  },
                  { key: 'score', label: 'Score' },
                  { key: 'started_at_display', label: 'Started At' },
                  { key: 'completed_at_display', label: 'Completed At' },
                  {
                    key: 'violation_found',
                    label: 'Violation',
                    render: (row: any) => (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${row.violation_found ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-success/10 text-success border-success/20'}`}>
                        {row.violation_found ? 'Yes' : 'No'}
                      </span>
                    ),
                  },
                ]}
                importable={false}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={createAdminOpen} onOpenChange={setCreateAdminOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Institute Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Admin Name *"
              value={adminForm.name}
              onChange={(e) => setAdminForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Input
              placeholder="Admin Email *"
              type="email"
              value={adminForm.email}
              onChange={(e) => setAdminForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <Input
              placeholder="Password *"
              type="password"
              value={adminForm.password}
              onChange={(e) => setAdminForm((prev) => ({ ...prev, password: e.target.value }))}
            />
            <Input
              placeholder="Employee ID (optional)"
              value={adminForm.empId}
              onChange={(e) => setAdminForm((prev) => ({ ...prev, empId: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateAdminOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateAdmin} className="bg-kpi-1 text-white hover:bg-kpi-1/90">Create Admin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default InstituteDetailsPage;
