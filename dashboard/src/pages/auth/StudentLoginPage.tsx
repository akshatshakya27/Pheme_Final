import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const StudentLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await login(email, password, 'student');
      if (user.role !== 'student') {
        toast({ title: 'Login blocked', description: 'This page is for student accounts only.', variant: 'destructive' });
        return;
      }
      navigate('/student');
    } catch (error) {
      toast({ title: 'Login failed', description: (error as Error).message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-hero p-6 md:p-10">
        <div className="max-w-6xl mx-auto text-primary-foreground">
          <div className="inline-flex items-center gap-3 mb-2">
            <Shield className="h-9 w-9 text-accent" />
            <span className="text-3xl font-bold tracking-tight">ProctorX</span>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold">Student Login</h1>
          <p className="text-primary-foreground/70 text-sm md:text-base">Sign in with student credentials only.</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-8 md:py-10">
        <div className="rounded-xl border bg-card shadow-card p-5 border-info/40">
          <form onSubmit={(e) => void handleLogin(e)} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Email</label>
              <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Password</label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPass((prev) => !prev)}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-info text-info-foreground hover:bg-info/90">
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentLoginPage;
