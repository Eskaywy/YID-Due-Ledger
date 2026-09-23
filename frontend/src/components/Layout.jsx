import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Upload, ClipboardList, LogOut, FileText, User, Menu, X, ShieldCheck } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen] = useState(false);

  // Escape closes the mobile drawer (audit M5 keyboard handling).
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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

      <aside id="app-sidebar" aria-label="Navigation sidebar" className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-row">
            <div className="logo-icon">YD</div>
            <div><div className="logo-text">YID Due Ledger</div><div className="logo-sub">Dues Management</div></div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <div className="nav-section-label">My Account</div>
          <button className={`nav-item ${at('/my-records') ? 'active':''}`} onClick={() => go('/my-records')}
            aria-current={at('/my-records') ? 'page' : undefined}>
            <FileText size={15}/> My Records
          </button>
          <button className={`nav-item ${at('/profile') ? 'active':''}`} onClick={() => go('/profile')}
            aria-current={at('/profile') ? 'page' : undefined}>
            <User size={15}/> Profile
          </button>

          {isAdmin && <>
            <div className="nav-section-label" style={{marginTop:6}}>Administration</div>
            <button className={`nav-item ${location.pathname==='/admin' ? 'active':''}`} onClick={() => go('/admin')}
              aria-current={location.pathname==='/admin' ? 'page' : undefined}>
              <LayoutDashboard size={15}/> Dashboard
            </button>
            <button className={`nav-item ${at('/admin/members') ? 'active':''}`} onClick={() => go('/admin/members')}
              aria-current={at('/admin/members') ? 'page' : undefined}>
              <Users size={15}/> Members
            </button>
            <button className={`nav-item ${at('/admin/batch-upload') ? 'active':''}`} onClick={() => go('/admin/batch-upload')}
              aria-current={at('/admin/batch-upload') ? 'page' : undefined}>
              <Upload size={15}/> Batch Upload
            </button>
            <button className={`nav-item ${at('/admin/audit-logs') ? 'active':''}`} onClick={() => go('/admin/audit-logs')}
              aria-current={at('/admin/audit-logs') ? 'page' : undefined}>
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
            <button onClick={() => { logout(); navigate('/login'); }} aria-label="Log out"
              style={{background:'none',border:'none',color:'rgba(255,255,255,.6)',cursor:'pointer',padding:'8px'}} title="Log out">
              <LogOut size={14}/>
            </button>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button className="hamburger" onClick={() => setOpen(!open)}
              aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={open} aria-controls="app-sidebar">
              {open ? <X size={21}/> : <Menu size={21}/>}
            </button>
            <div className="topbar-title">
              <h1>{title}</h1>
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
