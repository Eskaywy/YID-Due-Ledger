import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary     from './components/ErrorBoundary';
import Layout            from './components/Layout';
import LoginPage         from './pages/LoginPage';
import SignupPage        from './pages/SignupPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import NotFoundPage      from './pages/NotFoundPage';
import MemberDashboard   from './pages/MemberDashboard';
import AdminDashboard    from './pages/AdminDashboard';
import MembersPage       from './pages/MembersPage';
import MemberDetailPage  from './pages/MemberDetailPage';
import BatchUploadPage   from './pages/BatchUploadPage';
import AuditLogsPage     from './pages/AuditLogsPage';
import ProfilePage       from './pages/ProfilePage';

function Guard({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-container" role="status" aria-label="Loading"><div className="spinner" /></div>;
  if (!user)   return <Navigate to="/login" replace />;
  // Accounts still carrying an admin-issued temp password must change it first.
  if (user.must_change_password) return <Navigate to="/change-password" replace />;
  if (adminOnly && user.role !== 'super_admin') return <Navigate to="/my-records" replace />;
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'super_admin' ? '/admin' : '/my-records'} replace />;
}

// Listens for the API interceptor's 401 signal and navigates to the login
// page in-app (no full page reload), preserving state and carrying the
// ?session=expired flag that LoginPage surfaces as a friendly notice.
function SessionWatcher() {
  const { expireSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onExpired = () => {
      expireSession();
      if (!location.pathname.startsWith('/login')) {
        navigate('/login?session=expired', { replace: true });
      }
    };
    window.addEventListener('auth:session-expired', onExpired);
    return () => window.removeEventListener('auth:session-expired', onExpired);
  }, [expireSession, navigate, location.pathname]);

  return null;
}

// Global offline notice (audit M1) — pairs with errorMessage()'s offline copy.
function ConnectivityWatcher() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);

  useEffect(() => {
    const onOnline  = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="alert" style={{ position:'fixed', bottom:18, left:'50%', transform:'translateX(-50%)', zIndex:2000,
      background:'var(--red-500)', color:'#fff', padding:'10px 18px', borderRadius:999,
      fontSize:13.5, fontWeight:600, boxShadow:'var(--shadow-lg)' }}>
      You are offline — actions may fail until your connection returns.
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <SessionWatcher />
          <ConnectivityWatcher />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/" element={<Guard><Layout /></Guard>}>
              <Route index element={<HomeRedirect />} />
              <Route path="my-records"           element={<Guard><MemberDashboard /></Guard>} />
              <Route path="profile"              element={<Guard><ProfilePage /></Guard>} />
              <Route path="admin"                element={<Guard adminOnly><AdminDashboard /></Guard>} />
              <Route path="admin/members"        element={<Guard adminOnly><MembersPage /></Guard>} />
              <Route path="admin/members/:id"    element={<Guard adminOnly><MemberDetailPage /></Guard>} />
              <Route path="admin/batch-upload"   element={<Guard adminOnly><BatchUploadPage /></Guard>} />
              <Route path="admin/audit-logs"     element={<Guard adminOnly><AuditLogsPage /></Guard>} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
