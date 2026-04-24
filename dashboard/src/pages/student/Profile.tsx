import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/dashboard/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const StudentProfilePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <PageHeader title="Profile" subtitle="Manage your account" breadcrumbs={[{ label: 'Dashboard', path: '/student' }, { label: 'Profile' }]} />
      <div className="bg-card rounded-lg p-6 shadow-card max-w-lg space-y-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-16 w-16 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xl font-bold">
            {user?.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <p className="font-semibold text-lg">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div><label className="text-sm font-medium">Full Name</label><Input defaultValue={user?.name} /></div>
          <div><label className="text-sm font-medium">Email</label><Input defaultValue={user?.email} disabled /></div>
          <div><label className="text-sm font-medium">Institute</label><Input defaultValue={user?.instituteName || ''} disabled /></div>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">Save Changes</Button>
      </div>
    </DashboardLayout>
  );
};

export default StudentProfilePage;
