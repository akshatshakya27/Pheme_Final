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
import { Faculty } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { createFaculty, hardDeleteFaculty, importFaculties, listFaculties, updateFaculty } from '@/lib/backendApi';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCsvValue, parseCsv } from '@/lib/csv';

const FacultiesPage: React.FC = () => {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);
  const [deletingFaculty, setDeletingFaculty] = useState<Faculty | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({ name: '', email: '', department: '', designation: '' });
  const [editForm, setEditForm] = useState({ name: '', email: '', department: '', designation: '' });
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ['faculties'],
    queryFn: listFaculties,
  });

  const generateEmpId = () => `EMP${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

  useEffect(() => {
    if (data) {
      setFaculties(data);
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      toast({ title: 'Failed to load faculties', description: (error as Error).message, variant: 'destructive' });
    }
  }, [error, toast]);

  const handleAdd = async () => {
    if (!form.name || !form.email) { toast({ title: 'Error', description: 'Fill required fields', variant: 'destructive' }); return; }
    if (!user?.instituteId) { toast({ title: 'Missing institute context', variant: 'destructive' }); return; }
    try {
      const created = await createFaculty({
        instituteId: user.instituteId,
        name: form.name,
        email: form.email,
        deptCode: (form.department || 'GEN').replace(/\s+/g, '').slice(0, 8).toUpperCase(),
        empId: generateEmpId(),
      });
      setFaculties((prev) => [created, ...prev]);
      queryClient.setQueryData<Faculty[]>(['faculties'], (prev = []) => [created, ...prev]);
      setForm({ name: '', email: '', department: '', designation: '' });
      setAddOpen(false);
      toast({ title: 'Faculty Added', description: `${form.name} added successfully.` });
    } catch (error) {
      toast({ title: 'Failed to add faculty', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const openDeleteDialog = (item: Faculty) => {
    setDeletingFaculty(item);
    setDeleteConfirmed(false);
    setDeletePassword('');
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingFaculty) return;
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
      await hardDeleteFaculty({
        facultyId: deletingFaculty.id,
        confirmDelete: deleteConfirmed,
        password: deletePassword,
      });
      setFaculties((prev) => prev.filter((item) => item.id !== deletingFaculty.id));
      await queryClient.invalidateQueries({ queryKey: ['faculties'] });
      setDeleteOpen(false);
      setDeletingFaculty(null);
      setDeleteConfirmed(false);
      setDeletePassword('');
      toast({ title: 'Faculty Deleted', description: 'Faculty was deleted permanently.' });
    } catch (error) {
      toast({ title: 'Failed to delete faculty', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openEdit = (item: Faculty) => {
    setEditingFacultyId(item.id);
    setEditForm({
      name: item.name,
      email: item.email,
      department: item.department,
      designation: item.designation,
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingFacultyId) return;
    if (!editForm.name || !editForm.email) {
      toast({ title: 'Error', description: 'Name and email are required', variant: 'destructive' });
      return;
    }

    try {
      const updated = await updateFaculty(editingFacultyId, {
        name: editForm.name,
        email: editForm.email,
        deptCode: (editForm.department || 'GEN').replace(/\s+/g, '').slice(0, 8).toUpperCase(),
      });

      setFaculties((prev) => prev.map((item) => (
        item.id === editingFacultyId
          ? { ...item, ...updated, designation: editForm.designation || item.designation }
          : item
      )));
      queryClient.invalidateQueries({ queryKey: ['faculties'] });
      setEditOpen(false);
      setEditingFacultyId(null);
      toast({ title: 'Faculty Updated' });
    } catch (error) {
      toast({ title: 'Failed to update faculty', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const downloadTemplate = () => {
    const template = 'name,email,dept_code,emp_id\nJohn Faculty,john.faculty@institute.edu,CSE,EMP1001\n';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'faculties_import_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportFaculties = () => {
    const headers = ['name', 'email', 'department', 'designation', 'status'];
    const rows = faculties.map((f) => [f.name, f.email, f.department, f.designation, f.status].join(','));
    const content = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'faculties_export.csv';
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
        deptCode: getCsvValue(row, ['dept_code', 'department', 'dept']).replace(/\s+/g, '').toUpperCase(),
        empId: getCsvValue(row, ['emp_id', 'employee_id', 'empid']).toUpperCase(),
      }));

      const errors: string[] = [];
      const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      const seenEmail = new Set<string>();
      const seenDeptEmp = new Set<string>();

      normalized.forEach((row) => {
        if (!row.name) errors.push(`Row ${row.index}: name is required`);
        if (!row.email) errors.push(`Row ${row.index}: email is required`);
        else if (!emailPattern.test(row.email)) errors.push(`Row ${row.index}: invalid email format`);
        if (!row.deptCode) errors.push(`Row ${row.index}: dept_code is required`);

        if (row.email) {
          if (seenEmail.has(row.email)) errors.push(`Row ${row.index}: duplicate email in file (${row.email})`);
          seenEmail.add(row.email);
        }
        if (row.deptCode && row.empId) {
          const key = `${row.deptCode}:${row.empId}`;
          if (seenDeptEmp.has(key)) errors.push(`Row ${row.index}: duplicate dept_code + emp_id in file (${row.deptCode}, ${row.empId})`);
          seenDeptEmp.add(key);
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

      const result = await importFaculties(normalized.map((row) => ({ name: row.name, email: row.email, deptCode: row.deptCode, empId: row.empId || undefined })));
      await queryClient.invalidateQueries({ queryKey: ['faculties'] });
      toast({ title: 'Import completed', description: `${result.created} faculty record(s) created.` });
    } catch (error) {
      toast({ title: 'Import denied', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setImportingCsv(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department' },
    { key: 'designation', label: 'Designation' },
    { key: 'status', label: 'Status', render: (f: Faculty) => <StatusBadge status={f.status} /> },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Faculties" subtitle="Manage faculty members" breadcrumbs={[{ label: 'Dashboard', path: '/institute' }, { label: 'Faculties' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportFaculties}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Faculty</Button>
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
              <DialogHeader><DialogTitle>Add Faculty</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <Input placeholder="Full Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <Input placeholder="Email *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <Input placeholder="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
                <Input placeholder="Designation" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd} className="bg-accent text-accent-foreground">Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

      <DataTable data={faculties as unknown as Record<string, unknown>[]} columns={columns as any} importable={false} exportable={false}
        actions={(item: any) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(item as Faculty)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(item as Faculty)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        )}
      />

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeletingFaculty(null);
            setDeleteConfirmed(false);
            setDeletePassword('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Delete faculty?</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              This will permanently delete <span className="font-medium">{deletingFaculty?.name || 'this faculty'}</span>. This action cannot be undone.
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="confirm-faculty-delete" checked={deleteConfirmed} onCheckedChange={(checked) => setDeleteConfirmed(checked === true)} />
              <Label htmlFor="confirm-faculty-delete">Yes, I want to delete this faculty.</Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="faculty-delete-password">Enter your password</Label>
              <Input
                id="faculty-delete-password"
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
          <DialogHeader><DialogTitle>Edit Faculty</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Full Name *" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            <Input placeholder="Email *" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            <Input placeholder="Department" value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} />
            <Input placeholder="Designation" value={editForm.designation} onChange={e => setEditForm({ ...editForm, designation: e.target.value })} />
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

export default FacultiesPage;
