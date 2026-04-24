/**
 * useProctoringWebSocket Hook
 * Manages WebSocket connection to backend for proctoring events
 */

import { useEffect, useRef, useCallback, useState } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
  sessionId: string;
  timestamp: number;
}

export const useProctoringWebSocket = (sessionId: string) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Map<string, Set<Function>>>(new Map());

  /**
   * Initialize WebSocket connection
   */
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const token = localStorage.getItem('proctorx_access_token');
        if (!token) {
          console.warn('[Proctoring] Missing auth token for WebSocket');
          return;
        }

        const apiBase = (
          ((import.meta.env.VITE_API_BASE_URL as string | undefined)
          || (import.meta.env.VITE_API_URL as string | undefined))?.replace(/\/$/, '')
          || '/api'
        );
        const sessionPath = `/proctoring/ws/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}&role=proctor`;
        const wsUrl = apiBase.startsWith('http://') || apiBase.startsWith('https://')
          ? `${apiBase.replace(/^http/, 'ws')}${sessionPath}`
          : `${protocol}://${window.location.host}${apiBase.startsWith('/') ? apiBase : `/${apiBase}`}${sessionPath}`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[Proctoring] WebSocket connected');
          setIsConnected(true);

          // Backend WS endpoint handles auth via query params.
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);

            // Emit to registered listeners
            const listeners = listenersRef.current.get(message.type);
            if (listeners) {
              listeners.forEach((listener) => listener(message.data));
            }
          } catch (err) {
            console.error('[Proctoring] Failed to parse message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('[Proctoring] WebSocket error:', error);
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('[Proctoring] WebSocket disconnected');
          setIsConnected(false);

          // Auto-reconnect after 3 seconds
          setTimeout(() => {
            connectWebSocket();
          }, 3000);
        };

        wsRef.current = ws;
      } catch (err) {
        console.error('[Proctoring] Failed to connect WebSocket:', err);
        setIsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sessionId]);

  /**
   * Register event listener
   */
  const on = useCallback(
    (eventType: string, callback: Function) => {
      if (!listenersRef.current.has(eventType)) {
        listenersRef.current.set(eventType, new Set());
      }

      listenersRef.current.get(eventType)!.add(callback);

      // Return unsubscribe function
      return () => {
        listenersRef.current.get(eventType)?.delete(callback);
      };
    },
    []
  );

  /**
   * Send command to EXE via backend
   */
  const sendCommand = useCallback(
    (commandType: string, data: any) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn('[Proctoring] WebSocket not connected');
        return;
      }

      wsRef.current.send(
        JSON.stringify({
          type: 'command',
          command: commandType,
          sessionId,
          data,
          timestamp: Date.now(),
        })
      );
    },
    [sessionId]
  );

  /**
   * Send REST API request (for non-real-time operations)
   */
  const sendRequest = useCallback(
    async (
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      endpoint: string,
      body?: any
    ) => {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_API_SERVER}${endpoint}`,
          {
            method,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('authToken')}`,
            },
            body: body ? JSON.stringify(body) : undefined,
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
      } catch (err) {
        console.error('[Proctoring] API request failed:', err);
        throw err;
      }
    },
    []
  );

  return {
    ws: wsRef.current,
    isConnected,
    on,
    sendCommand,
    sendRequest,
  };
};
