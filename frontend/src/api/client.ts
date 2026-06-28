import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach access token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear token and redirect to login
// On 403 PASSWORD_CHANGE_REQUIRED, redirect to /change-password
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
    } else if (err.response?.status === 403 && err.response?.data?.detail === 'PASSWORD_CHANGE_REQUIRED') {
      window.location.href = '/change-password';
    } else if (err.response?.status === 503 && err.response?.data?.code === 'MAINTENANCE_MODE') {
      window.location.href = '/maintenance';
    }
    return Promise.reject(err);
  },
);

export default api;