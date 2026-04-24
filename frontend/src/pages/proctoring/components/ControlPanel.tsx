/**
 * Control Panel Component
 * Provides buttons for proctor to control exam
 */

import React from 'react';
import { Pause, Play, X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ControlPanelProps {
  sessionStatus: 'active' | 'paused' | 'suspended' | 'completed';
  onSuspend: () => void;
  onResume: () => void;
  onEndEarly: () => void;
  proctoringMode: 'one-way' | 'two-way';
  onModeChange?: (mode: 'one-way' | 'two-way') => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  sessionStatus,
  onSuspend,
  onResume,
  onEndEarly,
  proctoringMode,
  onModeChange,
}) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {onModeChange && sessionStatus !== 'completed' && (
        <>
          <Button
            variant={proctoringMode === 'one-way' ? 'default' : 'outline'}
            onClick={() => onModeChange('one-way')}
            className={proctoringMode === 'one-way' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
          >
            One-way
          </Button>
          <Button
            variant={proctoringMode === 'two-way' ? 'default' : 'outline'}
            onClick={() => onModeChange('two-way')}
            className={proctoringMode === 'two-way' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
          >
            Two-way
          </Button>
        </>
      )}
      {sessionStatus === 'active' && (
        <>
          <Button
            onClick={onSuspend}
            className="bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" /> Suspend
          </Button>
          
          <Button
            onClick={onEndEarly}
            className="bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" /> End Early
          </Button>
        </>
      )}

      {sessionStatus === 'suspended' && (
        <>
          <Button
            onClick={onResume}
            className="col-span-2 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> Resume Exam
          </Button>
          
          <Button
            onClick={onEndEarly}
            className="col-span-2 bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" /> End Session
          </Button>
        </>
      )}

      {sessionStatus === 'completed' && (
        <Button disabled className="col-span-2 bg-gray-700 text-gray-400">
          ✓ Session Ended
        </Button>
      )}

      {/* Info Box */}
      <div className="col-span-2 bg-gray-700/50 p-2 rounded text-xs text-gray-300">
        <p className="font-semibold mb-1">Mode: {proctoringMode.toUpperCase()}</p>
        {proctoringMode === 'one-way' && (
          <p>Student receives your alerts and can see screen/camera</p>
        )}
        {proctoringMode === 'two-way' && (
          <p>Bidirectional communication enabled</p>
        )}
      </div>
    </div>
  );
};
