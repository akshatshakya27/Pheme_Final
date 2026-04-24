/**
 * Violation Tracker Component
 * Displays detected violations and anomalies
 */

import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface ViolationTrackerProps {
  violations: any[];
}

export const ViolationTracker: React.FC<ViolationTrackerProps> = ({ violations }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-900/30 border-red-700 text-red-200';
      case 'major':
        return 'bg-yellow-900/30 border-yellow-700 text-yellow-200';
      case 'minor':
        return 'bg-blue-900/30 border-blue-700 text-blue-200';
      default:
        return 'bg-gray-700 border-gray-600 text-gray-200';
    }
  };

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'face-not-visible':
        return '👤';
      case 'multiple-faces-detected':
        return '👥';
      case 'multiple-windows-open':
        return '🪟';
      case 'copy-paste-detected':
        return '📋';
      case 'external-resource-access':
        return '🌐';
      case 'phone-detected':
        return '📱';
      case 'suspicious-audio':
        return '🔊';
      case 'help-suspected':
        return '💬';
      default:
        return '⚠️';
    }
  };

  if (violations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
        <p className="text-sm">No violations detected</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {violations.map((violation, idx) => (
        <div
          key={idx}
          className={`p-3 rounded border ${getSeverityColor(violation.severity)} text-sm`}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg flex-shrink-0">{getViolationIcon(violation.type)}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold capitalize">
                {violation.type.replace(/-/g, ' ')}
              </div>
              <div className="text-xs opacity-90 mt-1">{violation.description}</div>
              <div className="text-xs opacity-75 mt-1">
                {new Date(violation.timestamp).toLocaleTimeString()}
              </div>
              {violation.severity === 'critical' && (
                <div className="text-xs mt-2 font-semibold">
                  ⚡ AUTO-SUSPENDED
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
