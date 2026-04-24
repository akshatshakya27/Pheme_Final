import { motion } from 'framer-motion';
import { Home, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ResultProps {
  score: number;
  integrity: number;
  onBack: () => void;
  saveError?: string | null;
}

export function Result({ score, integrity, onBack, saveError }: ResultProps) {
  const isPassed = score >= 60;
  const isHighIntegrity = integrity >= 90;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-full max-w-lg"
      >
        <Card className="border-border bg-card card-shadow-md relative overflow-hidden">
          <CardHeader className="text-center pb-2 relative z-10">
            <div className="mx-auto h-16 w-16 bg-gradient-to-tr from-primary to-accent rounded-full flex items-center justify-center mb-6">
              <ShieldCheck className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold text-foreground mb-2">Examination Complete</CardTitle>
            <CardDescription className="text-muted-foreground">Your responses have been submitted securely.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-8 relative z-10 pt-8">
            {saveError && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm text-destructive">{saveError}</div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-secondary border border-border text-center">
                <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mb-2">Total Score</div>
                <div className="text-4xl font-bold text-foreground mb-1">{score}%</div>
                <div className={isPassed ? 'text-primary text-xs' : 'text-destructive text-xs'}>{isPassed ? 'PASSED' : 'FAILED'}</div>
              </div>
              <div className="p-6 rounded-2xl bg-secondary border border-border text-center">
                <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mb-2">Integrity Score</div>
                <div className="text-4xl font-bold text-foreground mb-1">{integrity}%</div>
                <div className={isHighIntegrity ? 'text-primary text-xs' : 'text-warning text-xs'}>{isHighIntegrity ? 'EXCELLENT' : 'REVIEW NEEDED'}</div>
              </div>
            </div>

            <Button className="w-full h-12 text-base font-semibold bg-primary hover:opacity-90 border-none text-primary-foreground" onClick={onBack}>
              <Home className="mr-2 h-4 w-4" /> Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
