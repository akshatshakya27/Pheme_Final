/**
 * Proctoring Panel - Main Component
 * 
 * This is the dashboard view where proctors monitor and control exams
 * Displays student camera, screen, violations, and provides control buttons
 * Supports both one-way and two-way proctoring modes
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AlertCircle, Camera, Monitor, AlertTriangle, Send } from 'lucide-react';
import { useProctoringWebSocket } from '@/hooks/useProctoringWebSocket';
import { CameraFeed } from './components/CameraFeed';
import { ScreenMonitor } from './components/ScreenMonitor';
import { ViolationTracker } from './components/ViolationTracker';
import { RemarksPanel } from './components/RemarksPanel';
import { ChatPanel } from './components/ChatPanel';
import { ControlPanel } from './components/ControlPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ProctoringPanelProps {
  sessionId: string;
  examId: string;
  studentId: string;
  studentName: string;
  proctoringMode: 'one-way' | 'two-way';
  onSessionEnd: () => void;
}

export const ProctoringPanel: React.FC<ProctoringPanelProps> = ({
  sessionId,
  examId,
  studentId,
  studentName,
  proctoringMode,
  onSessionEnd,
}) => {
  const { isConnected, sendCommand, on } = useProctoringWebSocket(sessionId);
  const proctorVideoRef = useRef<HTMLVideoElement | null>(null);
  const signalSocketRef = useRef<WebSocket | null>(null);
  const rtcPeerRef = useRef<RTCPeerConnection | null>(null);
  const proctorStreamRef = useRef<MediaStream | null>(null);
  const [twoWayError, setTwoWayError] = useState<string | null>(null);
  const [twoWayEnabled, setTwoWayEnabled] = useState(false);
  
  // Session state
  const [sessionStatus, setSessionStatus] = useState<'active' | 'paused' | 'suspended' | 'completed'>('active');
  const [examProgress, setExamProgress] = useState({ questionsAnswered: 0, questionsTotal: 0, timeRemaining: 0 });
  
  // Violations tracking
  const [violations, setViolations] = useState<any[]>([]);
  const [violationCount, setViolationCount] = useState(0);
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('low');
  
  // Alerts and warnings
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [remarks, setRemarks] = useState<any[]>([]);
  
  // UI state
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [showRemarksPanel, setShowRemarksPanel] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<'info' | 'warning' | 'critical'>('info');

  const buildSignalUrl = useCallback(() => {
    const token = localStorage.getItem('proctorx_access_token');
    if (!token) return '';

    const rawApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)
      || (import.meta.env.VITE_API_URL as string | undefined)
      || '/api';
    const apiBase = rawApiBase.trim().replace(/\/$/, '');
    const wsPath = `/proctoring/ws/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}&role=proctor`;
    if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
      return `${apiBase.replace(/^http/, 'ws')}${wsPath}`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const normalizedBase = apiBase.startsWith('/') ? apiBase : `/${apiBase}`;
    return `${protocol}://${window.location.host}${normalizedBase}${wsPath}`;
  }, [sessionId]);

  const sendSignal = useCallback((payload: Record<string, unknown>) => {
    const socket = signalSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  }, []);

  const attachProctorPreview = useCallback(async () => {
    const preview = proctorVideoRef.current;
    const stream = proctorStreamRef.current;
    if (!preview || !stream) return;

    if (preview.srcObject !== stream) {
      preview.srcObject = stream;
    }

    try {
      await preview.play();
      setTwoWayError(null);
    } catch {
      setTwoWayError('Proctor preview blocked by browser autoplay. Click the preview to start.');
    }
  }, []);

  useEffect(() => {
    if (proctoringMode !== 'two-way' || !twoWayEnabled) {
      signalSocketRef.current?.close();
      signalSocketRef.current = null;
      rtcPeerRef.current?.close();
      rtcPeerRef.current = null;
      if (proctorStreamRef.current) {
        proctorStreamRef.current.getTracks().forEach((track) => track.stop());
        proctorStreamRef.current = null;
      }
      setTwoWayError(null);
      return;
    }

    let cancelled = false;
    let heartbeatTimer: number | null = null;

    const startTwoWay = async () => {
      const wsUrl = buildSignalUrl();
      if (!wsUrl) {
        setTwoWayError('Missing auth token or invalid API base for WebSocket.');
        return;
      }

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      rtcPeerRef.current = peer;

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({ type: 'ice-candidate', payload: event.candidate.toJSON() });
        }
      };

      const startHeartbeat = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000) as unknown as number;
      };

      const socket = new WebSocket(wsUrl);
      signalSocketRef.current = socket;

      socket.onopen = () => {
        console.log('[Proctor 2-Way] WebSocket connected');
        setTwoWayError(null);
        startHeartbeat();
        sendSignal({ type: 'webrtc-ready' });
      };

      socket.onerror = (event) => {
        console.error('[Proctor 2-Way] WebSocket error:', event);
        setTwoWayError('Two-way connection error. Retrying...');
      };

      socket.onclose = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (!cancelled) {
          console.warn('[Proctor 2-Way] WebSocket closed');
          setTwoWayError('Two-way signaling disconnected. Reconnecting...');
          setTimeout(() => {
            if (!cancelled) void startTwoWay();
          }, 2000);
        }
      };

      socket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'signaling-ready') {
            console.log('[Proctor 2-Way] Backend ready');
            return;
          }

          if (message.type === 'pong') {
            console.log('[Proctor 2-Way] Heartbeat pong received');
            return;
          }

          if (message.type === 'webrtc-ready' && message.from_role === 'student') {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            sendSignal({ type: 'offer', payload: offer });
            return;
          }
          if (message.type === 'answer' && message.payload) {
            await peer.setRemoteDescription(new RTCSessionDescription(message.payload));
            return;
          }
          if (message.type === 'offer' && message.payload) {
            await peer.setRemoteDescription(new RTCSessionDescription(message.payload));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            sendSignal({ type: 'answer', payload: answer });
            return;
          }
          if (message.type === 'ice-candidate' && message.payload) {
            await peer.addIceCandidate(new RTCIceCandidate(message.payload));
          }
        } catch {
          // no-op
        }
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        proctorStreamRef.current = stream;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        await attachProctorPreview();
      } catch (err) {
        const errorName = (err as any)?.name || 'Unknown';
        const errorMsg = (err as any)?.message || String(err);
        console.error(`[Proctor 2-Way] getUserMedia failed: ${errorName} - ${errorMsg}`);
        
        // Map common error names to user-friendly messages
        let friendlyMsg = 'Failed to access proctor camera/microphone.';
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDenied') {
          friendlyMsg = 'Camera/mic permission denied. Check browser settings and Iriun permissions.';
        } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          friendlyMsg = 'No camera device found. Ensure Iriun is connected and selected.';
        } else if (errorName === 'NotReadableError') {
          friendlyMsg = 'Camera is in use by another app. Close Electron exam or other video apps.';
        }
        setTwoWayError(friendlyMsg);
      }
    };

    void startTwoWay();

    return () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      try {
        signalSocketRef.current?.close(1000, 'Component unmounted');
      } catch {}
      signalSocketRef.current = null;
      rtcPeerRef.current?.close();
      rtcPeerRef.current = null;
      if (proctorStreamRef.current) {
        proctorStreamRef.current.getTracks().forEach((track) => track.stop());
        proctorStreamRef.current = null;
      }
    };
  }, [attachProctorPreview, buildSignalUrl, proctoringMode, twoWayEnabled, sendSignal]);

  /**
   * Set up WebSocket listeners for exam events
   */
  useEffect(() => {
    // Listen for exam progress updates
    const unsubscribeProgress = on('exam.progress', (data: any) => {
      setExamProgress({
        questionsAnswered: data.questionsAnswered,
        questionsTotal: data.questionsTotal,
        timeRemaining: data.timeRemaining,
      });
    });

    // Listen for violations
    const unsubscribeViolation = on('violation.detected', (violation: any) => {
      setViolations((prev) => [...prev, violation]);
      setViolationCount((prev) => prev + 1);
      
      // Update risk level based on violation severity
      if (violation.severity === 'critical') {
        setRiskLevel('high');
      } else if (violation.severity === 'major') {
        setRiskLevel('medium');
      }

      // Auto-alert proctor about critical violations
      if (violation.severity === 'critical') {
        addAlert({
          type: 'violation',
          severity: 'critical',
          message: `CRITICAL: ${violation.description}`,
          timestamp: new Date(),
        });
      }
    });

    // Listen for anomalies
    const unsubscribeAnomaly = on('anomaly.detected', (anomaly: any) => {
      addAlert({
        type: 'anomaly',
        severity: anomaly.severity === 'critical' ? 'critical' : 'warning',
        message: anomaly.description,
        timestamp: new Date(),
      });
    });

    // Listen for session state changes
    const unsubscribeStateChange = on('session.state-changed', (data: any) => {
      setSessionStatus(data.newStatus);
    });

    return () => {
      unsubscribeProgress();
      unsubscribeViolation();
      unsubscribeAnomaly();
      unsubscribeStateChange();
    };
  }, [on]);

  /**
   * Add alert to display
   */
  const addAlert = useCallback((alert: any) => {
    const id = Date.now();
    setActiveAlerts((prev) => [...prev, { ...alert, id }]);
    
    // Auto-remove after 10 seconds unless critical
    if (alert.severity !== 'critical') {
      setTimeout(() => {
        setActiveAlerts((prev) => prev.filter((a) => a.id !== id));
      }, 10000);
    }
  }, []);

  /**
   * Send alert to student
   */
  const handleSendAlert = () => {
    if (!alertMessage.trim()) return;

    sendCommand('alert:send', {
      message: alertMessage,
      severity: alertSeverity,
      soundType: alertSeverity === 'critical' ? 'alarm' : 'alert',
    });

    addAlert({
      type: 'sent-alert',
      severity: alertSeverity,
      message: `You sent: ${alertMessage}`,
      timestamp: new Date(),
    });

    setAlertMessage('');
    setAlertSeverity('info');
  };

  /**
   * Suspend exam
   */
  const handleSuspendExam = () => {
    if (!window.confirm('Are you sure you want to suspend this exam?')) return;

    sendCommand('exam:suspend', {
      reason: 'Suspended by proctor due to suspicious activity',
      timestamp: new Date(),
    });

    setSessionStatus('suspended');
    addAlert({
      type: 'action',
      severity: 'critical',
      message: '🔒 Exam suspended',
      timestamp: new Date(),
    });
  };

  /**
   * Resume exam
   */
  const handleResumeExam = () => {
    sendCommand('exam:resume', {
      message: 'Exam resumed. You may continue.',
    });

    setSessionStatus('active');
    addAlert({
      type: 'action',
      severity: 'info',
      message: '▶️ Exam resumed',
      timestamp: new Date(),
    });
  };

  /**
   * End exam early
   */
  const handleEndExamEarly = () => {
    if (!window.confirm('Are you sure you want to end this exam early? All answers will be submitted.')) return;

    sendCommand('exam:end-early', {
      reason: 'Ended by proctor',
      saveProgress: true,
    });

    setSessionStatus('completed');
    addAlert({
      type: 'action',
      severity: 'warning',
      message: '⏹️ Exam ended early',
      timestamp: new Date(),
    });

    setTimeout(() => onSessionEnd(), 2000);
  };

  /**
   * Add remark/note
   */
  const handleAddRemark = (text: string) => {
    const remark = {
      id: Date.now(),
      type: 'observation',
      text,
      timestamp: new Date(),
      flagged: false,
    };

    setRemarks((prev) => [...prev, remark]);

    // Send remark to database
    sendCommand('remark:add', remark);
  };

  /**
   * Calculate status color and icon
   */
  const getStatusColor = (status: typeof sessionStatus) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'paused':
        return 'text-yellow-600 bg-yellow-50';
      case 'suspended':
        return 'text-red-600 bg-red-50';
      case 'completed':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  const getRiskColor = (risk: typeof riskLevel) => {
    switch (risk) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="proctor-panel h-full bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="header border-b border-gray-700 p-4 bg-gray-800">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-2xl font-bold">{studentName}</h1>
            <p className="text-sm text-gray-400">Exam: {examId} | Session: {sessionId}</p>
          </div>
          
          <div className="flex gap-2">
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(sessionStatus)}`}>
              {sessionStatus.toUpperCase()}
            </div>
            
            <div className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 ${getRiskColor(riskLevel)}`}>
              {riskLevel === 'high' ? '🔴' : riskLevel === 'medium' ? '🟡' : '🟢'} Risk: {riskLevel.toUpperCase()}
            </div>

            <div className="px-3 py-1 rounded-full text-sm bg-blue-900 text-blue-200 font-semibold">
              Mode: {proctoringMode.toUpperCase()}
            </div>

            {proctoringMode === 'two-way' && (
              <Button
                onClick={() => setTwoWayEnabled(!twoWayEnabled)}
                className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${
                  twoWayEnabled
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {twoWayEnabled ? '✓ Two-Way Active' : '○ Two-Way Off'}
              </Button>
            )}
          </div>
        </div>

        {/* Exam Progress */}
        <div className="flex items-center gap-4 text-sm">
          <div>Q{examProgress.questionsAnswered}/{examProgress.questionsTotal}</div>
          <div className="flex-1 bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{
                width: `${(examProgress.questionsAnswered / examProgress.questionsTotal) * 100}%`,
              }}
            />
          </div>
          <div className="font-mono">
            {Math.floor(examProgress.timeRemaining / 60)}:
            {String(examProgress.timeRemaining % 60).padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden relative">
        {/* Floating Proctor Camera (Picture-in-Picture) - Top Right */}
        {proctoringMode === 'two-way' && (
          <div className="absolute top-6 right-6 w-56 h-40 bg-gray-800 rounded-lg overflow-hidden border-2 border-blue-500 shadow-xl z-10">
            <div className="h-full relative">
              <video
                ref={proctorVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                onClick={() => {
                  void attachProctorPreview();
                }}
              />
              <div className="absolute top-1 left-1 flex items-center gap-1 bg-black/70 px-2 py-0.5 rounded text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>You</span>
              </div>
              {twoWayError && (
                <div className="absolute bottom-1 left-1 right-1 bg-red-900/70 text-red-100 text-xs px-1 py-0.5 rounded">
                  {twoWayError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Left Panel - Camera & Screen */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Camera Feed */}
          <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            <div className="flex items-center justify-center h-full relative">
              <CameraFeed sessionId={sessionId} />
              <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/50 px-2 py-1 rounded text-xs">
                <Camera className="w-4 h-4" />
                Student Camera {isConnected ? '🔴 Live' : '⚫ Offline'}
              </div>
            </div>
          </div>

          {/* Screen Monitor */}
          <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            <div className="flex items-center justify-center h-full relative">
              <ScreenMonitor sessionId={sessionId} />
              <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/50 px-2 py-1 rounded text-xs">
                <Monitor className="w-4 h-4" />
                Student Screen
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Controls & Violations */}
        <div className="w-96 flex flex-col gap-4 overflow-hidden">
          {/* Control Panel */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Controls
            </h3>
            
            <ControlPanel
              sessionStatus={sessionStatus}
              onSuspend={handleSuspendExam}
              onResume={handleResumeExam}
              onEndEarly={handleEndExamEarly}
              proctoringMode={proctoringMode}
            />
          </div>

          {/* Alert Sender */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="font-bold mb-2">Send Alert</h3>
            <div className="space-y-2">
              <Input
                placeholder="Alert message..."
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-500"
              />
              <div className="flex gap-2">
                <select
                  value={alertSeverity}
                  onChange={(e) => setAlertSeverity(e.target.value as any)}
                  className="flex-1 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-sm"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
                <Button
                  onClick={handleSendAlert}
                  disabled={!alertMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Violation Tracker */}
          <div className="flex-1 min-h-0 bg-gray-800 rounded-lg border border-gray-700 p-4 overflow-y-auto">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Violations ({violationCount})
            </h3>
            <ViolationTracker violations={violations} />
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowRemarksPanel(!showRemarksPanel)}
              variant="outline"
              className="flex-1"
            >
              Notes ({remarks.length})
            </Button>
            
            {proctoringMode === 'two-way' && (
              <Button
                onClick={() => setShowChatPanel(!showChatPanel)}
                variant="outline"
                className="flex-1"
              >
                Chat
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Alerts Panel */}
      {activeAlerts.length > 0 && (
        <div className="border-t border-gray-700 p-3 bg-gray-800 max-h-32 overflow-y-auto space-y-2">
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-2 rounded text-sm flex items-center justify-between ${
                alert.severity === 'critical'
                  ? 'bg-red-900/30 text-red-200 border border-red-700'
                  : alert.severity === 'warning'
                  ? 'bg-yellow-900/30 text-yellow-200 border border-yellow-700'
                  : 'bg-blue-900/30 text-blue-200 border border-blue-700'
              }`}
            >
              <span>{alert.message}</span>
              {alert.severity === 'critical' && (
                <button
                  onClick={() =>
                    setActiveAlerts((prev) => prev.filter((a) => a.id !== alert.id))
                  }
                  className="text-xs hover:text-red-100"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Side Panels */}
      {showRemarksPanel && (
        <RemarksPanel
          remarks={remarks}
          onAddRemark={handleAddRemark}
          onClose={() => setShowRemarksPanel(false)}
        />
      )}

      {showChatPanel && proctoringMode === 'two-way' && (
        <ChatPanel sessionId={sessionId} onClose={() => setShowChatPanel(false)} />
      )}
    </div>
  );
};

export default ProctoringPanel;
