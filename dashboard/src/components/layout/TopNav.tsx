import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Bell, LogOut, Settings, User, Shield } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/types';

const roleNavItems: Record<UserRole, { label: string; path: string }[]> = {
  super_admin: [
    { label: 'Dashboard', path: '/super-admin' },
    { label: 'Institutes', path: '/super-admin/institutes' },
    { label: 'Analytics', path: '/super-admin/analytics' },
    { label: 'Settings', path: '/super-admin/settings' },
  ],
  institute_admin: [
    { label: 'Dashboard', path: '/institute' },
    { label: 'Faculties', path: '/institute/faculties' },
    { label: 'Students', path: '/institute/students' },
    { label: 'Batches', path: '/institute/batches' },
    { label: 'Exams', path: '/institute/exams' },
    { label: 'Reports', path: '/institute/reports' },
    { label: 'Settings', path: '/institute/settings' },
  ],
  faculty: [
    { label: 'Dashboard', path: '/faculty' },
    { label: 'Create Exam', path: '/faculty/create-exam' },
    { label: 'My Exams', path: '/faculty/exams' },
    { label: 'Proctoring', path: '/faculty/proctoring' },
    { label: 'Results', path: '/faculty/results' },
    { label: 'Settings', path: '/faculty/settings' },
  ],
  student: [
    { label: 'Dashboard', path: '/student' },
    { label: 'Exams', path: '/student/exams' },
    { label: 'Results', path: '/student/results' },
    { label: 'Profile', path: '/student/profile' },
  ],
};

const TopNav: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const navItems = roleNavItems[user.role];
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full bg-topbar text-topbar-foreground shadow-md">
      <div className="flex h-14 items-center px-6 gap-8">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight shrink-0">
          <Shield className="h-5 w-5 text-accent" />
          <span>ProctorX</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 flex-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/20 text-accent'
                    : 'text-topbar-muted hover:text-topbar-foreground hover:bg-topbar-foreground/5'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 ml-auto">
          <button className="relative p-2 rounded-md text-topbar-muted hover:text-topbar-foreground transition-colors">
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1 rounded-md hover:bg-topbar-foreground/5 transition-colors">
                <div className="h-8 w-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold">
                  {initials}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem><User className="h-4 w-4 mr-2" />Profile Settings</DropdownMenuItem>
              <DropdownMenuItem><Settings className="h-4 w-4 mr-2" />Change Password</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { logout(); navigate('/login'); }} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default TopNav;
