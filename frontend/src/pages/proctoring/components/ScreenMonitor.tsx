/**
 * Screen Monitor Component
 * Displays student's screen recording in real-time
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface ScreenMonitorProps {
  sessionId: string;
}

export const ScreenMonitor: React.FC<ScreenMonitorProps> = ({ sessionId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  useEffect(() => {
    const setupStream = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Connect to screen recording stream
        const streamUrl = `${process.env.REACT_APP_STREAM_SERVER}/screen/${sessionId}`;

        if (videoRef.current) {
          const videoElement = videoRef.current;
          
          if ((videoElement as any).canPlayType('application/vnd.apple.mpegurl')) {
            videoElement.src = streamUrl + '/index.m3u8';
            videoElement.addEventListener('loadstart', () => setIsLoading(false));
            videoElement.addEventListener('error', () => {
              setError('Failed to load screen stream');
              setIsLoading(false);
            });
            videoElement.play();
          }
        }
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    setupStream();
  }, [sessionId]);

  return (
    <div className="w-full h-full relative bg-black flex items-center justify-center">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin">
            <div className="w-8 h-8 border-4 border-gray-600 border-t-blue-500 rounded-full" />
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Anomaly Overlay */}
      {anomalies.length > 0 && (
        <div className="absolute top-4 right-4 space-y-2 max-w-xs">
          {anomalies.map((anomaly, idx) => (
            <div
              key={idx}
              className={`p-2 rounded text-xs ${
                anomaly.severity === 'critical'
                  ? 'bg-red-600 text-white'
                  : 'bg-yellow-600 text-white'
              }`}
            >
              {anomaly.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
