/**
 * Desktop Exam utilities for Electron app
 * Handles polling proctoring events and communicating with Electron IPC
 */

interface ProctorEvent {
  type: string;
  timestamp: string;
  data?: any;
}

interface ProctoringResult {
  violations: ProctorEvent[];
  isValid: boolean;
  integrityScore: number;
}

/**
 * Poll desktop proctoring events from Electron main process
 * Used when running in Electron desktop app
 */
export async function pollDesktopProctoringEvents(
  sessionId: string,
  interval: number = 1000
): Promise<ProctoringResult> {
  // Check if running in Electron
  if (typeof (window as any).electronAPI === 'undefined') {
    console.warn('Not running in Electron environment');
    return {
      violations: [],
      isValid: true,
      integrityScore: 100,
    };
  }

  try {
    // Get proctoring session data from Python AI service
    const result = await (window as any).electronAPI.apiCall(
      'GET',
      `/api/proctoring/session/${sessionId}`,
      {}
    );

    if (!result.success) {
      console.error('Failed to fetch proctoring data:', result.error);
      return {
        violations: [],
        isValid: true,
        integrityScore: 100,
      };
    }

    const violations: ProctorEvent[] = result.data.violations || [];
    
    // Calculate integrity score based on violations
    const integrityScore = calculateIntegrityScore(violations);

    return {
      violations,
      isValid: integrityScore > 50, // Exam valid if integrity > 50%
      integrityScore,
    };
  } catch (error) {
    console.error('Error polling proctoring events:', error);
    return {
      violations: [],
      isValid: true,
      integrityScore: 100,
    };
  }
}

/**
 * Start monitoring desktop proctoring in real-time
 * Calls callback whenever a violation is detected
 */
export function startDesktopProctoring(
  sessionId: string,
  onViolation?: (violation: ProctorEvent) => void
): () => void {
  // Not implemented yet - would require WebSocket connection
  // For now, violations are logged server-side
  
  return () => {
    // Cleanup function
  };
}

/**
 * Calculate integrity score based on violations
 * Rules:
 * - face_missing: -5% per incident
 * - multiple_faces: -10% per incident
 * - phone_detected: -15% per incident
 * - tab_switch: -2% per incident
 */
function calculateIntegrityScore(violations: ProctorEvent[]): number {
  let score = 100;

  for (const violation of violations) {
    switch (violation.type) {
      case 'face_missing':
        score -= 5;
        break;
      case 'multiple_faces':
        score -= 10;
        break;
      case 'phone_detected':
        score -= 15;
        break;
      case 'tab_switch':
        score -= 2;
        break;
      default:
        break;
    }
  }

  return Math.max(0, score);
}

/**
 * Log a proctoring event to the backend
 */
export async function logProctoringEvent(
  sessionId: string,
  eventType: string,
  eventData?: any
): Promise<boolean> {
  try {
    const result = await (window as any).electronAPI.apiCall(
      'POST',
      `/api/desktop-exam/proctor-event`,
      {
        session_id: sessionId,
        event_type: eventType,
        event_data: eventData || {},
      }
    );

    return result.success;
  } catch (error) {
    console.error('Failed to log proctoring event:', error);
    return false;
  }
}

/**
 * Get violation summary for a session
 */
export async function getSessionViolations(
  sessionId: string
): Promise<ProctorEvent[]> {
  try {
    const result = await (window as any).electronAPI.apiCall(
      'GET',
      `/api/proctoring/session/${sessionId}`,
      {}
    );

    if (result.success) {
      return result.data.violations || [];
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch violations:', error);
    return [];
  }
}
