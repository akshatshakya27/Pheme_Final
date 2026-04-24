import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';
import DataTable from '@/components/dashboard/DataTable';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Eye, Pencil, KeyRound, Ban, CheckCircle, Trash2 } from 'lucide-react';
import { Institute } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { createInstitute, createUser, deleteInstitute, listInstitutes, resetInstituteAdminPassword, updateInstitute } from '@/lib/backendApi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const InstitutesPage: React.FC = () => {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingInstituteId, setEditingInstituteId] = useState<string | null>(null);
  const [resetInstituteId, setResetInstituteId] = useState<string | null>(null);
  const [deletingInstitute, setDeletingInstitute] = useState<Institute | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
  const [resetForm, setResetForm] = useState({ adminEmail: '', newPassword: '', confirmPassword: '' });
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ['institutes'],
    queryFn: listInstitutes,
  });

  useEffect(() => {
    if (data) {
      setInstitutes(data);
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      toast({ title: 'Failed to load institutes', description: (error as Error).message, variant: 'destructive' });
    }
  }, [error, toast]);

  const handleAdd = async () => {
    if (!form.name || !form.email || !form.adminEmail) {
      toast({ title: 'Validation Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    try {
      const baseCode = form.name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const instituteCode = `${(baseCode || 'INST').slice(0, 5)}${Date.now().toString().slice(-4)}`;
      const created = await createInstitute({
        instituteCode,
        name: form.name,
        address: form.phone,
        contactEmail: form.email,
      });

      if (form.adminName && form.adminEmail) {
        await createUser({
          instituteId: created.id,
          name: form.adminName,
          email: form.adminEmail,
          password: form.adminPassword || 'ChangeMe@123',
          role: 'institute_admin',
          empId: `ADM${Date.now().toString().slice(-4)}`,
        });
      }

      setInstitutes((prev) => [created, ...prev]);
      queryClient.setQueryData<Institute[]>(['institutes'], (prev = []) => [created, ...prev]);
      setForm({ name: '', email: '', phone: '', adminName: '', adminEmail: '', adminPassword: '' });
      setAddOpen(false);
      toast({ title: 'Institute Added', description: `${form.name} has been successfully added.` });
    } catch (error) {
      toast({ title: 'Failed to add institute', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const toggleStatus = (id: string) => {
    setInstitutes(prev => prev.map(i => i.id === id ? { ...i, status: i.status === 'active' ? 'suspended' : 'active' } : i));
    toast({ title: 'Status Updated', description: 'Institute status has been changed.' });
  };

  const openEdit = (item: Institute) => {
    setEditingInstituteId(item.id);
    setEditForm({
      name: item.name,
      email: item.email,
      phone: item.phone,
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingInstituteId) return;
    if (!editForm.name || !editForm.email) {
      toast({ title: 'Validation Error', description: 'Name and email are required', variant: 'destructive' });
      return;
    }

    try {
      const updated = await updateInstitute(editingInstituteId, {
        name: editForm.name,
        contactEmail: editForm.email,
        address: editForm.phone,
      });
      setInstitutes((prev) => prev.map((item) => (item.id === editingInstituteId ? { ...item, ...updated } : item)));
      queryClient.invalidateQueries({ queryKey: ['institutes'] });
      setEditOpen(false);
      setEditingInstituteId(null);
      toast({ title: 'Institute Updated' });
    } catch (error) {
      toast({ title: 'Failed to update institute', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const openDeleteDialog = (item: Institute) => {
    setDeletingInstitute(item);
    setDeleteConfirmed(false);
    setDeletePassword('');
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingInstitute) return;
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
      await deleteInstitute({
        instituteId: deletingInstitute.id,
        confirmDelete: deleteConfirmed,
        password: deletePassword,
      });
      setInstitutes((prev) => prev.filter((item) => item.id !== deletingInstitute.id));
      queryClient.setQueryData<Institute[]>(['institutes'], (prev = []) => prev.filter((item) => item.id !== deletingInstitute.id));
      toast({ title: 'Institute Deleted', description: `${deletingInstitute.name} has been removed.` });
      setDeleteOpen(false);
      setDeletingInstitute(null);
      setDeleteConfirmed(false);
      setDeletePassword('');
    } catch (error) {
      toast({ title: 'Failed to delete institute', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openResetPassword = (item: Institute) => {
    setResetInstituteId(item.id);
    setResetForm({ adminEmail: item.adminEmail || '', newPassword: '', confirmPassword: '' });
    setResetOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetInstituteId) return;

    if (!resetForm.newPassword || resetForm.newPassword.length < 8) {
      toast({ title: 'Validation Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      toast({ title: 'Validation Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    try {
      const updatedCount = await resetInstituteAdminPassword({
        instituteId: resetInstituteId,
        newPassword: resetForm.newPassword,
        adminEmail: resetForm.adminEmail || undefined,
      });
      setResetOpen(false);
      setResetInstituteId(null);
      setResetForm({ adminEmail: '', newPassword: '', confirmPassword: '' });
      toast({ title: 'Password Reset Successful', description: `Updated ${updatedCount} admin account(s).` });
    } catch (error) {
      toast({ title: 'Failed to reset password', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const columns = [
    { key: 'name', label: 'Institute Name' },
    { key: 'status', label: 'Status', render: (i: Institute) => <StatusBadge status={i.status} /> },
    { key: 'totalBatches', label: 'Batches' },
    { key: 'totalStudents', label: 'Students' },
    { key: 'totalFaculties', label: 'Faculty' },
    { key: 'totalExams', label: 'Exams' },
    { key: 'riskScore', label: 'Risk', render: (i: Institute) => (
      <span className={`font-semibold ${i.riskScore > 20 ? 'text-destructive' : i.riskScore > 10 ? 'text-warning' : 'text-success'}`}>
        {i.riskScore}%
      </span>
    )},
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Institutes"
        subtitle="Manage all registered institutes"
        breadcrumbs={[{ label: 'Dashboard', path: '/super-admin' }, { label: 'Institutes' }]}
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="h-4 w-4 mr-1.5" />Add Institute</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add New Institute</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <Input placeholder="Institute Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <Input placeholder="Contact Email *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <Input placeholder="Contact Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <Input placeholder="Admin Name" value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })} />
                <Input placeholder="Admin Email *" type="email" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} />
                <Input placeholder="Admin Password" type="password" value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd} className="bg-accent text-accent-foreground hover:bg-accent/90">Add Institute</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <DataTable
        data={institutes as unknown as Record<string, unknown>[]}
        columns={columns as any}
        actions={(item: any) => (
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/super-admin/institutes/${item.id}`)}><Eye className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>View institute details</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => openEdit(item as Institute)}><Pencil className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>Edit institute</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => openResetPassword(item as Institute)}><KeyRound className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>Reset institute admin password</TooltipContent>
            </Tooltip>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm">
                        {item.status === 'active' ? <Ban className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-success" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{item.status === 'active' ? 'Suspend institute access' : 'Activate institute access'}</TooltipContent>
                  </Tooltip>
                </span>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Action</AlertDialogTitle>
                  <AlertDialogDescription>
                    {item.status === 'active' ? 'Suspend this institute? All users will lose access.' : 'Activate this institute?'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => toggleStatus(item.id)}>Confirm</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(item as Institute)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete institute permanently</TooltipContent>
            </Tooltip>
          </div>
        )}
      />

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeletingInstitute(null);
            setDeleteConfirmed(false);
            setDeletePassword('');
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Delete institute?</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              This will permanently delete <span className="font-medium">{deletingInstitute?.name || 'this institute'}</span> and all linked records. This action cannot be undone.
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="confirm-institute-delete" checked={deleteConfirmed} onCheckedChange={(checked) => setDeleteConfirmed(checked === true)} />
              <Label htmlFor="confirm-institute-delete">Yes, I want to delete this institute.</Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="institute-delete-password">Enter your password</Label>
              <Input
                id="institute-delete-password"
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Institute</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Institute Name *" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            <Input placeholder="Contact Email *" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            <Input placeholder="Contact Phone" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} className="bg-accent text-accent-foreground hover:bg-accent/90">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Reset Institute Admin Password</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Admin Email (optional for all admins)"
              type="email"
              value={resetForm.adminEmail}
              onChange={e => setResetForm({ ...resetForm, adminEmail: e.target.value })}
            />
            <Input
              placeholder="New Password *"
              type="password"
              value={resetForm.newPassword}
              onChange={e => setResetForm({ ...resetForm, newPassword: e.target.value })}
            />
            <Input
              placeholder="Confirm Password *"
              type="password"
              value={resetForm.confirmPassword}
              onChange={e => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} className="bg-accent text-accent-foreground hover:bg-accent/90">Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default InstitutesPage;
