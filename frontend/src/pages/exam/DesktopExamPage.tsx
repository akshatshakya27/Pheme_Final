import React, { useState } from 'react';
import DesktopLoginPage from '@/pages/exam/DesktopLoginPage';
import DesktopExamsPage from '@/pages/exam/DesktopExamsPage';

/**
 * DesktopExamPage - Entry point for desktop exam flow
 * This page is used to route between different desktop exam states:
 * - Login (for Electron app)
 * - Exam selection
 * - Exam taking
 * - Results
 */

export default function DesktopExamPage() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('desktop-token'));

  const handleLoginSuccess = (accessToken: string) => {
    sessionStorage.setItem('desktop-token', accessToken);
    setToken(accessToken);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('desktop-token');
    setToken(null);
  };

  if (!token) {
    return <DesktopLoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return <DesktopExamsPage onLogout={handleLogout} />;
}
