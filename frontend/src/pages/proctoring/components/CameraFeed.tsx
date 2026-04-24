/**
 * Camera Feed Component
 * Displays student's camera stream in real-time
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface CameraFeedProps {
  sessionId: string;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ sessionId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const setupStream = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // In production, this would be a WebRTC stream from the EXE
        // For now, connect to RTMP or HLS endpoint
        const streamUrl = `${process.env.REACT_APP_STREAM_SERVER}/live/${sessionId}`;

        if (videoRef.current) {
          // Using HLS (HTTP Live Streaming) for better compatibility
          const videoElement = videoRef.current;
          
          // Check if browser supports HLS
          if ((videoElement as any).canPlayType('application/vnd.apple.mpegurl')) {
            videoElement.src = streamUrl + '/index.m3u8';
            videoElement.addEventListener('loadstart', () => setIsLoading(false));
            videoElement.addEventListener('error', () => {
              setError('Failed to load camera stream');
              setIsLoading(false);
            });
            videoElement.play();
          } else {
            // Fallback to RTMP (requires rtmp.js library)
            setError('HLS not supported. Trying RTMP...');
          }
        }
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    setupStream();

    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };
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
            <p className="text-gray-400 text-xs mt-2">Retrying...</p>
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
    </div>
  );
};
