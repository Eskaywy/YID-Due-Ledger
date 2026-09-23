import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API, { errorMessage } from '../utils/api';
import { Eye, EyeOff, Lock, Shield } from 'lucide-react';

// Forced first-login stop: accounts created by the Super Admin start with a
// temporary password and must set their own before reaching the portal.
// Mirrors the login page's visual grammar (login-page / login-form-box).
export default function ChangePasswordPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Wait for auth bootstrap before deciding to bounce (audit M8) — a refresh
  // on this page used to redirect valid sessions to /login.
  if (authLoading) return <div className="loading-container" role="status" aria-label="Loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.must_change_password) return <Navigate to={user.role === 'super_admin' ? '/admin' : '/my-records'} replace />;

  const handleSubmit = async e => {
    e.preventDefault();
    if (!currentPassword || !newPassword) { setError('Please fill in both password fields.'); return; }
    if (newPassword !== confirm) { setError('New passwords do not match.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError(''); setLoading(true);
    try {
      await API.put('/auth/change-password', { currentPassword, newPassword });
      // Re-fetch clears must_change_password. A refresh failure here is
      // non-fatal — the password DID change, so don't report failure (audit M9).
      try { await refreshUser(); } catch (refreshErr) { console.error('Post-change refresh failed:', refreshErr); }
      navigate(user.role === 'super_admin' ? '/admin' : '/my-records', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Failed to change password. Please try again.'));
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left branding panel — same as the login page */}
      <div className="login-left">
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'auto'}}>
          <div className="logo-icon" style={{width:40,height:40,fontSize:15}}>YD</div>
          <div>
            <div style={{color:'#fff',fontWeight:700,fontSize:16,fontFamily:'Space Grotesk,sans-serif'}}>YID Due Ledger</div>
            <div style={{color:'rgba(255,255,255,.55)',fontSize:11}}>Dues Management Platform</div>
          </div>
        </div>

        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',paddingBottom:36}}>
          <div style={{color:'rgba(255,255,255,.6)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:14}}>
            Account Security
          </div>
          <h1 style={{color:'#fff',fontSize:32,fontFamily:'Space Grotesk,sans-serif',fontWeight:700,lineHeight:1.15,marginBottom:14}}>
            One quick step to protect your records.
          </h1>
          <p style={{color:'rgba(255,255,255,.65)',fontSize:14,lineHeight:1.65,marginBottom:28}}>
            You are signed in with an administrator-issued temporary password. Choose your own password before accessing your dues and pledges.
          </p>
          {['Your temporary password stops working immediately after','Your new password is never stored in plain text','All changes are recorded in the audit log'].map((t,i) => (
            <div key={i} style={{display:'flex',gap:9,color:'rgba(255,255,255,.65)',fontSize:13,marginBottom:10}}>
              <span style={{color:'#4dc47b',fontWeight:700,marginTop:1}}>✓</span>{t}
            </div>
          ))}
        </div>

        <div style={{color:'rgba(255,255,255,.55)',fontSize:11,borderTop:'1px solid rgba(255,255,255,.08)',paddingTop:16}}>
          Lagos & South-West Region Pilot · 2025
        </div>
      </div>

      {/* Right form panel */}
      <div className="login-right">
        <div className="login-form-box">
          <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:7}}>
            <Shield size={18} color="var(--green-600)"/>
            <span style={{fontSize:13,fontWeight:500,color:'var(--green-600)'}}>Secure your account</span>
          </div>
          <h1 className="login-title">Set your own password</h1>
          <p className="login-subtitle">Enter the temporary password you were given, then choose a new one.</p>

          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="cp-current">Temporary Password</label>
              <input id="cp-current" type="password" placeholder="Enter your temporary password"
                value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password" aria-invalid={!!error}/>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cp-new">New Password</label>
              <div style={{position:'relative'}}>
                <input id="cp-new" type={showPass ? 'text':'password'} placeholder="Min. 8 characters"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password" style={{paddingRight:48}}/>
                <button type="button" onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'} aria-pressed={showPass}
                  style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',
                    background:'none',border:'none',color:'var(--slate-400)',cursor:'pointer',padding:'8px'}}>
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cp-confirm">Confirm New Password</label>
              <input id="cp-confirm" type={showPass ? 'text':'password'} placeholder="Repeat new password"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"/>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{width:'100%',marginTop:4}} disabled={loading}
              aria-busy={loading}>
              <Lock size={15}/> {loading ? 'Saving…' : 'Save Password & Continue'}
            </button>
          </form>

          <div style={{marginTop:20,textAlign:'center',fontSize:13,color:'var(--slate-400)'}}>
            Signed in as <strong style={{color:'var(--slate-600)'}}>{user?.full_name}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
