import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    idNumber: '',
    email: '',
    phone: '',
    password: '',
  });

  const [otp, setOtp] = useState('');
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [recording, setRecording] = useState(false);
  const [videoDone, setVideoDone] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (showVideoModal) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          toast({
            title: 'Camera access denied',
            description: 'Allow camera permission to continue registration.',
            variant: 'destructive',
          });
        });
    }

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [showVideoModal, toast]);

  const handleRecord = () => {
    setRecording(true);

    setTimeout(() => {
      setRecording(false);
      setVideoDone(true);
      toast({ title: 'Video captured successfully' });
    }, 2000);
  };

  const handleFinish = () => {
    toast({
      title: 'Registration flow completed',
      description: 'Proceed to login with your credentials.',
    });
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-1 gradient-hero items-center justify-center p-12">
        <div className="max-w-lg text-center space-y-6">
          <div className="inline-flex items-center gap-3">
            <Shield className="h-12 w-12 text-accent" />
            <span className="text-4xl font-bold text-primary-foreground">ProctorX</span>
          </div>

          <h2 className="text-xl text-primary-foreground/80">AI-Powered Exam Proctoring</h2>

          <p className="text-primary-foreground/60">
            Create your account with identity verification before you login.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          <h1 className="text-2xl font-bold">Register Account</h1>

          <div className="flex justify-between text-xs">
            {['Details', 'OTP', 'Video', 'Finish'].map((s, i) => (
              <span key={i} className={step >= i + 1 ? 'text-primary font-semibold' : 'text-muted-foreground'}>
                {s}
              </span>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <Input placeholder="First Name" onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              <Input placeholder="Last Name" onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              <Input type="date" onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              <Input placeholder="ID Number" onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
              <Input placeholder="Email" onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input
                placeholder="Password"
                type="password"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <Input placeholder="Phone" onChange={(e) => setForm({ ...form, phone: e.target.value })} />

              <Button
                onClick={() => {
                  toast({ title: 'OTP sent successfully' });
                  setStep(2);
                }}
                className="w-full"
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Input placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />

              <Button
                onClick={() => {
                  toast({ title: 'OTP Verified' });
                  setStep(3);
                }}
                className="w-full"
              >
                Verify OTP
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <Button onClick={() => setShowVideoModal(true)} className="w-full">
                {videoDone ? 'Re-record Video' : 'Capture Video'}
              </Button>

              {videoDone && <p className="text-green-500 text-sm">Video Verified</p>}

              <Button disabled={!videoDone} onClick={() => setStep(4)} className="w-full">
                Continue
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <Button onClick={handleFinish} className="w-full bg-accent">
                Go To Login
              </Button>
              <Button onClick={() => navigate('/login')} variant="outline" className="w-full">
                Back To Login
              </Button>
            </div>
          )}
        </div>
      </div>

      {showVideoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-xl w-96 space-y-4">
            <h3 className="font-semibold">Video KYC</h3>

            <video ref={videoRef} autoPlay className="w-full h-48 rounded" />

            <Button onClick={handleRecord} disabled={recording} className="w-full">
              {recording ? 'Recording...' : 'Record Video'}
            </Button>

            <Button onClick={() => setShowVideoModal(false)} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterPage;
