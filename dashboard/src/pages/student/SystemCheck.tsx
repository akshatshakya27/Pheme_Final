import React, { useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Camera, Mic, Wifi, Monitor, User, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { listMyAssignments, listMySessions } from '@/lib/backendApi';

interface CheckItem {
  id: string;
  label: string;
  icon: React.ElementType;
  required: boolean;
  status: 'pending' | 'pass' | 'fail';
}

const SystemCheckPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [checks, setChecks] = useState<CheckItem[]>([
    { id: 'camera', label: 'Camera Access', icon: Camera, required: true, status: 'pending' },
    { id: 'mic', label: 'Microphone Access', icon: Mic, required: true, status: 'pending' },
    { id: 'network', label: 'Network Speed', icon: Wifi, required: true, status: 'pending' },
    { id: 'browser', label: 'Browser Compatibility', icon: Monitor, required: true, status: 'pending' },
    { id: 'face', label: 'Face Alignment', icon: User, required: true, status: 'pending' },
  ]);
  const { data: assignments = [] } = useQuery({
    queryKey: ['system-check', 'assignments'],
    queryFn: listMyAssignments,
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ['system-check', 'sessions'],
    queryFn: listMySessions,
  });

  const activeExamIds = new Set([
    ...assignments.filter((exam) => exam.status === 'live').map((exam) => exam.id),
    ...sessions.filter((session) => session.status === 'in_progress').map((session) => session.exam_id),
  ]);

  const resolvedExamId =
    sessionStorage.getItem('student_active_exam_id')
    || assignments.find((exam) => activeExamIds.has(exam.id))?.id
    || assignments[0]?.id
    || null;

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const setStatus = (id: string, status: CheckItem['status']) => {
    setChecks((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  const ensureVideoPreview = async (stream: MediaStream) => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    await videoRef.current.play().catch(() => {
      // no-op; some browsers delay autoplay until interaction.
    });
  };

  const runCheck = async (id: string) => {
    setStatus(id, 'pending');

    try {
      if (id === 'camera') {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!streamRef.current) {
          streamRef.current = stream;
        } else {
          stream.getTracks().forEach((track) => track.stop());
        }
        await ensureVideoPreview(streamRef.current || stream);
        const cameraTrack = (streamRef.current || stream).getVideoTracks()[0];
        setStatus(id, cameraTrack && cameraTrack.readyState === 'live' ? 'pass' : 'fail');
        return;
      }

      if (id === 'mic') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const micTrack = stream.getAudioTracks()[0];
        const passed = !!micTrack && micTrack.readyState === 'live';
        stream.getTracks().forEach((track) => track.stop());
        setStatus(id, passed ? 'pass' : 'fail');
        return;
      }

      if (id === 'network') {
        const nav = navigator as Navigator & { connection?: { downlink?: number } };
        const downlink = nav.connection?.downlink || 0;
        const passed = navigator.onLine && (downlink === 0 || downlink >= 1);
        setStatus(id, passed ? 'pass' : 'fail');
        return;
      }

      if (id === 'browser') {
        const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        const hasFullscreen = !!(
          document.fullscreenEnabled
          || (document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
        );
        setStatus(id, hasMedia && hasFullscreen ? 'pass' : 'fail');
        return;
      }

      if (id === 'face') {
        const stream = streamRef.current;
        const hasLiveVideo = !!stream && stream.getVideoTracks().some((track) => track.readyState === 'live');
        if (!hasLiveVideo || !videoRef.current || videoRef.current.readyState < 2) {
          setStatus(id, 'fail');
          return;
        }

        // Basic liveness proxy: ensure frame dimensions are available from active camera.
        const hasFrame = videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0;
        setStatus(id, hasFrame ? 'pass' : 'fail');
        return;
      }

      setStatus(id, 'fail');
    } catch {
      setStatus(id, 'fail');
    }
  };

  const runAll = async () => {
    setIsRunningAll(true);
    for (const check of checks) {
      // Intentional sequential checks for predictable browser permission prompts.
      await runCheck(check.id);
    }
    setIsRunningAll(false);
  };

  const allPassed = checks.every(c => !c.required || c.status === 'pass');

  const startExam = () => {
    if (!allPassed) {
      toast({ title: 'System Check Failed', description: 'Complete all required checks before starting.', variant: 'destructive' });
      return;
    }
    if (!resolvedExamId) {
      toast({ title: 'No exam available', description: 'No assigned exam found to attempt right now.', variant: 'destructive' });
      return;
    }

    sessionStorage.setItem('student_active_exam_id', resolvedExamId);
    sessionStorage.setItem('student_system_check_passed', '1');
    localStorage.setItem('student_system_check_passed', '1');
    navigate('/student/exam-attempt');
  };

  return (
    <DashboardLayout>
      <PageHeader title="System Check" subtitle="Verify your system before starting the exam" breadcrumbs={[{ label: 'Dashboard', path: '/student' }, { label: 'Exams', path: '/student/exams' }, { label: 'System Check' }]} />

      <div className="max-w-lg mx-auto space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium mb-3">Live Camera Preview</p>
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-52 rounded-md bg-muted object-cover" />
          <p className="text-xs text-muted-foreground mt-2">Camera and face checks only pass when live video is available.</p>
        </div>

        {checks.map(check => {
          const Icon = check.icon;
          return (
            <div key={check.id} className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
              check.status === 'pass' ? 'border-success/30 bg-success/5' :
              check.status === 'fail' ? 'border-destructive/30 bg-destructive/5' :
              'border-border bg-card'
            }`}>
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{check.label}</p>
                  {check.required && <p className="text-xs text-muted-foreground">Required</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {check.status === 'pass' && <Check className="h-5 w-5 text-success" />}
                {check.status === 'fail' && <X className="h-5 w-5 text-destructive" />}
                {check.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                <Button variant="outline" size="sm" onClick={() => runCheck(check.id)}>Test</Button>
              </div>
            </div>
          );
        })}

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={runAll} className="flex-1" disabled={isRunningAll}>{isRunningAll ? 'Running...' : 'Run All Checks'}</Button>
          <Button disabled={!allPassed} onClick={startExam} className="flex-1 bg-success text-success-foreground hover:bg-success/90">
            Start Exam
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SystemCheckPage;
