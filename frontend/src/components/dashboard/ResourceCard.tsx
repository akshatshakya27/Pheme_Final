import React from 'react';
import { Progress } from '@/components/ui/progress';

interface ResourceCardProps {
  title: string;
  used: number;
  total: number;
  unit: string;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ title, used, total, unit }) => {
  const percentage = Math.round((used / total) * 100);
  const colorClass = percentage > 80 ? 'text-destructive' : percentage > 60 ? 'text-warning' : 'text-success';

  return (
    <div className="bg-card rounded-lg p-4 shadow-card">
      <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
      <div className="flex items-end justify-between mb-2">
        <span className="text-lg font-bold text-card-foreground">{used} {unit}</span>
        <span className={`text-sm font-semibold ${colorClass}`}>{percentage}%</span>
      </div>
      <Progress value={percentage} className="h-2" />
      <p className="text-xs text-muted-foreground mt-1.5">of {total} {unit}</p>
    </div>
  );
};

export default ResourceCard;
