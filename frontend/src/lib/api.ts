import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  if (config.headers && 'Authorization' in config.headers && config.headers.Authorization) {
    return config;
  }

  const desktopToken = localStorage.getItem('desktop-exam-token');
  if (desktopToken) {
    config.headers.Authorization = `Bearer ${desktopToken}`;
    return config;
  }

  const stored = localStorage.getItem('proctora-auth');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    } catch {}
  }
  return config;
});

// Response interceptor: handle 401 without hard reload
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth state on 401 but don't redirect - let the route guard handle it
      const stored = localStorage.getItem('proctora-auth');
      if (stored) {
        localStorage.removeItem('proctora-auth');
        // Emit a custom event so components can react to logout
        window.dispatchEvent(new CustomEvent('auth-logout'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
