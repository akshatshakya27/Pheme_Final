import React from 'react';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, children, action }) => {
  return (
    <div className="bg-card rounded-lg p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
};

export default ChartCard;
