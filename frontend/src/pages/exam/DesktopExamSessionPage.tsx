import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Eye, AlertTriangle, Clock, Shield, Volume2, MessageSquare, Send, X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import api from '@/lib/api';

interface Question {
  id: string;
  text: string;
  options: string[];
  type: string;
}

interface ExamSessionData {
  session_id: string;
  exam_id: string;
  title: string;
  duration_minutes: number;
  questions: Question[];
}

interface ProctorAudioData {
  volume: number;
  baseline: number;
  noise_alert: boolean;
  speech_alert: boolean;
  speech_conf: number;
}

interface ViolationCounts {
  no_face?: number;
  multiple_faces?: number;
  phone_detected?: number;
  document_detected?: number;
  audio_violation?: number;
  tab_switch?: number;
  [key: string]: number | undefined;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
}

function buildSignalingWsUrl(sessionId: string, token: string, role: 'student' | 'proctor'): string {
  const envApiUrl = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
  const apiBase = envApiUrl || api.defaults.baseURL || '/api';
  const isAbsolute = /^https?:\/\//i.test(apiBase);
  const normalizedApiBase = isAbsolute
    ? apiBase
    : (window.location.protocol === 'file:' || !window.location.host)
      ? `http://127.0.0.1:8000${apiBase.startsWith('/') ? '' : '/'}${apiBase}`
      : `${window.location.origin}${apiBase.startsWith('/') ? '' : '/'}${apiBase}`;
  const base = new URL(normalizedApiBase);
  const wsProtocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsPath = `${base.pathname.replace(/\/$/, '')}/proctoring/ws/${encodeURIComponent(sessionId)}`;
  return `${wsProtocol}//${base.host}${wsPath}?token=${encodeURIComponent(token)}&role=${role}`;
}

export default function DesktopExamSessionPage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>();
  const [exam, setExam] = useState<ExamSessionData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [currentFrameViolationCount, setCurrentFrameViolationCount] = useState(0);
  const [violationCounts, setViolationCounts] = useState<ViolationCounts>({});
  const [totalViolations, setTotalViolations] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [faceDetected, setFaceDetected] = useState(true);
  const [audioState, setAudioState] = useState<ProctorAudioData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isTwoWayLive, setIsTwoWayLive] = useState(false);
  const [proctorAudioBlocked, setProctorAudioBlocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const proctorVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const proctoringTimerRef = useRef<number | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const remoteProctorStreamRef = useRef<MediaStream | null>(null);
  const signalingWsRef = useRef<WebSocket | null>(null);
  const webrtcPcRef = useRef<RTCPeerConnection | null>(null);
  const proctorReadyRef = useRef(false);
  const startOfferRef = useRef<(() => Promise<void>) | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  const token = localStorage.getItem('token');

  const loadMessages = useCallback(async () => {
    if (!sessionId || !token) return;

    try {
      const result = await (window as any).electronAPI.apiCall('GET', `/api/proctoring/messages/${sessionId}`, {
        token,
      });

      if (result?.success && Array.isArray(result.data?.messages)) {
        const nextMessages = result.data.messages as ChatMessage[];
        const unseenIncoming = nextMessages.filter((message) => {
          if (seenMessageIdsRef.current.has(message.id)) return false;
          return message.sender !== 'student';
        });

        nextMessages.forEach((message) => {
          seenMessageIdsRef.current.add(message.id);
        });

        setMessages(nextMessages);
        if (!chatOpen && unseenIncoming.length > 0) {
          setUnreadMessages((prev) => prev + unseenIncoming.length);
        }
      }
    } catch {
    }
  }, [sessionId, token, chatOpen]);

  useEffect(() => {
    if (!chatOpen) return;

    setUnreadMessages(0);
    messages.forEach((message) => {
      seenMessageIdsRef.current.add(message.id);
    });
  }, [chatOpen, messages]);

  useEffect(() => {
    if (!chatOpen) return;

    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatOpen, messages]);

  useEffect(() => {
    if (!sessionId || !token) return undefined;

    const wsUrl = buildSignalingWsUrl(sessionId, token, 'student');
    const ws = new WebSocket(wsUrl);
    signalingWsRef.current = ws;

    const ensurePeerConnection = () => {
      if (webrtcPcRef.current) return webrtcPcRef.current;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      pc.onicecandidate = (event) => {
        if (!event.candidate || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'ice-candidate', payload: event.candidate.toJSON() }));
      };

      pc.ontrack = async (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) return;

        remoteProctorStreamRef.current = remoteStream;
        setIsTwoWayLive(true);

        if (!proctorVideoRef.current) return;
        proctorVideoRef.current.srcObject = remoteStream;
        try {
          await proctorVideoRef.current.play();
          setProctorAudioBlocked(false);
        } catch {
          setProctorAudioBlocked(true);
        }
      };

      webrtcPcRef.current = pc;
      return pc;
    };

    const startOffer = async () => {
      if (!proctorReadyRef.current) return;
      const stream = cameraStreamRef.current;
      if (!stream) return;

      const pc = ensurePeerConnection();
      const senders = pc.getSenders();
      for (const track of stream.getTracks()) {
        if (track.kind !== 'video' && track.kind !== 'audio') continue;
        const exists = senders.some((sender) => sender.track?.id === track.id);
        if (!exists) {
          pc.addTrack(track, stream);
        }
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (ws.readyState === WebSocket.OPEN && pc.localDescription) {
        ws.send(JSON.stringify({ type: 'offer', payload: pc.localDescription }));
      }
    };

    startOfferRef.current = startOffer;
    let heartbeatTimer: number | null = null;

    const startHeartbeat = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000) as unknown as number;
    };

    ws.onopen = () => {
      console.log('[Desktop 2-Way] WebSocket connected');
      startHeartbeat();
      ws.send(JSON.stringify({ type: 'webrtc-ready' }));
    };

    ws.onerror = (event) => {
      console.error('[Desktop 2-Way] WebSocket error:', event);
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'pong') {
          console.log('[Desktop 2-Way] Heartbeat pong');
          return;
        }

        if (message.type === 'webrtc-ready' && message.from_role === 'proctor') {
          proctorReadyRef.current = true;
          await startOffer();
          return;
        }

        if (message.type === 'answer') {
          const pc = ensurePeerConnection();
          const answer = message.payload;
          if (answer) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          }
          return;
        }

        if (message.type === 'ice-candidate') {
          const pc = ensurePeerConnection();
          const candidate = message.payload;
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      } catch {
      }
    };

    ws.onclose = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      console.log('[Desktop 2-Way] WebSocket closed, reconnecting in 2s...');
      setTimeout(() => {
        if (!unmountedRef.current) {
          setIsTwoWayLive(false);
          void setupTwoWayConnection();
        }
      }, 2000);
    };

    return () => {
      startOfferRef.current = null;
      proctorReadyRef.current = false;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      try {
        ws.close(1000, 'Component unmounted');
      } catch {
      }
      signalingWsRef.current = null;
      if (webrtcPcRef.current) {
        webrtcPcRef.current.close();
        webrtcPcRef.current = null;
      }
      remoteProctorStreamRef.current = null;
      setIsTwoWayLive(false);
      setProctorAudioBlocked(false);
    };
  }, [sessionId, token]);

  useEffect(() => {
    if (!isTwoWayLive || !proctorVideoRef.current || !remoteProctorStreamRef.current) return;

    if (proctorVideoRef.current.srcObject !== remoteProctorStreamRef.current) {
      proctorVideoRef.current.srcObject = remoteProctorStreamRef.current;
    }

    void proctorVideoRef.current.play().then(() => {
      setProctorAudioBlocked(false);
    }).catch(() => {
      setProctorAudioBlocked(true);
    });
  }, [isTwoWayLive]);

  // Load exam data from the started desktop session.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('desktop-active-session');
      if (!raw) {
        setLoadError('Exam session data missing. Please restart from assigned exams.');
        return;
      }

      const parsed = JSON.parse(raw) as ExamSessionData;
      if (parsed.session_id !== sessionId) {
        setLoadError('Session mismatch detected. Please restart from assigned exams.');
        return;
      }

      setExam(parsed);
      setTimeRemaining(Math.max(0, (parsed.duration_minutes || 0) * 60));
      setLoadError(null);
    } catch {
      setLoadError('Invalid session data. Please restart from assigned exams.');
    }
  }, [sessionId]);

  // Timer
  useEffect(() => {
    if (!exam) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [exam]);

  // Force fullscreen during exam session.
  useEffect(() => {
    const electronApi = (window as any).electronAPI;
    electronApi?.setExamFullscreen?.(true).catch(() => {});

    const requestBrowserFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
      }
    };

    const enforceFullscreen = () => {
      if (!document.fullscreenElement) {
        requestBrowserFullscreen();
      }
    };

    requestBrowserFullscreen();
    document.addEventListener('fullscreenchange', enforceFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', enforceFullscreen);
      electronApi?.setExamFullscreen?.(false).catch(() => {});
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Proctoring - Start camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        cameraStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        if (proctorReadyRef.current && startOfferRef.current) {
          void startOfferRef.current();
        }

        // Start face detection loop after camera stream is attached
        detectFace();
      } catch (err) {
        console.error('Camera access denied:', err);
      }
    };

    startCamera();

    return () => {
      if (proctoringTimerRef.current) {
        window.clearTimeout(proctoringTimerRef.current);
        proctoringTimerRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      }
      cameraStreamRef.current = null;
    };
  }, []);

  // Face detection
  const detectFace = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const detect = () => {
      ctx.drawImage(videoRef.current!, 0, 0, canvas.width, canvas.height);

      // Send frame to Python AI service for face detection
      const imageData = canvas.toDataURL('image/jpeg');

      (window as any).electronAPI
        .apiCall('POST', '/api/proctoring/analyze-frame', {
          frame: imageData,
          session_id: sessionId,
          token,
        })
        .then((result: any) => {
          if (result.success) {
            const data = result.data;
            const backendViolations: string[] = Array.isArray(data?.violations) ? data.violations : [];
            const audio: ProctorAudioData | null = data?.audio ?? null;
            const counts: ViolationCounts | null = data?.violation_counts && typeof data.violation_counts === 'object'
              ? (data.violation_counts as ViolationCounts)
              : null;
            const serverTotal = Number(data?.total_violations ?? data?.violation_count);

            setAudioState(audio);
            setCurrentFrameViolationCount(backendViolations.length);

            if (counts) {
              setViolationCounts(counts);
            } else if (backendViolations.length > 0) {
              // Fallback for backend responses that only send violations array.
              const normalizeViolationKey = (code: string): string => {
                if (code === 'face_not_detected') return 'no_face';
                if (code === 'speech_detected' || code === 'audio_anomaly') return 'audio_violation';
                return code;
              };

              setViolationCounts((prev) => {
                const next: ViolationCounts = { ...prev };
                backendViolations.forEach((code) => {
                  const key = normalizeViolationKey(code);
                  next[key] = (next[key] || 0) + 1;
                });
                return next;
              });
            }

            setTotalViolations((prev) => {
              if (Number.isFinite(serverTotal) && serverTotal >= 0) {
                // Keep the largest observed server value to avoid UI resets.
                return Math.max(prev, serverTotal);
              }
              // Fallback: increment locally by current frame violations.
              return prev + backendViolations.length;
            });

            // Check violations
            if (data.face_count === 0) {
              setFaceDetected(false);
            } else {
              setFaceDetected(true);
            }
          } else {
            setCurrentFrameViolationCount(0);
          }

          proctoringTimerRef.current = window.setTimeout(detect, 1000);
        })
        .catch((err: any) => {
          console.error('Face detection error:', err);
          proctoringTimerRef.current = window.setTimeout(detect, 1200);
        });
    };

    detect();
  }, [sessionId, token]);

  // Log violations
  const logViolation = async (eventType: string, eventData: any) => {
    try {
      await (window as any).electronAPI.logProctorEvent(
        sessionId,
        eventType,
        eventData,
        token
      );
    } catch (err) {
      console.error('Failed to log violation:', err);
    }
  };

  // Monitor tab switches
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolationCounts((prev) => ({
          ...prev,
          tab_switch: (prev.tab_switch || 0) + 1,
        }));
        setTotalViolations((prev) => prev + 1);
        setCurrentFrameViolationCount(1);
        logViolation('tab_switch', {
          timestamp: new Date().toISOString(),
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sessionId, token]);

  // Proctor chat polling
  useEffect(() => {
    if (!sessionId || !token) return undefined;

    void loadMessages();
    const interval = window.setInterval(() => {
      void loadMessages();
    }, 2500);

    return () => {
      window.clearInterval(interval);
    };
  }, [sessionId, token, loadMessages]);

  const handleSendMessage = async () => {
    const trimmed = messageText.trim();
    if (!trimmed || !token) return;

    setSendingMessage(true);
    setChatError(null);

    try {
      const result = await (window as any).electronAPI.apiCall('POST', '/api/proctoring/messages', {
        session_id: sessionId,
        message: trimmed,
        token,
      });

      if (!result?.success) {
        setChatError(result?.error || 'Failed to send message.');
        return;
      }

      setMessageText('');
      await loadMessages();
    } catch {
      setChatError('Failed to send message.');
    } finally {
      setSendingMessage(false);
    }
  };

  // Submit exam
  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      const answersArray = exam?.questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] || '',
        time_spent_seconds: 0,
      })) || [];

      const result = await (window as any).electronAPI.submitExam(
        sessionId,
        answersArray,
        token
      );

      if (result.success) {
        const attemptedQuestions = exam?.questions.filter((q) => Boolean(answers[q.id])).length || 0;

        localStorage.setItem(
          'desktop-last-result',
          JSON.stringify({
            exam_title: exam?.title || 'Exam',
            score: result.data?.score ?? 0,
            correct_answers: result.data?.correct_answers ?? 0,
            total_questions: result.data?.total_questions ?? (exam?.questions.length || 0),
            attempted_questions: attemptedQuestions,
            total_violations: totalViolations,
          })
        );
        localStorage.removeItem('desktop-active-session');
        window.location.hash = '#/desktop/exam-result';
      }
    } catch (err) {
      console.error('Submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <p className="font-semibold text-gray-900">Unable to load exam session</p>
          <p className="text-sm text-gray-600 mt-2">{loadError}</p>
          <Button className="mt-6" onClick={() => (window.location.hash = '#/desktop/exam')}>
            Back to Assigned Exams
          </Button>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading exam...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / exam.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Exam Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header */}
            <Card className="bg-white border-l-4 border-l-blue-600">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold">{exam.title}</h1>
                  <div className="flex items-center gap-2 text-lg font-semibold text-blue-600">
                    <Clock className="h-5 w-5" />
                    {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Violation Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
              <Card className={violationCounts.no_face ? 'border-red-300 bg-red-50' : ''}>
                <CardContent className="pt-4">
                  <p className="text-xs text-gray-600">No Face</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{violationCounts.no_face || 0}</p>
                </CardContent>
              </Card>
              <Card className={violationCounts.multiple_faces ? 'border-orange-300 bg-orange-50' : ''}>
                <CardContent className="pt-4">
                  <p className="text-xs text-gray-600">Multiple Faces</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{violationCounts.multiple_faces || 0}</p>
                </CardContent>
              </Card>
              <Card className={violationCounts.audio_violation ? 'border-yellow-300 bg-yellow-50' : ''}>
                <CardContent className="pt-4">
                  <p className="text-xs text-gray-600 flex items-center gap-1"><Volume2 className="h-3 w-3" /> Audio</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">{violationCounts.audio_violation || 0}</p>
                </CardContent>
              </Card>
              <Card className={totalViolations > 0 ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}>
                <CardContent className="pt-4">
                  <p className="text-xs text-gray-600 flex items-center gap-1"><Shield className="h-3 w-3" /> Total</p>
                  <p className={`text-2xl font-bold mt-1 ${totalViolations > 0 ? 'text-red-600' : 'text-green-600'}`}>{totalViolations}</p>
                </CardContent>
              </Card>
            </div>

            {/* Violations Alert */}
            {currentFrameViolationCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-600 mb-2">
                    Violations Detected
                  </p>
                  <p className="text-sm text-red-700">
                    Current frame count: <span className="font-semibold">{currentFrameViolationCount}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Face Detection Status */}
            {!faceDetected && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                <Eye className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-800">
                    Face Not Detected
                  </p>
                  <p className="text-sm text-yellow-700">
                    Please ensure your face is visible for the camera
                  </p>
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  Question {currentQuestionIndex + 1} of {exam.questions.length}
                </span>
                <span className="text-gray-600">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Question */}
            <Card>
              <CardContent className="pt-6 space-y-6">
                <h2 className="text-xl font-semibold">{currentQuestion.text}</h2>

                <div className="space-y-3">
                  {currentQuestion.options.map((option, idx) => (
                    <label
                      key={idx}
                      className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-blue-50 transition"
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={option}
                        checked={answers[currentQuestion.id] === option}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [currentQuestion.id]: e.target.value,
                          }))
                        }
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="ml-3">{option}</span>
                    </label>
                  ))}
                </div>

                {/* Navigation */}
                <div className="flex justify-between gap-4 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))
                    }
                    disabled={currentQuestionIndex === 0}
                  >
                    Previous
                  </Button>

                  {currentQuestionIndex === exam.questions.length - 1 ? (
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? 'Submitting...' : 'Submit Exam'}
                    </Button>
                  ) : (
                    <Button
                      className="bg-blue-600"
                      onClick={() =>
                        setCurrentQuestionIndex(
                          Math.min(
                            exam.questions.length - 1,
                            currentQuestionIndex + 1
                          )
                        )
                      }
                    >
                      Next
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Camera & Info */}
          <div className="space-y-6">
            {/* Camera Feed */}
            <Card className="bg-black">
              <CardContent className="pt-6">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-square">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                    width={320}
                    height={240}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">Proctoring Camera</p>
              </CardContent>
            </Card>

            {/* Proctor Camera (Two-way) */}
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-semibold mb-3">Proctor Camera</p>
                {isTwoWayLive ? (
                  <div className="space-y-2">
                    <video
                      ref={proctorVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-40 rounded-md bg-gray-950 object-cover border"
                      onClick={() => {
                        if (!proctorVideoRef.current) return;
                        void proctorVideoRef.current.play().then(() => {
                          setProctorAudioBlocked(false);
                        }).catch(() => {
                          setProctorAudioBlocked(true);
                        });
                      }}
                    />
                    {proctorAudioBlocked && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          if (!proctorVideoRef.current) return;
                          void proctorVideoRef.current.play().then(() => {
                            setProctorAudioBlocked(false);
                          }).catch(() => {
                            setProctorAudioBlocked(true);
                          });
                        }}
                      >
                        Enable Proctor Audio
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-24 rounded-md border border-dashed bg-gray-50 text-xs text-gray-500 flex items-center justify-center">
                    Proctor feed is currently unavailable.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Question Summary */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3 text-sm">Question Navigator</h3>
                <div className="grid grid-cols-4 gap-2">
                  {exam.questions.map((q, idx) => (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`w-full aspect-square rounded text-xs font-medium transition ${
                        idx === currentQuestionIndex
                          ? 'bg-blue-600 text-white'
                          : answers[q.id]
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Proctoring Status */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3 text-sm">Proctoring Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          faceDetected ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span>{faceDetected ? 'Face Detected' : 'No Face'}</span>
                    </div>
                    <span className={`text-sm font-bold ${!faceDetected ? 'text-red-600' : 'text-gray-500'}`}>
                      {violationCounts.no_face || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Camera Active</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span>Speech Detected</span>
                    </div>
                    <span className="text-sm font-bold text-gray-500">
                      {violationCounts.audio_violation || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${audioState?.noise_alert ? 'bg-red-500' : 'bg-green-500'}`}
                    />
                    <span>{audioState?.noise_alert ? 'Audio Anomaly' : 'Audio Normal'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      {chatOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
          aria-label="Close chat overlay"
          onClick={() => setChatOpen(false)}
        />
      )}

      <div className="fixed bottom-6 right-6 z-50">
        <Button
          type="button"
          onClick={() => setChatOpen((current) => !current)}
          className="relative h-14 w-14 rounded-full bg-blue-600 shadow-lg hover:bg-blue-700"
          aria-label={chatOpen ? 'Close chat' : 'Open chat'}
        >
          <MessageSquare className="h-6 w-6" />
          {unreadMessages > 0 && !chatOpen && (
            <Badge className="absolute -top-2 -right-2 flex min-w-6 h-6 items-center justify-center rounded-full bg-red-600 px-2 text-xs text-white">
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </Badge>
          )}
        </Button>
      </div>

      <div
        className={`fixed inset-y-0 right-0 z-40 w-full max-w-sm transform border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ${
          chatOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4" />
                Chat with Proctor
              </p>
              <p className="text-xs text-gray-500">Messages from the proctor appear here.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setChatOpen(false)} aria-label="Close chat">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
            <div className="space-y-2">
              {messages.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-500">
                  No messages yet.
                </p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-xl border p-3 ${
                      message.sender === 'student'
                        ? 'ml-8 border-blue-200 bg-blue-50'
                        : 'mr-8 border-gray-200 bg-white'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
                      <span className="font-semibold capitalize text-gray-700">{message.sender}</span>
                      <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm text-gray-800">{message.message}</p>
                  </div>
                ))
              )}
              <div ref={chatScrollRef} />
            </div>
          </div>

          <div className="border-t border-gray-200 bg-white p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={() => void handleSendMessage()}
                disabled={!messageText.trim() || sendingMessage}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {chatError && <p className="mt-2 text-xs text-red-600">{chatError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
