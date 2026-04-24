import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Exam {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  total_questions: number;
  status: string;
}

interface DesktopExamsPageProps {
  onLogout?: () => void;
}

export default function DesktopExamsPage({ onLogout }: DesktopExamsPageProps) {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const token = localStorage.getItem('token');
      const result = await (window as any).electronAPI.getExams(token);

      if (result.success) {
        const payload = Array.isArray(result.data) ? result.data : (result.data?.exams || []);
        setExams(payload);
      } else {
        setError(result.error || 'Failed to fetch exams');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const startExam = (examId: string) => {
    localStorage.setItem('desktop-selected-exam-id', examId);
    navigate(`/desktop/exam-terms/${examId}`);
  };

  const handleLogout = async () => {
    await (window as any).electronAPI.logout();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout?.();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Available Exams</h1>
            <p className="text-gray-600 mt-2">Select an exam to begin</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {/* Exams Grid */}
        {exams.length === 0 ? (
          <Card>
            <CardContent className="pt-12 text-center">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No exams available at this time</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {exams.map((exam) => (
              <Card
                key={exam.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
              >
                <CardHeader>
                  <CardTitle className="text-xl">{exam.title}</CardTitle>
                  <CardDescription>{exam.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="h-4 w-4" />
                      <span>{exam.duration_minutes} minutes</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <BookOpen className="h-4 w-4" />
                      <span>{exam.total_questions} questions</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => startExam(exam.id)}
                    >
                      Start Exam
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
