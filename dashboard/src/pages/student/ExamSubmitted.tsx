import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

const ExamSubmittedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-success/10 mb-4">
          <CheckCircle className="h-10 w-10 text-success" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Exam Submitted!</h1>
        <p className="text-muted-foreground max-w-md">
          Your answers have been recorded successfully. Results will be available once released by the faculty.
        </p>
        <div className="pt-4">
          <Button onClick={() => navigate('/student')} className="bg-accent text-accent-foreground hover:bg-accent/90">
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExamSubmittedPage;
