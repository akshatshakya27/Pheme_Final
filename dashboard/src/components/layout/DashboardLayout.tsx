import React from 'react';
import TopNav from './TopNav';

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="p-6 max-w-[1440px] mx-auto animate-fade-in">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
