import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, ShieldCheck } from 'lucide-react';

interface DesktopResult {
  exam_title: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  attempted_questions: number;
  total_violations?: number;
}

export default function DesktopExamResultPage() {
  const navigate = useNavigate();
  const raw = localStorage.getItem('desktop-last-result');
  const result: DesktopResult | null = raw ? JSON.parse(raw) : null;

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Result Not Available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">No recent exam result was found for this session.</p>
            <Button onClick={() => navigate('/desktop/exam')}>Go to Assigned Exams</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  const scoreLabel = result.score >= 40 ? 'PASSED' : 'FAILED';
  const violationCount = result.total_violations ?? 0;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl p-8 md:p-10">
        <div className="flex flex-col items-center text-center">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
            <ShieldCheck className="h-9 w-9" />
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight">Examination Complete</h1>
          <p className="mt-3 text-lg text-slate-500">Your responses have been submitted securely.</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="rounded-3xl border border-slate-200 bg-slate-50">
            <CardContent className="pt-8 pb-7 text-center">
              <p className="text-xl font-semibold uppercase tracking-wider text-slate-500">Total Score</p>
              <p className="mt-4 text-6xl font-bold text-slate-900">{result.score}%</p>
              <p className={`mt-3 text-xl font-semibold ${result.score >= 40 ? 'text-emerald-600' : 'text-red-500'}`}>
                {scoreLabel}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-slate-50">
            <CardContent className="pt-8 pb-7 text-center">
              <p className="text-xl font-semibold uppercase tracking-wider text-slate-500">Total Violations</p>
              <p className="mt-4 text-6xl font-bold text-slate-900">{violationCount}</p>
              <p className={`mt-3 text-xl font-semibold ${violationCount === 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {violationCount === 0 ? 'CLEAN' : 'FLAGGED'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Button
          className="mt-10 h-14 w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-xl font-semibold text-white hover:from-violet-700 hover:to-purple-700"
          onClick={() => navigate('/desktop/exam')}
        >
          <Home className="mr-2 h-5 w-5" />
          Return to Dashboard
        </Button>

        <p className="mt-4 text-center text-sm text-slate-500">{result.exam_title}</p>
      </div>
    </div>
  );
}
