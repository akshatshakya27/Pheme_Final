import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User } from '@/types';
import { clearAccessToken, getMe, loginRequest, setAccessToken } from '@/lib/backendApi';

const USER_STORAGE_KEY = 'proctorx_user_profile';

const getStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
};

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, portal: 'student' | 'institute' | 'dev') => Promise<User>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());

  useEffect(() => {
    const hydrateUser = async () => {
      try {
        const me = await getMe();
        setUser(me);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me));
      } catch {
        clearAccessToken();
        setUser(null);
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    };
    hydrateUser();
  }, []);

  const login = useCallback(async (email: string, password: string, portal: 'student' | 'institute' | 'dev') => {
    const token = await loginRequest(email, password, portal);
    setAccessToken(token.access_token);
    const me = await getMe();
    setUser(me);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me));
    return me;
  }, []);

  const logout = useCallback(() => {
    clearAccessToken();
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
