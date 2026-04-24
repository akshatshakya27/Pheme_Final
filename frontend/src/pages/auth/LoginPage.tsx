import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

import { UserRole } from '@/types';

const roleRoutes: Record<UserRole, string> = {
  super_admin: '/super-admin',
  institute_admin: '/institute',
  faculty: '/faculty',
  student: '/student',
};

type Portal = 'student' | 'institute' | 'dev';

const allowedRoleByPortal: Record<Portal, UserRole[]> = {
  student: ['student'],
  institute: ['institute_admin', 'faculty'],
  dev: ['super_admin'],
};

const portalConfig: Record<Portal, { title: string; subtitle: string; helper: string; accent: string; button: string }> = {
  student: {
    title: 'Student Login',
    subtitle: 'Sign in with student credentials only',
    helper: 'This portal validates only student accounts.',
    accent: 'border-info/40',
    button: 'bg-info text-info-foreground hover:bg-info/90',
  },
  institute: {
    title: 'Institute Login',
    subtitle: 'Sign in as institute admin or faculty',
    helper: 'This portal validates only institute admin and faculty accounts.',
    accent: 'border-warning/40',
    button: 'bg-warning text-warning-foreground hover:bg-warning/90',
  },
  dev: {
    title: 'Dev Login',
    subtitle: 'Sign in as super admin only',
    helper: 'This portal validates only super admin accounts.',
    accent: 'border-destructive/40',
    button: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  },
};

type LoginVariant = 'student' | 'official';

interface LoginPageProps {
  variant?: LoginVariant;
}

const LoginPage: React.FC<LoginPageProps> = ({ variant = 'student' }) => {
  const [credentials, setCredentials] = useState<Record<Portal, { email: string; password: string; showPass: boolean }>>({
    student: { email: '', password: '', showPass: false },
    institute: { email: '', password: '', showPass: false },
    dev: { email: '', password: '', showPass: false },
  });
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const portals: Portal[] = variant === 'official' ? ['institute', 'dev'] : ['student'];

  const setPortalField = (portal: Portal, key: 'email' | 'password' | 'showPass', value: string | boolean) => {
    setCredentials((prev) => ({
      ...prev,
      [portal]: {
        ...prev[portal],
        [key]: value,
      },
    }));
  };

  const handleLogin = async (e: React.FormEvent, portal: Portal) => {
    e.preventDefault();
    try {
      const authenticatedUser = await login(credentials[portal].email, credentials[portal].password, portal);
      if (!allowedRoleByPortal[portal].includes(authenticatedUser.role)) {
        toast({ title: 'Login blocked', description: 'These credentials are not allowed on this portal.', variant: 'destructive' });
        return;
      }
      navigate(roleRoutes[authenticatedUser.role]);
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
          <h1 className="text-xl md:text-2xl font-semibold">
            {variant === 'official' ? 'Official Login Portals' : 'Student Login'}
          </h1>
          <p className="text-primary-foreground/70 text-sm md:text-base">
            {variant === 'official'
              ? 'Use the correct card for Institute or Dev credentials.'
              : 'This page accepts student credentials only.'}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 md:py-10">
        <div className={`grid grid-cols-1 ${variant === 'official' ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-5`}>
          {portals.map((portal) => {
            const cfg = portalConfig[portal];
            return (
              <div key={portal} className={`rounded-xl border bg-card shadow-card p-5 ${cfg.accent}`}>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">{cfg.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{cfg.subtitle}</p>
                  <p className="text-xs mt-2 text-muted-foreground">{cfg.helper}</p>
                </div>

                <form onSubmit={(e) => void handleLogin(e, portal)} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Email</label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={credentials[portal].email}
                      onChange={(e) => setPortalField(portal, 'email', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Password</label>
                    <div className="relative">
                      <Input
                        type={credentials[portal].showPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={credentials[portal].password}
                        onChange={(e) => setPortalField(portal, 'password', e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setPortalField(portal, 'showPass', !credentials[portal].showPass)}
                      >
                        {credentials[portal].showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className={`w-full ${cfg.button}`}>Sign In</Button>
                </form>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;