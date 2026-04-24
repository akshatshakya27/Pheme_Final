import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { Clock, Flag, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { createOrUpdateSession, listMyAssignments, listMySessions, listQuestionsForExam } from '@/lib/backendApi';
import { API_BASE_URL } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';
import { Question } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const ExamAttemptPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(2700); // 45 min
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [proctorWarning, setProctorWarning] = useState<string | null>(null);
  const [twoWayMode, setTwoWayMode] = useState(false);
  const cameraVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = React.useRef<MediaStream | null>(null);
  const proctorVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const proctorStreamRef = React.useRef<MediaStream | null>(null);
  const rtcPeerRef = React.useRef<RTCPeerConnection | null>(null);
  const signalSocketRef = React.useRef<WebSocket | null>(null);

  const buildSignalUrl = (examId: string, studentId: string) => {
    const apiBase = API_BASE_URL;
    if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
      const wsBase = apiBase.replace(/^http/, 'ws');
      return `${wsBase}/proctoring/ws/${examId}/${studentId}?role=student`;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const normalizedBase = apiBase.startsWith('/') ? apiBase : `/${apiBase}`;
    return `${wsProtocol}://${window.location.host}${normalizedBase}/proctoring/ws/${examId}/${studentId}?role=student`;
  };

  const sendSignal = (payload: Record<string, unknown>) => {
    const socket = signalSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  };

  const sendProgressUpdate = () => {
    if (!selectedExam?.id || !user?.id) return;

    const questionsAnswered = Object.keys(answers).length;
    sendSignal({
      type: 'exam.progress',
      questionsAnswered,
      questionsTotal: questions.length,
      timeRemaining: timeLeft,
      currentQuestion: currentQ + 1,
      examId: selectedExam.id,
      studentId: user.id,
    });
  };

  const createAndSendOffer = async () => {
    const peer = rtcPeerRef.current;
    if (!peer || !signalSocketRef.current || signalSocketRef.current.readyState !== WebSocket.OPEN) return;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    sendSignal({ type: 'signal-offer', sdp: offer });
  };

  const attachStreamToPreview = async () => {
    const preview = cameraVideoRef.current;
    const stream = cameraStreamRef.current;
    if (!preview || !stream) return;

    if (preview.srcObject !== stream) {
      preview.srcObject = stream;
    }

    try {
      await preview.play();
      setCameraReady(stream.getVideoTracks().some((track) => track.readyState === 'live'));
      setCameraError(null);
    } catch {
      setCameraError('Camera stream available but preview playback was blocked by browser.');
    }
  };

  const startCamera = async () => {
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 360 },
        },
        audio: false,
      });
      cameraStreamRef.current = stream;
      const peer = rtcPeerRef.current;
      if (peer) {
        const senders = peer.getSenders();
        stream.getTracks().forEach((track) => {
          const exists = senders.some((sender) => sender.track?.id === track.id);
          if (!exists) {
            peer.addTrack(track, stream);
          }
        });
        await createAndSendOffer();
      }
      await attachStreamToPreview();
    } catch {
      setCameraReady(false);
      setCameraError('Camera access denied or unavailable.');
    }
  };

  const { data: assignments = [] } = useQuery({
    queryKey: ['exam-attempt', 'assignments'],
    queryFn: listMyAssignments,
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ['exam-attempt', 'sessions'],
    queryFn: listMySessions,
  });

  const activeExamIds = new Set([
    ...assignments.filter((exam) => exam.status === 'live').map((exam) => exam.id),
    ...sessions.filter((session) => session.status === 'in_progress').map((session) => session.exam_id),
  ]);
  const storedExamId = sessionStorage.getItem('student_active_exam_id');
  const selectedExam =
    assignments.find((exam) => exam.id === storedExamId)
    || assignments.find((exam) => activeExamIds.has(exam.id))
    || assignments[0]
    || null;

  const {
    data: questions = [],
    error: questionsError,
  } = useQuery<Question[]>({
    queryKey: ['exam-attempt', 'questions', selectedExam?.id],
    queryFn: () => listQuestionsForExam(selectedExam!.id),
    enabled: !!selectedExam?.id,
  });

  useEffect(() => {
    if (questionsError) {
      toast({ title: 'Failed to load exam questions', description: (questionsError as Error).message, variant: 'destructive' });
    }
  }, [questionsError, toast]);

  useEffect(() => {
    setCurrentQ(0);
    setAnswers({});
    setFlagged(new Set());
    const durationMinutes = Math.max(1, selectedExam?.duration || 45);
    setTimeLeft(durationMinutes * 60);
  }, [selectedExam?.id]);

  useEffect(() => {
    const passedSession = sessionStorage.getItem('student_system_check_passed') === '1';
    const passedLocal = localStorage.getItem('student_system_check_passed') === '1';
    if (!passedSession && !passedLocal) {
      toast({ title: 'System check required', description: 'Complete system checks before starting exam.', variant: 'destructive' });
      navigate('/student/system-check');
    }
  }, [navigate, toast]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { handleSubmit(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) setShowTabWarning(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    void startCamera();

    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // If stream started before video mounted (loading state), attach once preview exists.
    void attachStreamToPreview();
  }, [questions.length, currentQ]);

  useEffect(() => {
    if (!selectedExam?.id || !user?.id) return;

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    rtcPeerRef.current = peer;

    const stream = cameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });
    }

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: 'signal-candidate', candidate: event.candidate });
      }
    };

    peer.ontrack = async (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;
      proctorStreamRef.current = remoteStream;
      setTwoWayMode(true);
      if (proctorVideoRef.current) {
        proctorVideoRef.current.srcObject = remoteStream;
        try {
          await proctorVideoRef.current.play();
        } catch {
          // no-op
        }
      }
    };

    const signalSocket = new WebSocket(buildSignalUrl(selectedExam.id, user.id));
    signalSocketRef.current = signalSocket;

    signalSocket.onopen = () => {
      sendSignal({ type: 'student-ready' });
      sendProgressUpdate();
    };

    signalSocket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'peer-joined' && message.role === 'proctor') {
          await createAndSendOffer();
          return;
        }
        if (message.type === 'proctor-ready' || message.type === 'request-offer') {
          await createAndSendOffer();
          return;
        }
        if (message.type === 'signal-answer' && message.sdp) {
          await peer.setRemoteDescription(new RTCSessionDescription(message.sdp));
          return;
        }
        if (message.type === 'signal-offer' && message.sdp) {
          await peer.setRemoteDescription(new RTCSessionDescription(message.sdp));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal({ type: 'signal-answer', sdp: answer });
          return;
        }
        if (message.type === 'signal-candidate' && message.candidate) {
          await peer.addIceCandidate(new RTCIceCandidate(message.candidate));
          return;
        }
        if (message.type === 'warning' && typeof message.text === 'string' && message.text.trim()) {
          const warningText = message.text.trim();
          setProctorWarning(warningText);
          sendSignal({ type: 'warning-ack', text: `Warning received: ${warningText}` });
          return;
        }
        if (message.type === 'mode' && message.mode === 'one-way') {
          setTwoWayMode(false);
          return;
        }
        if (message.type === 'mode' && message.mode === 'two-way') {
          setTwoWayMode(true);
        }
      } catch {
        // no-op
      }
    };

    return () => {
      signalSocketRef.current?.close();
      signalSocketRef.current = null;
      rtcPeerRef.current?.close();
      rtcPeerRef.current = null;
      proctorStreamRef.current = null;
    };
  }, [selectedExam?.id, user?.id]);

  useEffect(() => {
    sendProgressUpdate();
  }, [answers, currentQ, questions.length, timeLeft]);

  useEffect(() => {
    let reentryInterval: number | undefined;

    const requestFullscreen = async () => {
      const element = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      try {
        if (document.fullscreenElement) {
          setFullscreenActive(true);
          return;
        }
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        }
        setFullscreenActive(true);
      } catch {
        setFullscreenActive(false);
      }
    };

    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setFullscreenActive(active);
      if (!active) {
        setShowFullscreenWarning(true);
      }
    };

    void requestFullscreen();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    reentryInterval = window.setInterval(() => {
      if (!document.fullscreenElement) {
        void requestFullscreen();
      }
    }, 1200);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (reentryInterval) {
        clearInterval(reentryInterval);
      }
    };
  }, []);

  const handleSubmit = () => {
    const totalMarks = questions.reduce((sum, item) => sum + (item.marks || 1), 0);
    const score = questions.reduce((sum, item) => {
      const answer = answers[item.id];
      const isCorrect = !!answer && String(answer).trim() === String(item.correctAnswer || '').trim();
      return sum + (isCorrect ? (item.marks || 1) : 0);
    }, 0);

    if (user?.id && selectedExam?.id) {
      sendSignal({ type: 'session.state-changed', newStatus: 'submitted' });
      void createOrUpdateSession({
        studentId: user.id,
        examId: selectedExam.id,
        status: 'submitted',
        score: totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0,
        integrity: 100,
      }).catch(() => {
        // Best-effort submission tracking; navigation continues.
      });
    }

    sessionStorage.removeItem('student_system_check_passed');
    localStorage.removeItem('student_system_check_passed');
    navigate('/student/exam-submitted');
  };

  useEffect(() => {
    if (!user?.id || !selectedExam?.id) return;
    void createOrUpdateSession({
      studentId: user.id,
      examId: selectedExam.id,
      status: 'in_progress',
      integrity: 100,
    }).catch(() => {
      // Best-effort session start tracking.
    });
    sendSignal({ type: 'session.state-changed', newStatus: 'active' });
  }, [user?.id, selectedExam?.id]);

  const q = questions[currentQ];
  const qOptions = Array.isArray(q?.options) ? q.options : [];
  const progress = questions.length ? (Object.keys(answers).length / questions.length) * 100 : 0;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  if (!selectedExam) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">No Exam Available</h2>
          <p className="text-sm text-muted-foreground mb-4">No assigned exam is available to attempt right now.</p>
          <Button onClick={() => navigate('/student/exams')}>Back to Exams</Button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">No Questions Available</h2>
          <p className="text-sm text-muted-foreground mb-4">This exam does not have any questions yet or failed to load.</p>
          <Button onClick={() => navigate('/student/exams')}>Back to Exams</Button>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Question Load Error</h2>
          <p className="text-sm text-muted-foreground mb-4">Unable to render current question. Try reopening the exam.</p>
          <Button onClick={() => navigate('/student/exams')}>Back to Exams</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-topbar text-topbar-foreground px-6 py-3 flex items-center justify-between">
        <span className="font-semibold">{selectedExam.title}</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="h-4 w-4" />
            <span className={`font-mono font-semibold ${timeLeft < 300 ? 'text-destructive' : ''}`}>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
          <Progress value={progress} className="w-32 h-2" />
          <span className="text-xs text-topbar-muted">{Object.keys(answers).length}/{questions.length}</span>
          <span className={`text-xs ${fullscreenActive ? 'text-success' : 'text-warning'}`}>{fullscreenActive ? 'Fullscreen On' : 'Fullscreen Off'}</span>
          <span className={`text-xs ${cameraReady ? 'text-success' : 'text-destructive'}`}>{cameraReady ? 'Camera Live' : 'Camera Off'}</span>
        </div>
      </div>

      {proctorWarning && (
        <div className="bg-warning/15 border-y border-warning/30 px-6 py-2 text-sm text-warning-foreground flex items-center justify-between">
          <span>Proctor Warning: {proctorWarning}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              sendSignal({ type: 'warning-ack', text: 'Warning acknowledged by student.' });
              setProctorWarning(null);
            }}
          >
            Dismiss
          </Button>
        </div>
      )}

      <div className="flex flex-1">
        {/* Question nav */}
        <div className="w-20 bg-card border-r p-3 flex flex-col gap-2 overflow-y-auto">
          {questions.map((mq, i) => (
            <button
              key={mq.id}
              onClick={() => setCurrentQ(i)}
              className={`h-10 w-full rounded-md text-xs font-semibold transition-colors ${
                i === currentQ ? 'bg-accent text-accent-foreground' :
                answers[mq.id] ? 'bg-success/20 text-success' :
                flagged.has(mq.id) ? 'bg-warning/20 text-warning' :
                'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Question area */}
        <div className="flex-1 p-8 pr-80">
          <div className="max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-muted-foreground">Question {currentQ + 1} of {questions.length}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{q.marks} marks</span>
              <Button
                variant="outline" size="sm"
                onClick={() => setFlagged(prev => { const n = new Set(prev); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; })}
                className={flagged.has(q.id) ? 'border-warning text-warning' : ''}
              >
                <Flag className="h-4 w-4 mr-1" />{flagged.has(q.id) ? 'Flagged' : 'Flag'}
              </Button>
            </div>
          </div>

          <h2 className="text-lg font-semibold mb-6">{q.text}</h2>

          {q.type === 'mcq' ? (
            <RadioGroup value={answers[q.id] || ''} onValueChange={(val) => setAnswers({ ...answers, [q.id]: val })}>
              <div className="space-y-3">
                {qOptions.map((opt, i) => (
                  <label key={i} className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    answers[q.id] === opt ? 'border-accent bg-accent/5' : 'border-border hover:bg-muted/50'
                  }`}>
                    <RadioGroupItem value={opt} />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
                {qOptions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No options available for this MCQ question.</p>
                )}
              </div>
            </RadioGroup>
          ) : (
            <Textarea
              placeholder="Type your answer..."
              className="min-h-[160px]"
              value={answers[q.id] || ''}
              onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
            />
          )}

          <div className="flex justify-between mt-8">
            <Button variant="outline" disabled={currentQ === 0} onClick={() => setCurrentQ(c => c - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" />Previous
            </Button>
            {currentQ < questions.length - 1 ? (
              <Button onClick={() => setCurrentQ(c => c + 1)} className="bg-accent text-accent-foreground">
                Next<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={() => setShowSubmitConfirm(true)} className="bg-success text-success-foreground">
                <Send className="h-4 w-4 mr-1" />Submit Exam
              </Button>
            )}
          </div>
          </div>
        </div>
      </div>

      <aside className="fixed right-0 top-[56px] h-[calc(100vh-56px)] w-72 bg-card border-l p-4 z-40">
        <p className="text-sm font-semibold mb-2">Live Proctor Feed</p>
        <video
          ref={cameraVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-44 rounded-md bg-muted object-cover border"
        />
        <p className="text-xs text-muted-foreground mt-2">
          {cameraError || 'Keep your face visible in frame throughout the exam.'}
        </p>
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => void startCamera()}>
          Retry Camera Feed
        </Button>

        <div className="mt-4">
          <p className="text-sm font-semibold mb-2">Proctor Camera {twoWayMode ? '(Two-way)' : '(One-way)'}</p>
          {twoWayMode ? (
            <video
              ref={proctorVideoRef}
              autoPlay
              playsInline
              className="w-full h-36 rounded-md bg-muted object-cover border"
            />
          ) : (
            <div className="w-full h-24 rounded-md border border-dashed bg-muted/40 text-xs text-muted-foreground flex items-center justify-center">
              Two-way proctoring is not enabled.
            </div>
          )}
        </div>
      </aside>

      <AlertDialog open={showTabWarning} onOpenChange={setShowTabWarning}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>⚠️ Tab Switch Detected</AlertDialogTitle>
            <AlertDialogDescription>Switching tabs during the exam is flagged as a violation. This has been recorded.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogAction>I Understand</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {Object.keys(answers).length} of {questions.length} questions.
              {Object.keys(answers).length < questions.length && ' Some questions are unanswered.'}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Exam</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showFullscreenWarning} onOpenChange={setShowFullscreenWarning}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Fullscreen Required</AlertDialogTitle>
            <AlertDialogDescription>Leaving fullscreen is treated as a violation. Fullscreen will be re-enabled automatically.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogAction>Continue Exam</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExamAttemptPage;
