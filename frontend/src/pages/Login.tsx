import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { roleDefaultRoute } from '@/components/auth/RequireAuth';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  { icon: Shield, label: 'AI-Powered Proctoring', desc: 'Real-time face detection & behavioral analysis' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'proctor' | 'student'>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password, role);
      const { user } = useAuthStore.getState();
      if (user) navigate(roleDefaultRoute[user.role]);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || 'Login failed. Check your credentials.');
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — Branding */}
      <div className="hidden lg:flex lg:w-[55%] bg-primary relative overflow-hidden flex-col justify-between p-12">
        {/* Subtle geometric background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
          <div className="absolute bottom-0 -left-24 w-80 h-80 rounded-full bg-white/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/3" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg" style={{ fontFamily: 'Lato, sans-serif' }}>Proctora</p>
            <p className="text-white/60 text-[10px] uppercase tracking-widest">Enterprise AI Proctoring</p>
          </div>
        </div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10"
        >
          <h2 className="text-4xl font-bold text-white leading-tight mb-4" style={{ fontFamily: 'Source Serif 4, Georgia, serif' }}>
            Integrity in Every<br />Examination.
          </h2>
          <p className="text-white/70 text-sm leading-relaxed max-w-sm">
            A comprehensive AI-powered proctoring platform built for universities, colleges, and certification bodies.
          </p>

          <div className="mt-8 space-y-3">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <f.icon className="h-4 w-4 text-white/80" />
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">{f.label}</p>
                  <p className="text-white/55 text-[11px]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Stats footer */}
        <div className="relative z-10 flex gap-6">
          {[
            { label: 'Institutions', value: '500+' },
            { label: 'Exams Proctored', value: '2M+' },
            { label: 'AI Accuracy', value: '99.2%' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-white text-xl font-bold">{s.value}</p>
              <p className="text-white/55 text-[11px]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — Login form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 lg:p-12 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="h-4.5 w-4.5 text-white" style={{ height: '18px', width: '18px' }} />
            </div>
            <span className="text-lg font-bold text-foreground" style={{ fontFamily: 'Lato, sans-serif' }}>Proctora</span>
          </div>

          <div className="mb-7">
            <h3 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Source Serif 4, Georgia, serif' }}>
              Sign In
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Access your institutional dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/8 border border-destructive/20">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Login As
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { value: 'admin', label: 'Admin' },
                  { value: 'proctor', label: 'Proctor' },
                  { value: 'student', label: 'Student' },
                ].map((item) => (
                  <label
                    key={item.value}
                    className="flex items-center gap-2 p-3 rounded-lg border-2 border-border cursor-pointer transition-all"
                    style={{
                      borderColor: role === item.value ? '#3b82f6' : '',
                      backgroundColor: role === item.value ? '#eff6ff' : '',
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={item.value}
                      checked={role === item.value}
                      onChange={(e) => setRole(e.target.value as 'admin' | 'proctor' | 'student')}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-foreground">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Institutional Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                className="w-full h-10 px-3 rounded-lg bg-white border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3 pr-10 rounded-lg bg-white border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 mt-1"
              style={{ marginTop: '8px' }}
            >
              {isLoading ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>

          <p className="text-center text-[10px] text-muted-foreground mt-6">
            © 2026 AI Proctor System · All rights reserved.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
