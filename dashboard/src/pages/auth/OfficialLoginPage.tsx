import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/types';

type Portal = 'institute' | 'dev';

const allowedRoleByPortal: Record<Portal, UserRole[]> = {
  institute: ['institute_admin', 'faculty'],
  dev: ['super_admin'],
};

const OfficialLoginPage: React.FC = () => {
  const [portal, setPortal] = useState<Portal>('institute');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await login(email, password, portal);
      if (!allowedRoleByPortal[portal].includes(user.role)) {
        toast({ title: 'Login blocked', description: 'These credentials are not allowed on this portal.', variant: 'destructive' });
        return;
      }

      // Current extracted dashboard bundle includes student pages only.
      if (user.role === 'student') {
        navigate('/student');
        return;
      }

      navigate('/portal-unavailable');
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
          <h1 className="text-xl md:text-2xl font-semibold">Institute / Dev Login</h1>
          <p className="text-primary-foreground/70 text-sm md:text-base">Use institute admin, faculty, or super admin credentials.</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-8 md:py-10">
        <div className="rounded-xl border bg-card shadow-card p-5 border-warning/40">
          <form onSubmit={(e) => void handleLogin(e)} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Portal</label>
              <select
                value={portal}
                onChange={(e) => setPortal(e.target.value as Portal)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="institute">Institute (admin/faculty)</option>
                <option value="dev">Developer (super admin)</option>
              </select>
            </div>

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

            <Button type="submit" className="w-full bg-warning text-warning-foreground hover:bg-warning/90">
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OfficialLoginPage;
