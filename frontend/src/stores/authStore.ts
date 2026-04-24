import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, User } from '@/types';
import api from '@/lib/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string, role: string) => {
        set({ isLoading: true });
        try {
            const payload = new URLSearchParams();
            payload.append('email', email);
            payload.append('password', password);
            payload.append('role', role);

            const res = await api.post('/login', payload, {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
          const { access_token } = res.data;
          
          // Fetch user profile
          const meRes = await api.get('/me', {
            headers: { Authorization: `Bearer ${access_token}` }
          });
          
          const user: User = {
            id: String(meRes.data.id),
            name: meRes.data.email.split('@')[0],
            email: meRes.data.email,
            role: meRes.data.role,
            institute_id: meRes.data.institute_id ? String(meRes.data.institute_id) : undefined,
          };
          
          set({ user, token: access_token, isAuthenticated: true, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('proctora-auth');
        set({ user: null, token: null, isAuthenticated: false });
        window.dispatchEvent(new Event('auth-logout'));
      },

      setUser: (user: User) => set({ user }),
    }),
    {
      name: 'proctora-auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
