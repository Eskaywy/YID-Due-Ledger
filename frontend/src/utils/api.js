import axios from 'axios';

// In production (built by Vite), the API is served from the same origin
// via Vercel routing (/api → serverless function).
// In development, proxy to the local backend on port 3000.
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api'),
  timeout: 15000,
});

// Auth endpoints where a 401 is a normal, showable error (bad credentials /
// wrong current password) rather than an expired session. Treating these as
// "session expired" used to wipe the error and force-reload the page (audit C1/C2).
const AUTH_ERROR_PATHS = ['/auth/login', '/auth/signup', '/auth/change-password'];

API.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status;
    const url = err.config?.url || '';
    const isAuthFlow = AUTH_ERROR_PATHS.some(p => url.includes(p));
    if (status === 401 && !isAuthFlow) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Notify the app (SessionWatcher in App.jsx) so React Router navigates
      // to /login?session=expired WITHOUT a full page reload — preserving
      // state and letting LoginPage surface a friendly message.
      window.dispatchEvent(new Event('auth:session-expired'));
    }
    return Promise.reject(err);
  }
);

// Normalize axios failures into user-friendly copy. Handles timeouts
// (ECONNABORTED), offline/network failures, and backend { error } payloads.
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err?.response) {
    if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')) {
      return 'The request timed out. Check your connection and try again.';
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'You appear to be offline. Check your connection and try again.';
    }
    return 'Network error. Check your connection and try again.';
  }
  return err.response.data?.error || fallback;
}

export default API;
