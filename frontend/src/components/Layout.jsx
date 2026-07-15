import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Upload, ClipboardList, LogOut, FileText, User, Menu, X, ShieldCheck } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen] = useState(false);

  const isAdmin = user?.role === 'super_admin';
  const initials = user?.full_name?.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() || 'U';

  const go = path => { navigate(path); setOpen(false); };
  const at  = path => location.pathname === path || location.pathname.startsWith(path + '/');

  const pageTitles = {
    '/my-records': 'My Records',
    '/profile':    'My Profile',
    '/admin':      'Admin Dashboard',
  };
  const title = pageTitles[location.pathname]
    || (location.pathname.startsWith('/admin/members/') ? 'Member Detail'
    : location.pathname === '/admin/members'   ? 'Members'
    : location.pathname === '/admin/batch-upload' ? 'Batch Upload'
    : location.pathname === '/admin/audit-logs'   ? 'Audit Logs'
    : '');

  return (
    <div className="app-layout">
      {open && <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:99}} onClick={() => setOpen(false)} />}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-row">
            <div className="logo-icon">YD</div>
            <div><div className="logo-text">YID Due Ledger</div><div className="logo-sub">Dues Management</div></div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">My Account</div>
          <button className={`nav-item ${at('/my-records') ? 'active':''}`} onClick={() => go('/my-records')}>
            <FileText size={15}/> My Records
          </button>
          <button className={`nav-item ${at('/profile') ? 'active':''}`} onClick={() => go('/profile')}>
            <User size={15}/> Profile
          </button>

          {isAdmin && <>
            <div className="nav-section-label" style={{marginTop:6}}>Administration</div>
            <button className={`nav-item ${location.pathname==='/admin' ? 'active':''}`} onClick={() => go('/admin')}>
              <LayoutDashboard size={15}/> Dashboard
            </button>
            <button className={`nav-item ${at('/admin/members') ? 'active':''}`} onClick={() => go('/admin/members')}>
              <Users size={15}/> Members
            </button>
            <button className={`nav-item ${at('/admin/batch-upload') ? 'active':''}`} onClick={() => go('/admin/batch-upload')}>
              <Upload size={15}/> Batch Upload
            </button>
            <button className={`nav-item ${at('/admin/audit-logs') ? 'active':''}`} onClick={() => go('/admin/audit-logs')}>
              <ClipboardList size={15}/> Audit Logs
            </button>
          </>}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{initials}</div>
            <div style={{flex:1,minWidth:0}}>
              <div className="user-name">{user?.full_name}</div>
              <div className="user-role">{isAdmin ? 'Super Admin' : 'Member'}</div>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }}
              style={{background:'none',border:'none',color:'rgba(255,255,255,.35)',cursor:'pointer',padding:'3px'}} title="Log out">
              <LogOut size={14}/>
            </button>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button className="hamburger" onClick={() => setOpen(!open)}>
              {open ? <X size={21}/> : <Menu size={21}/>}
            </button>
            <div className="topbar-title">
              <h2>{title}</h2>
              <p>{user?.region_name} Region{isAdmin ? ' · Full Access' : ''}</p>
            </div>
          </div>
          <div className="topbar-actions">
            {isAdmin && <span className="badge badge-super"><ShieldCheck size={11}/> Super Admin</span>}
            <span style={{fontSize:12,color:'var(--slate-400)',fontFamily:'monospace'}}>{user?.user_id_code}</span>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}
