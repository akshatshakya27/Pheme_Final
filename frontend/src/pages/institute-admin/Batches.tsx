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
import { Batch } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { createBatch, hardDeleteBatch, importBatches, listBatches, updateBatch } from '@/lib/backendApi';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCsvValue, parseCsv } from '@/lib/csv';

const BatchesPage: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', department: '', year: '' });
  const [editForm, setEditForm] = useState({ name: '', department: '', year: '' });
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ['batches'],
    queryFn: listBatches,
  });

  useEffect(() => {
    if (data) {
      setBatches(data);
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      toast({ title: 'Failed to load batches', description: (error as Error).message, variant: 'destructive' });
    }
  }, [error, toast]);

  const handleAdd = async () => {
    if (!form.name) { toast({ title: 'Error', description: 'Name required', variant: 'destructive' }); return; }
    if (!user?.instituteId && user?.role !== 'super_admin') {
      toast({ title: 'Missing institute context', variant: 'destructive' });
      return;
    }
    try {
      const created = await createBatch({
        instituteId: user?.instituteId,
        courseCode: (form.department || form.name).replace(/\s+/g, '').slice(0, 10).toUpperCase(),
        batchYear: form.year || `${new Date().getFullYear()}`,
        courseName: form.name,
      });
      setBatches((prev) => [created, ...prev]);
      queryClient.setQueryData<Batch[]>(['batches'], (prev = []) => [created, ...prev]);
      setForm({ name: '', department: '', year: '' });
      setAddOpen(false);
      toast({ title: 'Batch Created' });
    } catch (error) {
      toast({ title: 'Failed to create batch', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const downloadTemplate = () => {
    const template = 'course_name,course_code,batch_year\nB.Tech CSE,CSE,2026\n';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'batches_import_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportBatches = () => {
    const headers = ['batch', 'department', 'year', 'students', 'exams', 'avg_score', 'risk'];
    const rows = batches.map((b) => [b.name, b.department, b.year, b.totalStudents, b.totalExams, b.avgScore, b.riskSummary].join(','));
    const content = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'batches_export.csv';
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
        courseName: getCsvValue(row, ['course_name', 'name', 'batch', 'course name']),
        courseCode: getCsvValue(row, ['course_code', 'department', 'dept', 'course code']).replace(/\s+/g, '').toUpperCase(),
        batchYear: getCsvValue(row, ['batch_year', 'year', 'academic year']),
      }));

      const errors: string[] = [];
      const seen = new Set<string>();
      normalized.forEach((row) => {
        if (!row.courseName) errors.push(`Row ${row.index}: course_name is required`);
        if (!row.courseCode) errors.push(`Row ${row.index}: course_code is required`);
        if (!row.batchYear) errors.push(`Row ${row.index}: batch_year is required`);
        if (row.courseCode && row.batchYear) {
          const key = `${row.courseCode}:${row.batchYear}`;
          if (seen.has(key)) errors.push(`Row ${row.index}: duplicate course_code + batch_year in file (${row.courseCode}, ${row.batchYear})`);
          seen.add(key);
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

      const result = await importBatches(normalized.map((row) => ({ courseName: row.courseName, courseCode: row.courseCode, batchYear: row.batchYear })));
      await queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast({ title: 'Import completed', description: `${result.created} batch record(s) created.` });
    } catch (error) {
      toast({ title: 'Import denied', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setImportingCsv(false);
    }
  };

  const openEdit = (item: Batch) => {
    setEditingBatchId(item.id);
    setEditForm({
      name: item.name,
      department: item.department,
      year: item.year,
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingBatchId) return;
    if (!editForm.name || !editForm.department || !editForm.year) {
      toast({ title: 'Error', description: 'Batch name, department, and year are required', variant: 'destructive' });
      return;
    }

    try {
      const updated = await updateBatch(editingBatchId, {
        courseName: editForm.name,
        courseCode: editForm.department.replace(/\s+/g, '').toUpperCase(),
        batchYear: editForm.year,
      });

      setBatches((prev) => prev.map((item) => (
        item.id === editingBatchId ? { ...item, ...updated } : item
      )));
      await queryClient.invalidateQueries({ queryKey: ['batches'] });
      setEditOpen(false);
      setEditingBatchId(null);
      toast({ title: 'Batch Updated' });
    } catch (error) {
      toast({ title: 'Failed to update batch', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const openDeleteDialog = (item: Batch) => {
    setDeletingBatch(item);
    setDeleteConfirmed(false);
    setDeletePassword('');
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingBatch) return;
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
      await hardDeleteBatch({
        batchId: deletingBatch.id,
        confirmDelete: deleteConfirmed,
        password: deletePassword,
      });
      setBatches((prev) => prev.filter((item) => item.id !== deletingBatch.id));
      await queryClient.invalidateQueries({ queryKey: ['batches'] });
      setDeleteOpen(false);
      setDeletingBatch(null);
      setDeleteConfirmed(false);
      setDeletePassword('');
      toast({ title: 'Batch Deleted', description: 'Batch was deleted permanently.' });
    } catch (error) {
      toast({ title: 'Failed to delete batch', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Batch' }, { key: 'department', label: 'Department' }, { key: 'year', label: 'Year' },
    { key: 'totalStudents', label: 'Students' }, { key: 'totalExams', label: 'Exams' },
    { key: 'avgScore', label: 'Avg Score', render: (b: Batch) => <span className="font-semibold">{b.avgScore}%</span> },
    { key: 'riskSummary', label: 'Risk', render: (b: Batch) => <StatusBadge status={b.riskSummary} /> },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Batches" subtitle="Academic batch management" breadcrumbs={[{ label: 'Dashboard', path: '/institute' }, { label: 'Batches' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportBatches}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Create Batch</Button>
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
              <DialogHeader><DialogTitle>Create Batch</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <Input placeholder="Batch Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <Input placeholder="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
                <Input placeholder="Academic Year" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={handleAdd} className="bg-accent text-accent-foreground">Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>

      <DataTable
        data={batches as unknown as Record<string, unknown>[]}
        columns={columns as any}
        importable={false}
        exportable={false}
        actions={(item: any) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(item as Batch)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(item as Batch)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        )}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Batch</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Batch Name *" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            <Input placeholder="Department *" value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} />
            <Input placeholder="Academic Year *" value={editForm.year} onChange={e => setEditForm({ ...editForm, year: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} className="bg-accent text-accent-foreground">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeletingBatch(null);
            setDeleteConfirmed(false);
            setDeletePassword('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Delete batch?</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              This will permanently delete <span className="font-medium">{deletingBatch?.name || 'this batch'}</span>. This action cannot be undone.
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="confirm-batch-delete" checked={deleteConfirmed} onCheckedChange={(checked) => setDeleteConfirmed(checked === true)} />
              <Label htmlFor="confirm-batch-delete">Yes, I want to delete this batch.</Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="batch-delete-password">Enter your password</Label>
              <Input
                id="batch-delete-password"
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
    </DashboardLayout>
  );
};

export default BatchesPage;
