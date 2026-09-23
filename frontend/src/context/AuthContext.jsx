import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '../utils/api';

const AuthContext = createContext(null);

// Hydrate from cache so a slow/failed /auth/me doesn't bounce a valid session
// to the login page (audit H1/M8).
const readCachedUser = () => {
  try {
    const cached = localStorage.getItem('user');
    return cached ? JSON.parse(cached) : null;
  } catch { return null; }
};

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(readCachedUser);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      API.get('/auth/me')
        .then(r => { setUser(r.data); localStorage.setItem('user', JSON.stringify(r.data)); })
        .catch(err => {
          const is401 = err.response?.status === 401;
          if (is401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            setSessionExpired(true);
          } else {
            // Non-auth failure (network/5xx): keep the cached user so the app
            // stays usable; page-level handlers show their own error banners.
            console.error('Auth me error:', err);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Called by App's SessionWatcher when the API interceptor detects a 401 on
  // an authenticated endpoint — clears the session without a full reload.
  const expireSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setSessionExpired(true);
  };

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    setSessionExpired(false);
    return res.data.user;
  };

  const signup = async (full_name, email, password, position, region_id, dept_code) => {
    const res = await API.post('/auth/signup', { full_name, email, password, position, region_id, dept_code });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    setSessionExpired(false);
    return res.data.user;
  };

  const logout = () => { localStorage.clear(); setUser(null); setSessionExpired(false); };

  const refreshUser = async () => {
    const res = await API.get('/auth/me');
    setUser(res.data);
    localStorage.setItem('user', JSON.stringify(res.data));
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, sessionExpired, login, signup, logout, refreshUser, expireSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
