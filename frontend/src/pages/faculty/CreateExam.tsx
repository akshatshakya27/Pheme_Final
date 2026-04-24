import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Batch, Question } from '@/types';
import { Plus, Trash2, ChevronRight, ChevronLeft, Check, ChevronDown } from 'lucide-react';
import { createAssignment, createExam, createQuestion, listBatches } from '@/lib/backendApi';
import { useQuery } from '@tanstack/react-query';

const steps = ['Basic Details', 'Questions', 'Assign Batches', 'Assign Proctors', 'Schedule', 'Review'];

const CreateExamPage: React.FC = () => {
  const [step, setStep] = useState(0);
  const [exam, setExam] = useState({
    title: '',
    description: '',
    subjectCode: '',
    examType: 'ONLINE',
    examYear: `${new Date().getFullYear()}`,
    duration: 60,
    totalMarks: 100,
    mode: 'online' as string,
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qForm, setQForm] = useState({ type: 'mcq' as 'mcq' | 'short_answer', text: '', options: ['', '', '', ''], correctAnswer: '', marks: 2 });
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [schedule, setSchedule] = useState({
    startDate: '',
    startHour: '10',
    startMinute: '30',
    startAmPm: 'AM',
    endDate: '',
    endHour: '12',
    endMinute: '30',
    endAmPm: 'PM',
    lateEntry: false,
  });
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: batches = [], error } = useQuery<Batch[]>({
    queryKey: ['batches', 'for-create-exam'],
    queryFn: listBatches,
  });

  useEffect(() => {
    if (error) {
      toast({ title: 'Failed to load batches', description: (error as Error).message, variant: 'destructive' });
    }
  }, [error, toast]);

  const addQuestion = () => {
    if (!qForm.text) { toast({ title: 'Error', description: 'Question text required', variant: 'destructive' }); return; }
    setQuestions([...questions, { id: `q-${Date.now()}`, ...qForm }]);
    setQForm({ type: 'mcq', text: '', options: ['', '', '', ''], correctAnswer: '', marks: 2 });
  };

  const removeQuestion = (id: string) => setQuestions(questions.filter(q => q.id !== id));

  const formatDateLabel = (dateValue: string) => {
    if (!dateValue) return 'Select date';
    const parsed = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return 'Select date';
    return parsed.toLocaleDateString();
  };

  const buildDateTime = (dateValue: string, hour: string, minute: string, amPm: string) => {
    if (!dateValue || !hour || !minute || !amPm) return null;
    let parsedHour = Number.parseInt(hour, 10);
    if (Number.isNaN(parsedHour)) return null;
    if (amPm === 'PM' && parsedHour < 12) parsedHour += 12;
    if (amPm === 'AM' && parsedHour === 12) parsedHour = 0;
    const timeValue = `${parsedHour.toString().padStart(2, '0')}:${minute}:00`;
    const parsed = new Date(`${dateValue}T${timeValue}`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const handlePublish = async () => {
    if (!exam.title.trim()) {
      toast({ title: 'Validation Error', description: 'Exam title is required.', variant: 'destructive' });
      return;
    }
    if (!exam.subjectCode.trim()) {
      toast({ title: 'Validation Error', description: 'Subject code is required.', variant: 'destructive' });
      return;
    }
    if (exam.duration <= 0 || exam.totalMarks <= 0) {
      toast({ title: 'Validation Error', description: 'Duration and total marks must be greater than 0.', variant: 'destructive' });
      return;
    }
    if (!questions.length) {
      toast({ title: 'Validation Error', description: 'Add at least one question before publishing.', variant: 'destructive' });
      return;
    }
    if (!selectedBatches.length) {
      toast({ title: 'Validation Error', description: 'Assign at least one batch before publishing.', variant: 'destructive' });
      return;
    }
    const startAt = buildDateTime(schedule.startDate, schedule.startHour, schedule.startMinute, schedule.startAmPm);
    const endAt = buildDateTime(schedule.endDate, schedule.endHour, schedule.endMinute, schedule.endAmPm);

    if (schedule.startDate && !startAt) {
      toast({ title: 'Validation Error', description: 'Invalid start date/time.', variant: 'destructive' });
      return;
    }
    if (schedule.endDate && !endAt) {
      toast({ title: 'Validation Error', description: 'Invalid end date/time.', variant: 'destructive' });
      return;
    }
    if (startAt && endAt && endAt <= startAt) {
      toast({ title: 'Validation Error', description: 'End time must be after start time.', variant: 'destructive' });
      return;
    }

    try {
      const normalizedSubjectCode = exam.subjectCode.trim().replace(/\s+/g, '').toUpperCase();
      const payload = {
        title: exam.title,
        subjectCode: normalizedSubjectCode,
        examType: exam.examType,
        examYear: exam.examYear,
        duration: exam.duration,
        passingMarks: Math.max(1, Math.floor(exam.totalMarks * 0.4)),
        scheduledTime: startAt ? startAt.toISOString() : undefined,
        endTime: endAt ? endAt.toISOString() : undefined,
      };

      let createdExam;
      try {
        createdExam = await createExam(payload);
      } catch (error) {
        const message = (error as Error).message || '';
        if (!message.toLowerCase().includes('similar generated code')) {
          throw error;
        }
        const suffix = Date.now().toString().slice(-4);
        createdExam = await createExam({
          ...payload,
          subjectCode: `${normalizedSubjectCode}${suffix}`.slice(0, 50),
        });
        toast({
          title: 'Code conflict resolved',
          description: 'A unique exam code was generated automatically for publish.',
        });
      }

      await Promise.all(
        questions.map((question) =>
          createQuestion({
            examId: createdExam.id,
            text: question.text,
            marks: question.marks,
            options: question.options?.filter(Boolean) || ['True', 'False'],
            correctAnswer: question.correctAnswer || question.options?.find(Boolean) || 'True',
          })
        )
      );

      await Promise.all(selectedBatches.map((batchId) => createAssignment(createdExam.id, batchId)));

      toast({ title: 'Exam Published!', description: `${exam.title} is now visible to assigned batches.` });
      navigate('/faculty/exams');
    } catch (error) {
      toast({ title: 'Failed to publish exam', description: (error as Error).message, variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <PageHeader title="Create Exam" subtitle="Multi-step exam wizard" breadcrumbs={[{ label: 'Dashboard', path: '/faculty' }, { label: 'Create Exam' }]} />

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 shrink-0">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              i < step ? 'bg-success text-success-foreground' : i === step ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{s}</span>
            {i < steps.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <div className="bg-card rounded-lg p-6 shadow-card max-w-3xl">
        {step === 0 && (
          <div className="space-y-4">
            <Input placeholder="Exam Title *" value={exam.title} onChange={e => setExam({ ...exam, title: e.target.value })} />
            <Textarea placeholder="Description" value={exam.description} onChange={e => setExam({ ...exam, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Subject Code *" value={exam.subjectCode} onChange={e => setExam({ ...exam, subjectCode: e.target.value.toUpperCase() })} />
              <Input placeholder="Exam Year" value={exam.examYear} onChange={e => setExam({ ...exam, examYear: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" placeholder="Duration (min)" value={exam.duration} onChange={e => setExam({ ...exam, duration: Number(e.target.value) })} />
              <Input type="number" placeholder="Total Marks" value={exam.totalMarks} onChange={e => setExam({ ...exam, totalMarks: Number(e.target.value) })} />
            </div>
            <Select value={exam.examType} onValueChange={(v) => setExam({ ...exam, examType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ONLINE">Online</SelectItem>
                <SelectItem value="HYBRID">Hybrid</SelectItem>
                <SelectItem value="OFFLINE">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <Select value={qForm.type} onValueChange={(v: 'mcq' | 'short_answer') => setQForm({ ...qForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="mcq">Multiple Choice</SelectItem><SelectItem value="short_answer">Short Answer</SelectItem></SelectContent>
              </Select>
              <Textarea placeholder="Question text *" value={qForm.text} onChange={e => setQForm({ ...qForm, text: e.target.value })} />
              {qForm.type === 'mcq' && qForm.options.map((opt, i) => (
                <Input key={i} placeholder={`Option ${i + 1}`} value={opt} onChange={e => {
                  const opts = [...qForm.options]; opts[i] = e.target.value; setQForm({ ...qForm, options: opts });
                }} />
              ))}
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="Correct Answer" value={qForm.correctAnswer} onChange={e => setQForm({ ...qForm, correctAnswer: e.target.value })} />
                <Input type="number" placeholder="Marks" value={qForm.marks} onChange={e => setQForm({ ...qForm, marks: Number(e.target.value) })} />
              </div>
              <Button onClick={addQuestion} className="bg-accent text-accent-foreground"><Plus className="h-4 w-4 mr-1" />Add Question</Button>
            </div>
            {questions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{questions.length} question(s) added</p>
                {questions.map((q, i) => (
                  <div key={q.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm"><strong>Q{i + 1}:</strong> {q.text} <span className="text-muted-foreground">({q.marks} marks)</span></span>
                    <Button variant="ghost" size="sm" onClick={() => removeQuestion(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-2">Select batches to assign this exam:</p>
            {batches.map(b => (
              <label key={b.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                <Checkbox checked={selectedBatches.includes(b.id)} onCheckedChange={(checked) => {
                  setSelectedBatches(checked ? [...selectedBatches, b.id] : selectedBatches.filter(id => id !== b.id));
                }} />
                <div>
                  <p className="text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.department} · {b.totalStudents} students</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Maximum 3 proctors (including you). You are auto-assigned.</p>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">Prof. James Wilson (You)</p>
              <p className="text-xs text-muted-foreground">Auto-assigned as creator</p>
            </div>
            <p className="text-xs text-muted-foreground">Additional proctors can be added after creation.</p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="start-date" className="px-1">Start Date</Label>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" id="start-date" className="w-full justify-between font-normal">
                      {formatDateLabel(schedule.startDate)}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={schedule.startDate ? new Date(`${schedule.startDate}T00:00:00`) : undefined}
                      onSelect={(date) => {
                        if (!date) return;
                        const y = date.getFullYear();
                        const m = `${date.getMonth() + 1}`.padStart(2, '0');
                        const d = `${date.getDate()}`.padStart(2, '0');
                        setSchedule((prev) => ({ ...prev, startDate: `${y}-${m}-${d}` }));
                        setStartDateOpen(false);
                      }}
                      captionLayout="dropdown"
                    />
                  </PopoverContent>
                </Popover>
                <div className="space-y-2">
                  <Label htmlFor="time-from" className="px-1">From</Label>
                  <div className="flex items-center gap-2">
                    <Select value={schedule.startHour} onValueChange={(value) => setSchedule((prev) => ({ ...prev, startHour: value }))}>
                      <SelectTrigger id="time-from" className="w-[72px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, index) => {
                          const value = (index + 1).toString().padStart(2, '0');
                          return <SelectItem key={value} value={value}>{value}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    <span>:</span>
                    <Select value={schedule.startMinute} onValueChange={(value) => setSchedule((prev) => ({ ...prev, startMinute: value }))}>
                      <SelectTrigger className="w-[78px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['00', '15', '30', '45'].map((value) => (
                          <SelectItem key={value} value={value}>{value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={schedule.startAmPm} onValueChange={(value) => setSchedule((prev) => ({ ...prev, startAmPm: value }))}>
                      <SelectTrigger className="w-[78px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="PM">PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="end-date" className="px-1">End Date</Label>
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" id="end-date" className="w-full justify-between font-normal">
                      {formatDateLabel(schedule.endDate)}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={schedule.endDate ? new Date(`${schedule.endDate}T00:00:00`) : undefined}
                      onSelect={(date) => {
                        if (!date) return;
                        const y = date.getFullYear();
                        const m = `${date.getMonth() + 1}`.padStart(2, '0');
                        const d = `${date.getDate()}`.padStart(2, '0');
                        setSchedule((prev) => ({ ...prev, endDate: `${y}-${m}-${d}` }));
                        setEndDateOpen(false);
                      }}
                      captionLayout="dropdown"
                    />
                  </PopoverContent>
                </Popover>
                <div className="space-y-2">
                  <Label htmlFor="time-to" className="px-1">To</Label>
                  <div className="flex items-center gap-2">
                    <Select value={schedule.endHour} onValueChange={(value) => setSchedule((prev) => ({ ...prev, endHour: value }))}>
                      <SelectTrigger id="time-to" className="w-[72px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, index) => {
                          const value = (index + 1).toString().padStart(2, '0');
                          return <SelectItem key={value} value={value}>{value}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    <span>:</span>
                    <Select value={schedule.endMinute} onValueChange={(value) => setSchedule((prev) => ({ ...prev, endMinute: value }))}>
                      <SelectTrigger className="w-[78px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['00', '15', '30', '45'].map((value) => (
                          <SelectItem key={value} value={value}>{value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={schedule.endAmPm} onValueChange={(value) => setSchedule((prev) => ({ ...prev, endAmPm: value }))}>
                      <SelectTrigger className="w-[78px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="PM">PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={schedule.lateEntry} onCheckedChange={(c) => setSchedule({ ...schedule, lateEntry: !!c })} />
              <span className="text-sm">Allow late entry</span>
            </label>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Review & Publish</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Title:</span> {exam.title || 'Not set'}</div>
              <div><span className="text-muted-foreground">Duration:</span> {exam.duration} min</div>
              <div><span className="text-muted-foreground">Total Marks:</span> {exam.totalMarks}</div>
              <div><span className="text-muted-foreground">Subject Code:</span> {exam.subjectCode || 'Not set'}</div>
              <div><span className="text-muted-foreground">Exam Type:</span> {exam.examType}</div>
              <div><span className="text-muted-foreground">Exam Year:</span> {exam.examYear}</div>
              <div><span className="text-muted-foreground">Questions:</span> {questions.length}</div>
              <div><span className="text-muted-foreground">Batches:</span> {selectedBatches.length}</div>
              <div><span className="text-muted-foreground">Start:</span> {schedule.startDate ? `${schedule.startDate} ${schedule.startHour}:${schedule.startMinute} ${schedule.startAmPm}` : 'Not set'}</div>
              <div><span className="text-muted-foreground">End:</span> {schedule.endDate ? `${schedule.endDate} ${schedule.endHour}:${schedule.endMinute} ${schedule.endAmPm}` : 'Not set'}</div>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(s => s - 1)}><ChevronLeft className="h-4 w-4 mr-1" />Back</Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} className="bg-accent text-accent-foreground">Next<ChevronRight className="h-4 w-4 ml-1" /></Button>
          ) : (
            <Button onClick={handlePublish} className="bg-success text-success-foreground hover:bg-success/90">Publish Exam</Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CreateExamPage;
