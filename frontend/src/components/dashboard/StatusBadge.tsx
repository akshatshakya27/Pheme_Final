import React from 'react';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  suspended: 'bg-destructive/10 text-destructive border-destructive/20',
  inactive: 'bg-muted text-muted-foreground border-border',
  live: 'bg-success/10 text-success border-success/20',
  scheduled: 'bg-info/10 text-info border-info/20',
  completed: 'bg-muted text-muted-foreground border-border',
  draft: 'bg-warning/10 text-warning border-warning/20',
  connected: 'bg-success/10 text-success border-success/20',
  disconnected: 'bg-destructive/10 text-destructive border-destructive/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-success/10 text-success border-success/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <Badge variant="outline" className={`capitalize text-xs font-medium ${statusStyles[status] || ''}`}>
      {status}
    </Badge>
  );
};

export default StatusBadge;
