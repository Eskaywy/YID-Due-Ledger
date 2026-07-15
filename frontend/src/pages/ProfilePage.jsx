import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';
import { CreditCard, Lock, CheckCircle } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const [pwForm, setPwForm] = useState({ currentPassword:'', newPassword:'', confirm:'' });
  const [pwError, setPwError]   = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const set = (k,v) => setPwForm(f=>({...f,[k]:v}));

  const handlePasswordChange = async e => {
    e.preventDefault(); setPwError(''); setPwSuccess('');
    if (pwForm.newPassword !== pwForm.confirm) { setPwError('New passwords do not match.'); return; }
    if (pwForm.newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    setPwLoading(true);
    try {
      await API.put('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwSuccess('Password changed successfully.');
      setPwForm({ currentPassword:'', newPassword:'', confirm:'' });
    } catch (err) { setPwError(err.response?.data?.error || 'Failed to change password.'); }
    finally { setPwLoading(false); }
  };

  const initials = user?.full_name?.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() || 'U';

  return (
    <div style={{maxWidth:640}}>
      <div className="profile-card" style={{marginBottom:24}}>
        <div className="profile-avatar">{initials}</div>
        <div className="profile-name">{user?.full_name}</div>
        <div className="profile-id"><CreditCard size={11}/> {user?.user_id_code}</div>
        <div className="profile-meta">
          <div><div className="profile-meta-label">Email</div><div className="profile-meta-value" style={{fontSize:13}}>{user?.email}</div></div>
          <div><div className="profile-meta-label">Position</div><div className="profile-meta-value">{user?.position||'—'}</div></div>
          <div><div className="profile-meta-label">Region</div><div className="profile-meta-value">{user?.region_name||'—'}</div></div>
          <div><div className="profile-meta-label">Role</div><div className="profile-meta-value">{user?.role==='super_admin'?'Super Admin':'Member'}</div></div>
          <div><div className="profile-meta-label">Department</div><div className="profile-meta-value">{user?.dept_code}</div></div>
          <div><div className="profile-meta-label">Member Since</div><div className="profile-meta-value" style={{fontSize:12.5}}>{user?.created_at?new Date(user.created_at).toLocaleDateString('en-NG'):'—'}</div></div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title"><Lock size={15} style={{verticalAlign:'middle',marginRight:7}}/>Change Password</span></div>
        <div className="card-body">
          {pwError   && <div className="alert alert-error">{pwError}</div>}
          {pwSuccess && <div className="alert alert-success"><CheckCircle size={14}/> {pwSuccess}</div>}
          <form onSubmit={handlePasswordChange}>
            <div className="form-group"><label className="form-label">Current Password</label><input type="password" value={pwForm.currentPassword} onChange={e=>set('currentPassword',e.target.value)} placeholder="Your current password"/></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">New Password</label><input type="password" value={pwForm.newPassword} onChange={e=>set('newPassword',e.target.value)} placeholder="Min. 8 characters"/></div>
              <div className="form-group"><label className="form-label">Confirm New Password</label><input type="password" value={pwForm.confirm} onChange={e=>set('confirm',e.target.value)} placeholder="Repeat new password"/></div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={pwLoading}><Lock size={14}/> {pwLoading?'Saving…':'Update Password'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
