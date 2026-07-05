import axios from 'axios';
import { useAuthStore } from '../stores';
import { usePageMetaStore } from '../stores/pageMeta';
import { isImpersonatingSession } from '../utils/authSession';

const SKIP_SAVE_TOAST_URLS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/impersonate'];

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach access token — prefer localStorage, fall back to zustand (rehydration race).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token') || useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    if (!localStorage.getItem('access_token')) {
      localStorage.setItem('access_token', token);
    }
  }
  return config;
});

// On 401, clear token and redirect to login
// On 403 PASSWORD_CHANGE_REQUIRED, redirect to /change-password
api.interceptors.response.use(
  (res) => {
    const method = res.config.method?.toUpperCase();
    const url = res.config.url || '';
    const skipHeader = res.config.headers?.['X-Skip-Save-Toast'];
    if (
      !skipHeader
      && method
      && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      && !SKIP_SAVE_TOAST_URLS.some((p) => url.includes(p))
    ) {
      const data = res.data as { message?: string } | undefined;
      const msg = data?.message
        || (method === 'DELETE' ? 'Deleted successfully.' : 'Saved successfully.');
      usePageMetaStore.getState().setFormMessage(msg);
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
    } else if (
      err.response?.status === 403
      && err.response?.data?.detail === 'PASSWORD_CHANGE_REQUIRED'
      && !isImpersonatingSession(useAuthStore.getState().adminToken)
    ) {
      window.location.href = '/change-password';
    } else if (err.response?.status === 503 && err.response?.data?.code === 'MAINTENANCE_MODE') {
      window.location.href = '/maintenance';
    }
    return Promise.reject(err);
  },
);

export default api;