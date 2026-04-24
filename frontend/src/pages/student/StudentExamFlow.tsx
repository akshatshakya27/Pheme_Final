import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { TermsAndConditions } from '@/components/student-final/TermsAndConditions';
import { Verification } from '@/components/student-final/Verification';
import { ExamInterface } from '@/components/student-final/ExamInterface';
import { Result } from '@/components/student-final/Result';

type Stage = 'terms' | 'verify' | 'exam' | 'result';

interface Exam {
  id: string;
  title: string;
  duration: number;
  start_time?: string | null;
  end_time?: string | null;
}

interface AssignmentWithExam {
  exam: Exam;
}

export default function StudentExamFlow() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('terms');
  const [result, setResult] = useState<{ score: number; integrity: number; examId: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStarting, setSessionStarting] = useState(false);
  const [sessionInitError, setSessionInitError] = useState<string | null>(null);
  const [resultSaveError, setResultSaveError] = useState<string | null>(null);

  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', id],
    queryFn: async () => {
      const res = await api.get('/assignments/me');
      return (res.data as AssignmentWithExam[]).find((item) => item.exam?.id === id) || null;
    },
  });

  const exam = assignment?.exam || null;

  const examTitle = useMemo(() => exam?.title || 'Examination', [exam?.title]);
  const examDuration = useMemo(() => exam?.duration || 60, [exam?.duration]);
  const windowStatus = useMemo(() => {
    if (!exam) return 'unknown';
    const now = new Date();
    const start = exam.start_time ? new Date(exam.start_time) : null;
    const end = exam.end_time ? new Date(exam.end_time) : null;
    if (start && now < start) return 'before';
    if (end && now > end) return 'after';
    return 'open';
  }, [exam]);

  useEffect(() => {
    if (windowStatus !== 'after' || !id) return;
    api.post(`/sessions/exam/${id}/missed`).catch(() => {});
  }, [windowStatus, id]);

  const handleVerified = async () => {
    if (!id) return;
    setSessionStarting(true);
    setSessionInitError(null);
    try {
      const res = await api.post(`/sessions/exam/${id}/start`);
      if (res.data?.status !== 'in_progress') {
        throw new Error('Session is not active for proctoring.');
      }
      setSessionId(res.data.id);
      setStage('exam');
    } catch (error: any) {
      const detail = error?.response?.data?.detail || 'Unable to start exam session. Please retry.';
      setSessionInitError(detail);
    } finally {
      setSessionStarting(false);
    }
  };

  if (!id) return null;

  if (assignmentLoading || windowStatus === 'unknown') {
    return null;
  }

  if (windowStatus === 'before') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-2xl font-bold">Exam Not Started</h2>
          <p className="text-muted-foreground">You can attempt this exam only within the scheduled time window.</p>
          <button className="mt-4 px-5 py-2 rounded-md bg-primary text-primary-foreground" onClick={() => navigate('/student')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (windowStatus === 'after') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-2xl font-bold">Exam Missed</h2>
          <p className="text-muted-foreground">The exam window has closed. This attempt is marked as missed.</p>
          <button className="mt-4 px-5 py-2 rounded-md bg-primary text-primary-foreground" onClick={() => navigate('/student')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'terms') {
    return (
      <TermsAndConditions
        examTitle={examTitle}
        onAccept={() => setStage('verify')}
      />
    );
  }

  if (stage === 'verify') {
    return (
      <div>
        <Verification onVerified={handleVerified} />
        {(sessionStarting || sessionInitError) && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <div className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground shadow">
              {sessionStarting ? 'Starting exam session...' : sessionInitError}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (stage === 'result' && result) {
    return <Result score={result.score} integrity={result.integrity} saveError={resultSaveError} onBack={() => navigate('/student')} />;
  }

  return (
    <ExamInterface
      title={examTitle}
      examCode={id}
      sessionId={sessionId || ''}
      durationMinutes={examDuration}
      onSubmit={async (score, integrity) => {
        let saveError: string | null = null;
        try {
          if (!sessionId) {
            throw new Error('Exam session was not initialized.');
          }
          await api.post(`/sessions/${sessionId}/complete`, {
            score,
            integrity,
            status: 'submitted',
          });
        } catch (error: any) {
          saveError = error?.response?.data?.detail || error?.message || 'Failed to finalize exam session.';
        }
        setResultSaveError(saveError);
        setResult({ score, integrity, examId: id || '' });
        setStage('result');
      }}
    />
  );
}
