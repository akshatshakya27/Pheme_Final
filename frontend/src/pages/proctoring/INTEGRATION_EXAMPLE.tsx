/**
 * Example Integration in App.tsx
 * Shows how to add the Proctoring Panel to your Dashboard routing
 */

import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ProctoringPanel } from '@/pages/proctoring/ProctoringPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

function App() {
  const { user } = useAuth();

  return (
    <Router>
      <Routes>
        {/* Proctor Route - Protected */}
        <Route
          path="/proctoring/:sessionId"
          element={
            user?.role === 'proctor' ? (
              <ProctoringPanelPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Other routes... */}
      </Routes>
    </Router>
  );
}

/**
 * Wrapper component that extracts session details from URL
 */
function ProctoringPanelPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [localMode, setLocalMode] = useState<'one-way' | 'two-way' | null>(null);
  const { data: session, isLoading } = useQuery(
    ['proctoring:session', sessionId],
    async () => {
      const res = await fetch(`/api/proctoring/sessions/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('proctorx_access_token')}`,
        },
      });
      return res.json();
    }
  );

  useEffect(() => {
    if (!session?.proctoringMode || localMode) return;
    setLocalMode(session.proctoringMode);
  }, [localMode, session?.proctoringMode]);

  if (isLoading) {
    return <div>Loading session...</div>;
  }

  return (
    <ProctoringPanel
      sessionId={sessionId!}
      examId={session.examId}
      studentId={session.studentId}
      studentName={session.studentName}
      proctoringMode={localMode || session.proctoringMode || 'one-way'}
      onModeChange={(mode) => setLocalMode(mode)}
      onSessionEnd={() => {
        // Navigate back to sessions list
        window.location.href = '/proctoring';
      }}
    />
  );
}

export default App;
