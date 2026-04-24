import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';
import DataTable from '@/components/dashboard/DataTable';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Archive, Eye, Pencil, Trash2, Play } from 'lucide-react';
import { Exam, Question } from '@/types';
import { useNavigate } from 'react-router-dom';
import { hardDeleteExam, listExams, listQuestionsForExam, updateExam } from '@/lib/backendApi';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const toDateTimeInputValue = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const MyExamsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [viewExam, setViewExam] = useState<Exam | null>(null);
  const [viewQuestions, setViewQuestions] = useState<Question[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', duration: '', totalMarks: '', startDate: '', endDate: '' });
  const { data: exams = [], error } = useQuery({
    queryKey: ['exams', 'faculty'],
    queryFn: listExams,
  });

  useEffect(() => {
    if (error) {
      toast({ title: 'Failed to load exams', description: (error as Error).message, variant: 'destructive' });
    }
  }, [error, toast]);

  const openEdit = (item: Exam) => {
    setEditingExamId(item.id);
    setEditForm({
      title: item.title,
      duration: String(item.duration),
      totalMarks: String(item.totalMarks),
      startDate: toDateTimeInputValue(item.startDate),
      endDate: toDateTimeInputValue(item.endDate),
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingExamId) return;
    if (!editForm.title || !editForm.duration || !editForm.totalMarks) {
      toast({ title: 'Validation Error', description: 'Title, duration, and marks are required', variant: 'destructive' });
      return;
    }

    try {
      await updateExam(editingExamId, {
        title: editForm.title,
        duration: Number(editForm.duration),
        passingMarks: Number(editForm.totalMarks),
        scheduledTime: editForm.startDate ? new Date(editForm.startDate).toISOString() : undefined,
        endTime: editForm.endDate ? new Date(editForm.endDate).toISOString() : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['exams', 'faculty'] });
      setEditOpen(false);
      setEditingExamId(null);
      toast({ title: 'Exam Updated' });
    } catch (editError) {
      toast({ title: 'Failed to update exam', description: (editError as Error).message, variant: 'destructive' });
    }
  };

  const openView = async (item: Exam) => {
    setViewExam(item);
    setViewQuestions([]);
    setViewOpen(true);
    setViewLoading(true);
    try {
      const questions = await listQuestionsForExam(item.id);
      setViewQuestions(questions);
    } catch (viewError) {
      toast({ title: 'Failed to load exam details', description: (viewError as Error).message, variant: 'destructive' });
    } finally {
      setViewLoading(false);
    }
  };

  const handleSoftDelete = async (item: Exam) => {
    try {
      await updateExam(item.id, {
        title: item.title.includes('(Archived)') ? item.title : `${item.title} (Archived)`,
        endTime: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['exams', 'faculty'] });
      toast({ title: 'Exam Archived', description: 'Exam was soft deleted (archived) successfully.' });
    } catch (deleteError) {
      toast({ title: 'Failed to archive exam', description: (deleteError as Error).message, variant: 'destructive' });
    }
  };

  const openHardDelete = (item: Exam) => {
    setDeletingExam(item);
    setDeleteConfirmed(false);
    setDeletePassword('');
    setDeleteOpen(true);
  };

  const handleHardDelete = async () => {
    if (!deletingExam) return;
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
      await hardDeleteExam({
        examId: deletingExam.id,
        confirmDelete: deleteConfirmed,
        password: deletePassword,
      });
      queryClient.invalidateQueries({ queryKey: ['exams', 'faculty'] });
      setDeleteOpen(false);
      setDeletingExam(null);
      setDeleteConfirmed(false);
      setDeletePassword('');
      toast({ title: 'Exam Deleted', description: 'Exam was deleted permanently.' });
    } catch (deleteError) {
      toast({ title: 'Failed to delete exam', description: (deleteError as Error).message, variant: 'destructive' });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const visibleExams = exams.filter((exam) => !exam.title.includes('(Archived)'));

  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'batches', label: 'Batches', render: (e: Exam) => `${e.batches.length} batch(es)` },
    { key: 'startDate', label: 'Date', render: (e: Exam) => new Date(e.startDate).toLocaleDateString() },
    { key: 'duration', label: 'Duration', render: (e: Exam) => `${e.duration} min` },
    { key: 'status', label: 'Status', render: (e: Exam) => <StatusBadge status={e.status} /> },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="My Exams" subtitle="All created and assigned exams" breadcrumbs={[{ label: 'Dashboard', path: '/faculty' }, { label: 'My Exams' }]} />
      <DataTable data={visibleExams as unknown as Record<string, unknown>[]} columns={columns as any}
        actions={(item: any) => (
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => void openView(item as Exam)}><Eye className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>View exam details</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" disabled={item.status === 'live' || item.status === 'completed'} onClick={() => openEdit(item as Exam)}><Pencil className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>Edit exam</TooltipContent>
            </Tooltip>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={item.status === 'live' || item.status === 'completed'}><Archive className="h-4 w-4" /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Archive exam</TooltipContent>
                  </Tooltip>
                </span>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive exam?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This is a soft delete. The exam will be hidden from My Exams but retained in records.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleSoftDelete(item as Exam)}>Archive</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={item.status === 'live' || item.status === 'completed'}
                  onClick={() => openHardDelete(item as Exam)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete exam permanently</TooltipContent>
            </Tooltip>

            {item.status === 'live' && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/faculty/proctoring')} className="text-success"><Play className="h-4 w-4" /></Button>
            )}
          </div>
        )}
      />

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Exam Details</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Title:</span> {viewExam?.title || '-'}</div>
            <div><span className="text-muted-foreground">Duration:</span> {viewExam ? `${viewExam.duration} min` : '-'}</div>
            <div><span className="text-muted-foreground">Marks:</span> {viewExam?.totalMarks ?? '-'}</div>
            <div><span className="text-muted-foreground">Status:</span> {viewExam?.status || '-'}</div>
            <div><span className="text-muted-foreground">Start:</span> {viewExam?.startDate ? new Date(viewExam.startDate).toLocaleString() : 'Not set'}</div>
            <div><span className="text-muted-foreground">End:</span> {viewExam?.endDate ? new Date(viewExam.endDate).toLocaleString() : 'Not set'}</div>
            <div><span className="text-muted-foreground">Questions:</span> {viewLoading ? 'Loading...' : viewQuestions.length}</div>
            {!viewLoading && (
              <div className="pt-2">
                <div className="text-muted-foreground mb-1">Question list:</div>
                {viewQuestions.length === 0 ? (
                  <div>No questions added yet.</div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {viewQuestions.map((question, index) => (
                      <div key={question.id} className="rounded-md border p-2">
                        <div className="font-medium">Q{index + 1}. {question.text}</div>
                        <div className="text-xs text-muted-foreground">Type: {question.type === 'short_answer' ? 'Short Answer' : 'MCQ'} • Marks: {question.marks}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeletingExam(null);
            setDeleteConfirmed(false);
            setDeletePassword('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Delete exam permanently?</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              This will permanently delete <span className="font-medium">{deletingExam?.title || 'this exam'}</span> and related records. This action cannot be undone.
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="confirm-exam-delete" checked={deleteConfirmed} onCheckedChange={(checked) => setDeleteConfirmed(checked === true)} />
              <Label htmlFor="confirm-exam-delete">Yes, I want to delete this exam.</Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="exam-delete-password">Enter your password</Label>
              <Input
                id="exam-delete-password"
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
              onClick={() => void handleHardDelete()}
            >
              {deleteSubmitting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Exam</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            <Input placeholder="Duration (min)" type="number" value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })} />
            <Input placeholder="Passing Marks" type="number" value={editForm.totalMarks} onChange={(e) => setEditForm({ ...editForm, totalMarks: e.target.value })} />
            <Input placeholder="Start Date" type="datetime-local" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
            <Input placeholder="End Date" type="datetime-local" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyExamsPage;
