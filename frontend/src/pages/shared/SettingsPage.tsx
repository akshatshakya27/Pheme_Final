import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';

const SettingsPage: React.FC<{ basePath?: string }> = ({ basePath = '/super-admin' }) => {
  return (
    <DashboardLayout>
      <PageHeader title="Settings" subtitle="Platform configuration" breadcrumbs={[{ label: 'Dashboard', path: basePath }, { label: 'Settings' }]} />
      <div className="grid gap-4 max-w-2xl">
        {[
          { title: 'General', desc: 'Platform name, logo, and default settings' },
          { title: 'Security', desc: 'Session timeout, password policies, 2FA settings' },
          { title: 'Notifications', desc: 'Email templates and alert preferences' },
          { title: 'API Configuration', desc: 'API keys and webhook management' },
        ].map((s) => (
          <div key={s.title} className="bg-card rounded-lg p-5 shadow-card hover:shadow-card-hover transition-shadow cursor-pointer">
            <h3 className="font-semibold text-card-foreground">{s.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
