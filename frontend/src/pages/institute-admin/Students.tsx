import React, { useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';
import DataTable from '@/components/dashboard/DataTable';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Student } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { createUser, hardDeleteStudent, importStudents, listBatches, listUsers, updateStudent } from '@/lib/backendApi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getCsvValue, parseCsv } from '@/lib/csv';

const StudentsPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', enrollmentNo: '', batchName: '' });
  const [editForm, setEditForm] = useState({ name: '', email: '', enrollmentNo: '', batchName: '' });
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: users, error: usersError } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  });
  const { data: batches, error: batchesError } = useQuery({
    queryKey: ['batches'],
    queryFn: listBatches,
  });

  useEffect(() => {
    if (!users || !batches) return;

    const batchById = batches.reduce<Record<string, string>>((acc, batch) => {
      acc[batch.id] = batch.name;
      return acc;
    }, {});

    const mapped = users
      .filter((user) => user.role === 'student')
      .map((user) => ({
        id: user.id,
        name: user.name || user.email,
        email: user.email,
        batchId: user.batch_id || '',
        batchName: user.batch_id ? (batchById[user.batch_id] || user.batch_code || 'Unassigned') : 'Unassigned',
        enrollmentNo: user.roll_no || user.code || '',
        status: 'active' as const,
      }));

    setStudents(mapped);
  }, [users, batches]);

  useEffect(() => {
    const error = usersError || batchesError;
    if (error) {
      toast({ title: 'Failed to load students', description: (error as Error).message, variant: 'destructive' });
    }
  }, [usersError, batchesError, toast]);

  const findBatchByInput = (rawValue: string) => {
    const value = rawValue.trim().toLowerCase();
    if (!value) return (batches || [])[0];

    return (batches || []).find((batch) =>
      [batch.id, batch.name, batch.department].some((field) => field.toLowerCase() === value)
    );
  };

  const handleAdd = async () => {
    if (!form.name || !form.email) { toast({ title: 'Error', description: 'Fill required fields', variant: 'destructive' }); return; }
    try {
      const matchedBatch = findBatchByInput(form.batchName);

      if (!matchedBatch) {
        toast({ title: 'No batch found', description: 'Create a batch first', variant: 'destructive' });
        return;
      }

      await createUser({
        instituteId: user?.instituteId,
        batchId: matchedBatch.id,
        name: form.name,
        email: form.email,
        password: 'ChangeMe@123',
        role: 'student',
        section: 'A',
        rollNo: form.enrollmentNo || Date.now().toString().slice(-4),
      });

      const created: Student = {
        id: `new-${Date.now()}`,
        name: form.name,
        email: form.email,
        batchId: matchedBatch.id,
        batchName: matchedBatch.name,
        enrollmentNo: form.enrollmentNo,
        status: 'active',
      };
      setStudents((prev) => [created, ...prev]);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setForm({ name: '', email: '', enrollmentNo: '', batchName: '' });
      setAddOpen(false);
      toast({ title: 'Student Added' });
    } catch (error) {
      toast({ title: 'Failed to add student', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const downloadTemplate = () => {
    const template = 'name,email,batch_code,section,roll_no,password\nJohn Student,john.student@institute.edu,NOVA01-CSE-2026,A,1001,ChangeMe@123\n';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students_import_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportStudents = () => {
    const headers = ['name', 'email', 'enrollment_no', 'batch', 'status'];
    const rows = students.map((s) => [s.name, s.email, s.enrollmentNo, s.batchName, s.status].join(','));
    const content = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students_export.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setImportingCsv(true);
      const content = await file.text();
      const rows = parseCsv(content);
      if (!rows.length) {
        toast({ title: 'Import denied', description: 'CSV has no data rows.', variant: 'destructive' });
        return;
      }

      const normalized = rows.map((row, index) => ({
        index: index + 1,
        name: getCsvValue(row, ['name', 'full name']),
        email: getCsvValue(row, ['email']).toLowerCase(),
        batchCode: getCsvValue(row, ['batch_code', 'batch']),
        batchId: getCsvValue(row, ['batch_id']),
        section: getCsvValue(row, ['section']).toUpperCase(),
        rollNo: getCsvValue(row, ['roll_no', 'rollno', 'enrollment_no']).toUpperCase(),
        password: getCsvValue(row, ['password']) || 'ChangeMe@123',
      }));

      const errors: string[] = [];
      const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      const seenEmail = new Set<string>();
      const seenRoll = new Set<string>();

      normalized.forEach((row) => {
        if (!row.name) errors.push(`Row ${row.index}: name is required`);
        if (!row.email) errors.push(`Row ${row.index}: email is required`);
        else if (!emailPattern.test(row.email)) errors.push(`Row ${row.index}: invalid email format`);
        if (!row.batchCode && !row.batchId) errors.push(`Row ${row.index}: batch_code or batch_id is required`);
        if (!row.section) errors.push(`Row ${row.index}: section is required`);
        if (!row.rollNo) errors.push(`Row ${row.index}: roll_no is required`);
        if (!row.password || row.password.length < 8) errors.push(`Row ${row.index}: password must be at least 8 characters`);

        if (row.email) {
          if (seenEmail.has(row.email)) errors.push(`Row ${row.index}: duplicate email in file (${row.email})`);
          seenEmail.add(row.email);
        }
        const rollKey = `${row.batchId || row.batchCode}:${row.section}:${row.rollNo}`;
        if (seenRoll.has(rollKey)) errors.push(`Row ${row.index}: duplicate batch+section+roll_no in file (${row.section}, ${row.rollNo})`);
        seenRoll.add(rollKey);
      });

      if (errors.length) {
        toast({
          title: 'Import denied',
          description: errors.slice(0, 3).join(' • ') + (errors.length > 3 ? ` • +${errors.length - 3} more` : ''),
          variant: 'destructive',
        });
        return;
      }

      const result = await importStudents(normalized.map((row) => ({
        name: row.name,
        email: row.email,
        batchCode: row.batchCode || undefined,
        batchId: row.batchId || undefined,
        section: row.section,
        rollNo: row.rollNo,
        password: row.password || undefined,
      })));

      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Import completed', description: `${result.created} student record(s) created.` });
    } catch (error) {
      toast({ title: 'Import denied', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setImportingCsv(false);
    }
  };

  const openDeleteDialog = (item: Student) => {
    setDeletingStudent(item);
    setDeleteConfirmed(false);
    setDeletePassword('');
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingStudent) return;
    if (!deleteConfirmed || !deletePassword.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please check the delete confirmation and enter your password.',
        variant: 'destructive',
      });
      return;
    }

    setDeleteSubmitting(true);
    try {
      await hardDeleteStudent({
        studentId: deletingStudent.id,
        confirmDelete: deleteConfirmed,
        password: deletePassword,
      });
      setStudents((prev) => prev.filter((item) => item.id !== deletingStudent.id));
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteOpen(false);
      setDeletingStudent(null);
      setDeleteConfirmed(false);
      setDeletePassword('');
      toast({ title: 'Student Deleted', description: 'Student was deleted permanently.' });
    } catch (error) {
      toast({ title: 'Failed to delete student', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openEdit = (item: Student) => {
    setEditingStudentId(item.id);
    setEditForm({
      name: item.name,
      email: item.email,
      enrollmentNo: item.enrollmentNo,
      batchName: item.batchName,
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingStudentId) return;
    if (!editForm.name || !editForm.email) {
      toast({ title: 'Error', description: 'Name and email are required', variant: 'destructive' });
      return;
    }

    const matchedBatch = findBatchByInput(editForm.batchName);
    if (!matchedBatch) {
      toast({ title: 'No batch found', description: 'Create a batch first', variant: 'destructive' });
      return;
    }

    try {
      await updateStudent(editingStudentId, {
        name: editForm.name,
        email: editForm.email,
        batchId: matchedBatch.id,
        section: 'A',
        rollNo: editForm.enrollmentNo || Date.now().toString().slice(-6),
      });

      setStudents((prev) => prev.map((item) => (
        item.id === editingStudentId
          ? {
              ...item,
              name: editForm.name,
              email: editForm.email,
              enrollmentNo: editForm.enrollmentNo,
              batchId: matchedBatch.id,
              batchName: matchedBatch.name,
            }
          : item
      )));
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditOpen(false);
      setEditingStudentId(null);
      toast({ title: 'Student Updated' });
    } catch (error) {
      toast({ title: 'Failed to update student', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const columns = [
    { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
    { key: 'enrollmentNo', label: 'Enrollment No' }, { key: 'batchName', label: 'Batch' },
    { key: 'status', label: 'Status', render: (s: Student) => <StatusBadge status={s.status} /> },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Students" subtitle="Manage student records" breadcrumbs={[{ label: 'Dashboard', path: '/institute' }, { label: 'Students' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportStudents}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Student</Button>
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
            <div className="flex items-center gap-1 rounded-full border border-border bg-background px-1 py-1">
              <Button size="sm" variant="ghost" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1.5" />Get Template</Button>
              <Button size="sm" variant="ghost" onClick={() => csvInputRef.current?.click()} disabled={importingCsv}><Upload className="h-4 w-4 mr-1.5" />{importingCsv ? 'Importing...' : 'Import'}</Button>
            </div>
          </div>
        }
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <Input placeholder="Full Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <Input placeholder="Email *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <Input placeholder="Enrollment No" value={form.enrollmentNo} onChange={e => setForm({ ...form, enrollmentNo: e.target.value })} />
                <Input placeholder="Batch" value={form.batchName} onChange={e => setForm({ ...form, batchName: e.target.value })} />
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={handleAdd} className="bg-accent text-accent-foreground">Add</Button></DialogFooter>
            </DialogContent>
          </Dialog>

      <DataTable data={students as unknown as Record<string, unknown>[]} columns={columns as any} importable={false} exportable={false}
        actions={(item: any) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(item as Student)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(item as Student)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        )}
      />

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeletingStudent(null);
            setDeleteConfirmed(false);
            setDeletePassword('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Delete student?</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              This will permanently delete <span className="font-medium">{deletingStudent?.name || 'this student'}</span>. This action cannot be undone.
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="confirm-student-delete" checked={deleteConfirmed} onCheckedChange={(checked) => setDeleteConfirmed(checked === true)} />
              <Label htmlFor="confirm-student-delete">Yes, I want to delete this student.</Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="student-delete-password">Enter your password</Label>
              <Input
                id="student-delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Your account password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteSubmitting}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!deleteConfirmed || !deletePassword.trim() || deleteSubmitting}
              onClick={() => void handleDelete()}
            >
              {deleteSubmitting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Student</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Full Name *" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            <Input placeholder="Email *" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            <Input placeholder="Enrollment No" value={editForm.enrollmentNo} onChange={e => setEditForm({ ...editForm, enrollmentNo: e.target.value })} />
            <Input placeholder="Batch" value={editForm.batchName} onChange={e => setEditForm({ ...editForm, batchName: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} className="bg-accent text-accent-foreground">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default StudentsPage;
