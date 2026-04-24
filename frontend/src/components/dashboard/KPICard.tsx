import React from 'react';
import { TrendingUp, TrendingDown, Minus, Activity, Building2, Users, GraduationCap, BookOpen, AlertTriangle, BarChart3, Clock, FileText, UserCheck, Monitor, type LucideIcon } from 'lucide-react';
import { KPIData } from '@/types';

const iconRegistry: Record<string, LucideIcon> = {
  Activity, Building2, Users, GraduationCap, BookOpen, AlertTriangle, BarChart3, Clock, FileText, UserCheck, Monitor, TrendingUp,
};

const colorMap: Record<number, string> = {
  1: 'bg-kpi-1/10 text-kpi-1',
  2: 'bg-kpi-2/10 text-kpi-2',
  3: 'bg-kpi-3/10 text-kpi-3',
  4: 'bg-kpi-4/10 text-kpi-4',
  5: 'bg-kpi-5/10 text-kpi-5',
  6: 'bg-kpi-6/10 text-kpi-6',
};

const iconColorMap: Record<number, string> = {
  1: 'text-kpi-1',
  2: 'text-kpi-2',
  3: 'text-kpi-3',
  4: 'text-kpi-4',
  5: 'text-kpi-5',
  6: 'text-kpi-6',
};

interface KPICardProps {
  data: KPIData;
  onClick?: () => void;
}

const KPICard: React.FC<KPICardProps> = ({ data, onClick }) => {
  const IconComponent = iconRegistry[data.icon] || Activity;

  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-lg p-5 shadow-card hover:shadow-card-hover transition-all duration-200 ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{data.title}</p>
          <p className="text-2xl font-bold text-card-foreground">{data.value}</p>
          {data.change && (
            <div className="flex items-center gap-1 text-xs">
              {data.changeType === 'positive' && <TrendingUp className="h-3 w-3 text-success" />}
              {data.changeType === 'negative' && <TrendingDown className="h-3 w-3 text-destructive" />}
              {data.changeType === 'neutral' && <Minus className="h-3 w-3 text-muted-foreground" />}
              <span className={
                data.changeType === 'positive' ? 'text-success' :
                data.changeType === 'negative' ? 'text-destructive' :
                'text-muted-foreground'
              }>
                {data.change}
              </span>
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${colorMap[data.colorIndex]}`}>
          <IconComponent className={`h-5 w-5 ${iconColorMap[data.colorIndex]}`} />
        </div>
      </div>
    </div>
  );
};

export default KPICard;
