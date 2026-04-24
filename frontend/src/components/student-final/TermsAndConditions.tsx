import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

interface TermsAndConditionsProps {
  examTitle: string;
  onAccept: () => void;
}

export function TermsAndConditions({ examTitle, onAccept }: TermsAndConditionsProps) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-8">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        <h1 className="text-3xl font-bold text-center mb-2">Terms and Conditions</h1>
        <p className="text-muted-foreground text-center mb-6">
          Please read and accept the following terms before starting <span className="font-semibold text-foreground">{examTitle}</span>.
        </p>

        <div className="flex-1 overflow-y-auto border border-border rounded-md p-6 bg-muted/30 text-sm space-y-4 mb-6">
          <section>
            <h2 className="font-semibold mb-1">1. Academic Integrity</h2>
            <p>
              You agree to complete this examination honestly and without any unauthorized assistance. Cheating, plagiarism, or using
              prohibited materials will result in disqualification and may lead to disciplinary action.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">2. Proctoring Consent</h2>
            <p>
              By proceeding, you consent to being monitored through your webcam and microphone during the exam. Your video, audio, and
              screen activity may be recorded for verification purposes. AI-based monitoring will flag suspicious behavior such as looking
              away, additional faces, or background voices.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">3. Exam Environment</h2>
            <p>
              You must ensure a quiet, well-lit, and private environment. No other individuals should be present in the room. Mobile phones,
              smartwatches, and other electronic devices (except the computer used for the exam) must be kept out of reach.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">4. Technical Requirements</h2>
            <p>
              You are responsible for ensuring a stable internet connection and a functioning webcam and microphone. Technical issues during
              the exam should be reported immediately but may not guarantee additional time or a retake.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">5. Browser Restrictions</h2>
            <p>
              Switching tabs, minimizing the browser, or opening other applications during the exam is prohibited and will be logged as a
              violation. Multiple violations may result in automatic termination of your exam session.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">6. Data Privacy</h2>
            <p>
              All recorded data will be handled in accordance with applicable data protection laws and the institution's privacy policy.
              Recordings will be retained only for the period necessary to verify exam integrity and will be deleted thereafter.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">7. Acknowledgement</h2>
            <p>
              By accepting these terms, you confirm that you have read, understood, and agree to abide by all the rules and conditions
              outlined above. Failure to comply may result in score invalidation and academic penalties.
            </p>
          </section>
        </div>

        <div className="flex items-center space-x-3 mb-4">
          <Checkbox
            id="accept-terms"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked === true)}
          />
          <label htmlFor="accept-terms" className="text-sm cursor-pointer select-none">
            I have read and agree to the Terms and Conditions
          </label>
        </div>

        <button
          onClick={onAccept}
          disabled={!accepted}
          className="w-full px-5 py-3 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          Continue to Exam
        </button>
      </div>
    </div>
  );
}
