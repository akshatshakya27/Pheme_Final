import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Camera, Clock, FileText } from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  total_questions: number;
  status: string;
}

export default function DesktopTermsPage() {
  const navigate = useNavigate();
  const { examId = '' } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [faceVerified, setFaceVerified] = useState(false);
  const [verifyingFace, setVerifyingFace] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [faceCheckError, setFaceCheckError] = useState('');
  const [cameraStarted, setCameraStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const loadExam = async () => {
      try {
        const token = localStorage.getItem('token');
        const result = await (window as any).electronAPI.getExams(token);
        if (!result.success) {
          setError(result.error || 'Unable to load assigned exams');
          return;
        }

        const exams: Exam[] = Array.isArray(result.data) ? result.data : (result.data?.exams || []);
        const selected = exams.find((item) => item.id === examId) || null;
        if (!selected) {
          setError('Assigned exam not found. Please go back and choose again.');
          return;
        }

        setExam(selected);
      } catch (err: any) {
        setError(err.message || 'Unable to load exam details');
      } finally {
        setLoading(false);
      }
    };

    loadExam();
  }, [examId]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!cameraStarted || !videoRef.current || !streamRef.current) {
      return;
    }

    const video = videoRef.current;
    video.srcObject = streamRef.current;
    const startPlayback = async () => {
      try {
        await video.play();
      } catch {
        // Playback can be blocked until the user interacts with the page.
      }
    };

    startPlayback();
  }, [cameraStarted]);

  useEffect(() => {
    if (!loading && !error && !cameraStarted) {
      startFaceCheckCamera();
    }
  }, [loading, error, cameraStarted]);

  const startFaceCheckCamera = async () => {
    if (cameraStarted) {
      return;
    }

    setCameraLoading(true);
    setFaceCheckError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {
          // autoplay can be blocked in some runtimes; user interaction will resume playback.
        });
      }

      setCameraStarted(true);
    } catch (err: any) {
      setFaceCheckError(err?.message || 'Unable to access camera for face verification.');
    } finally {
      setCameraLoading(false);
    }
  };

  const verifyFace = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setFaceCheckError('Camera preview not available.');
      return;
    }

    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setFaceCheckError('Camera is not ready yet. Please wait a moment and try again.');
      return;
    }

    setVerifyingFace(true);
    setFaceCheckError('');

    try {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setFaceCheckError('Unable to process camera frame.');
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      const token = localStorage.getItem('token');

      const result = await (window as any).electronAPI.apiCall('POST', '/api/proctoring/precheck-face', {
        frame,
        token,
      });

      if (!result.success) {
        setFaceCheckError(result.error || 'Face verification failed.');
        return;
      }

      const faceCount = Number(result.data?.face_count || 0);
      if (faceCount === 1) {
        setFaceVerified(true);
        setFaceCheckError('');
        return;
      }

      if (faceCount > 1) {
        setFaceCheckError('Multiple faces detected. Ensure only one face is visible.');
        return;
      }

      setFaceCheckError('No face detected. Please align your face clearly in the camera.');
    } catch (err: any) {
      setFaceCheckError(err?.message || 'Face verification failed.');
    } finally {
      setVerifyingFace(false);
    }
  };

  const beginExam = async () => {
    if (!accepted || !exam || !faceVerified) {
      return;
    }

    setStarting(true);
    setError('');

    try {
      const guardResult = await (window as any).electronAPI.checkSafeExamGuard();
      if (!guardResult?.ok) {
        const blockedApps = Array.isArray(guardResult?.blockedApps)
          ? guardResult.blockedApps
          : [];
        const blockedText = blockedApps.length
          ? blockedApps.map((item: { name: string; count: number }) => `${item.name} (${item.count})`).join(', ')
          : '';
        setError(blockedText
          ? `Please close these applications before starting the exam: ${blockedText}`
          : (guardResult?.message || 'Please close non-essential applications before starting the exam.'));
        return;
      }

      const token = localStorage.getItem('token');
      const result = await (window as any).electronAPI.startExamSession(exam.id, token);

      if (!result.success) {
        setError(result.error || 'Unable to start exam session');
        return;
      }

      localStorage.setItem('desktop-active-session', JSON.stringify(result.data));
      localStorage.removeItem('desktop-last-result');
      navigate(`/desktop/exam-session/${result.data.session_id}`);
    } catch (err: any) {
      setError(err.message || 'Unable to start exam session');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading terms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Terms and Conditions</CardTitle>
            <CardDescription>
              Read and accept all terms before starting your exam.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {exam && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-gray-500">Exam</p>
                  <p className="font-semibold mt-1">{exam.title}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="h-4 w-4" /> Duration</p>
                  <p className="font-semibold mt-1">{exam.duration_minutes} minutes</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-gray-500 flex items-center gap-1"><FileText className="h-4 w-4" /> Questions</p>
                  <p className="font-semibold mt-1">{exam.total_questions}</p>
                </div>
              </div>
            )}

            <div className="rounded-lg border p-4 space-y-2 text-sm text-gray-700">
              <p>1. Keep your face visible to the camera throughout the exam.</p>
              <p>2. Do not switch tabs, windows, or open unauthorized applications.</p>
              <p>3. Once submitted, the exam attempt cannot be resumed.</p>
              <p>4. Your activity may be logged for proctoring and audit purposes.</p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Checkbox
                id="desktop-terms"
                checked={accepted}
                onCheckedChange={(checked) => setAccepted(Boolean(checked))}
              />
              <label htmlFor="desktop-terms" className="text-sm text-gray-700 leading-6 cursor-pointer">
                I have read and understood the terms and conditions. I agree to proceed with this exam attempt.
              </label>
            </div>

            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Face Recognition Test</p>
                  <p className="text-xs text-gray-600 mt-1">A single-face verification is required before starting the exam.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={startFaceCheckCamera}
                  disabled={cameraLoading || faceVerified}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {cameraLoading ? 'Opening Camera...' : faceVerified ? 'Verified' : cameraStarted ? 'Camera Ready' : 'Start Camera'}
                </Button>
              </div>

              {cameraStarted && (
                <div className="space-y-3">
                  <div className="rounded-lg overflow-hidden border bg-black">
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-56 object-cover" />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />

                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-sm ${faceVerified ? 'text-green-700' : 'text-gray-600'}`}>
                      {faceVerified ? 'Face verified successfully.' : 'Keep your full face centered, then verify.'}
                    </p>
                    <Button
                      onClick={verifyFace}
                      disabled={verifyingFace || faceVerified}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {verifyingFace ? 'Verifying...' : faceVerified ? 'Verified' : 'Verify Face'}
                    </Button>
                  </div>
                </div>
              )}

              {faceCheckError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {faceCheckError}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => navigate(-1)} disabled={starting}>
                Back
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={beginExam}
                disabled={!accepted || starting || !exam || !faceVerified}
              >
                {starting ? 'Starting Exam...' : 'Accept and Start Exam'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
