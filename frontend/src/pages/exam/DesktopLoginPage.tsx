import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

interface DesktopLoginPageProps {
  onLoginSuccess?: (token: string) => void;
}

export default function LoginPage({ onLoginSuccess }: DesktopLoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Call Electron API
      const result = await (window as any).electronAPI.login(email, password);

      if (result.success) {
        // Store token
        const accessToken = result.data.access_token;
        localStorage.setItem('token', accessToken);
        localStorage.setItem(
          'user',
          JSON.stringify({
            id: result.data.user_id,
            role: result.data.role,
            email,
          })
        );

        // Inform parent so desktop flow can switch to exams immediately
        onLoginSuccess?.(accessToken);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Pheme Exam</CardTitle>
          <CardDescription className="text-center">Secure Proctored Examination</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 flex gap-2 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="student@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 h-10"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>

            <p className="text-xs text-center text-gray-500 mt-4">
              This is a secure exam environment. Only authorized attempts will be allowed.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
