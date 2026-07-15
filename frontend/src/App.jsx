import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout          from './components/Layout';
import LoginPage       from './pages/LoginPage';
import SignupPage      from './pages/SignupPage';
import MemberDashboard from './pages/MemberDashboard';
import AdminDashboard  from './pages/AdminDashboard';
import MembersPage     from './pages/MembersPage';
import MemberDetailPage from './pages/MemberDetailPage';
import BatchUploadPage from './pages/BatchUploadPage';
import AuditLogsPage   from './pages/AuditLogsPage';
import ProfilePage     from './pages/ProfilePage';

function Guard({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!user)   return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'super_admin') return <Navigate to="/my-records" replace />;
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'super_admin' ? '/admin' : '/my-records'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
