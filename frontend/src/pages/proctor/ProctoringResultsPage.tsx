import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreVertical, Camera, Radio, User } from 'lucide-react';

interface Exam {
  id: string;
  title: string;
}

interface DummyStudent {
  id: string;
  name: string;
}

export default function ProctoringResultsPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  const dummyStudents: DummyStudent[] = useMemo(
    () => [
      { id: 'ST-001', name: 'Aarav Sharma' },
      { id: 'ST-002', name: 'Neha Verma' },
      { id: 'ST-003', name: 'Rohan Gupta' },
      { id: 'ST-004', name: 'Priya Singh' },
      { id: 'ST-005', name: 'Karthik Iyer' },
      { id: 'ST-006', name: 'Meera Nair' },
    ],
    []
  );

  useEffect(() => {
    fetchExam();
  }, [examId]);

  const fetchExam = async () => {
    try {
      setLoading(true);
      const response = await api.get('/exams/');
      const found = (response.data || []).find((item: Exam) => item.id === examId);
      setExam(found || null);
    } catch (error) {
      console.error('Failed to fetch exam details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (student: DummyStudent, action: string) => {
    if (action === 'Open live panel') {
      navigate(
        `/proctor/live/${examId}-${student.id}?examId=${examId}&studentId=${student.id}&studentName=${encodeURIComponent(
          student.name
        )}&mode=two-way`
      );
      return;
    }

    console.log(`[DUMMY ACTION] ${action} for ${student.name} (${student.id}) on exam ${examId}`);
    setOpenMenuFor(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Proctoring</p>
        <h1 className="text-2xl font-bold text-foreground">Live Exam Grid</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {exam?.title || 'Exam'} • {examId || '-'}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading exam details...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dummyStudents.map((student) => (
            <Card key={student.id} className="p-4 border border-border">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{student.name}</p>
                  <p className="text-xs text-muted-foreground">{student.id}</p>
                </div>
                <div className="relative">
                  <Button variant="ghost" size="icon" onClick={() => setOpenMenuFor((prev) => (prev === student.id ? null : student.id))}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                  {openMenuFor === student.id && (
                    <div className="absolute right-0 mt-1 w-44 rounded-md border border-border bg-card shadow-lg z-20">
                      <button onClick={() => handleAction(student, 'Open live panel')} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary">Open live panel</button>
                      <button onClick={() => handleAction(student, 'Send warning')} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary">Send warning</button>
                      <button onClick={() => handleAction(student, 'Pause exam')} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary">Pause exam</button>
                      <button onClick={() => handleAction(student, 'Terminate attempt')} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary">Terminate attempt</button>
                      <button onClick={() => handleAction(student, 'Add remarks')} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary">Add remarks</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="aspect-video rounded-lg border border-border bg-secondary flex items-center justify-center mb-3">
                <div className="text-center text-muted-foreground">
                  <Camera className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-xs">Dummy Camera Feed</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="px-2 py-1 rounded bg-secondary text-foreground inline-flex items-center gap-1">
                  <User className="h-3 w-3" /> {student.name}
                </span>
                <span className="px-2 py-1 rounded bg-green-100 text-green-800 inline-flex items-center gap-1">
                  <Radio className="h-3 w-3" /> LIVE • {examId}
                </span>
              </div>
            </Card>
          ))}

          {dummyStudents.length === 0 && (
            <Card className="p-6 text-center md:col-span-2 xl:col-span-3">
              <p className="text-muted-foreground">No active student sessions for this exam.</p>
            </Card>
          )}
        </div>
      )}

      <Card className="p-4 bg-secondary/40">
        <p className="text-xs text-muted-foreground">
          This is a dummy monitoring grid for UI setup. Live camera streams and AI events will be connected once active testing sessions are available.
        </p>
      </Card>
    </div>
  );
}
