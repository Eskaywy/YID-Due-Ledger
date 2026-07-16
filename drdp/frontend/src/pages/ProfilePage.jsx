import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';
import { User, Lock, CreditCard, MapPin, Briefcase, Calendar, Eye, EyeOff, Upload, Trash2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState('profile');

  // Password change state
  const [pwForm, setPwForm] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [showPw, setShowPw]   = useState({ current:false, new:false, confirm:false });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [saving, setSaving]   = useState(false);

  // Picture upload state
  const [picError, setPicError] = useState('');
  const [picSuccess, setPicSuccess] = useState('');
  const [picLoading, setPicLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(user?.profile_picture || '');

  const initials = user?.full_name?.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() || 'U';

  const handlePasswordChange = async e => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError('New passwords do not match.'); return; }
    if (pwForm.newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      await API.put('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwSuccess('Password updated successfully!');
      setPwForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
    } catch (err) {
      setPwError(err.response?.data?.error || 'Failed to update password.');
    } finally { setSaving(false); }
  };

  const handlePictureUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPicError('File size must not exceed 5MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setPicError('Only JPEG, PNG, WebP, and GIF formats are allowed');
      return;
    }

    setPicError(''); setPicSuccess('');
    setPicLoading(true);

    try {
      const formData = new FormData();
      formData.append('picture', file);
      const res = await API.post('/auth/upload-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPicSuccess('Profile picture updated successfully!');
      setPreviewUrl(res.data.profile_picture);
      await refreshUser();
    } catch (err) {
      setPicError(err.response?.data?.error || 'Failed to upload picture');
    } finally { setPicLoading(false); }
  };

  const handleRemovePicture = async () => {
    if (!window.confirm('Remove profile picture?')) return;
    setPicError(''); setPicSuccess('');
    setPicLoading(true);
    try {
      await API.post('/auth/remove-picture');
      setPicSuccess('Profile picture removed');
      setPreviewUrl('');
      await refreshUser();
    } catch (err) {
      setPicError(err.response?.data?.error || 'Failed to remove picture');
    } finally { setPicLoading(false); }
  };

  const InfoRow = ({ icon, label, value }) => (
    <div style={{display:'flex',alignItems:'flex-start',gap:14,padding:'14px 0',borderBottom:'1px solid var(--slate-50)'}}>
      <div style={{width:36,height:36,borderRadius:8,background:'var(--green-100)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--green-600)',flexShrink:0}}>
        {icon}
      </div>
      <div>
        <div style={{fontSize:12,color:'var(--slate-400)',marginBottom:2}}>{label}</div>
        <div style={{fontSize:14.5,fontWeight:500,color:'var(--slate-800)'}}>{value || '—'}</div>
      </div>
    </div>
  );

  const PwInput = ({ field, label, placeholder }) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{position:'relative'}}>
        <input
          type={showPw[field] ? 'text' : 'password'}
          placeholder={placeholder}
          value={pwForm[field]}
          onChange={e => setPwForm(f => ({...f, [field]: e.target.value}))}
          style={{paddingRight:40}}
        />
        <button type="button" onClick={() => setShowPw(s => ({...s, [field]: !s[field]}))}
          style={{position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',
            background:'none',border:'none',color:'var(--slate-400)',cursor:'pointer',padding:2}}>
          {showPw[field] ? <EyeOff size={16}/> : <Eye size={16}/>}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{maxWidth:640}}>
      {/* Profile header */}
      <div className="profile-card" style={{marginBottom:20}}>
        <div className="profile-avatar">
          {previewUrl || user?.profile_picture ? (
            <img src={previewUrl || user?.profile_picture} alt={user?.full_name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          ) : (
            initials
          )}
        </div>
        <div className="profile-name">{user?.full_name}</div>
        <div className="profile-id"><CreditCard size={11}/> {user?.user_id_code}</div>
        <div className="profile-meta">
          <div>
            <div className="profile-meta-label">Role</div>
            <div className="profile-meta-value">{user?.role === 'super_admin' ? 'Super Admin' : 'Member'}</div>
          </div>
          <div>
            <div className="profile-meta-label">Region</div>
            <div className="profile-meta-value">{user?.region_name || '—'}</div>
          </div>
          <div>
            <div className="profile-meta-label">Department</div>
            <div className="profile-meta-value">{user?.dept_code}</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab==='profile'?'active':''}`}  onClick={() => setTab('profile')}>
          <User size={13} style={{verticalAlign:'middle',marginRight:5}}/> Profile Info
        </button>
        <button className={`tab ${tab==='picture'?'active':''}`}  onClick={() => setTab('picture')}>
          <Upload size={13} style={{verticalAlign:'middle',marginRight:5}}/> Profile Picture
        </button>
        <button className={`tab ${tab==='password'?'active':''}`} onClick={() => setTab('password')}>
          <Lock size={13} style={{verticalAlign:'middle',marginRight:5}}/> Change Password
        </button>
      </div>

      {/* Profile info */}
      {tab === 'profile' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Account Details</span></div>
          <div className="card-body" style={{padding:'8px 22px'}}>
            <InfoRow icon={<User size={16}/>}      label="Full Name"   value={user?.full_name} />
            <InfoRow icon={<CreditCard size={16}/>} label="Member ID"   value={user?.user_id_code} />
            <InfoRow icon={<Briefcase size={16}/>}  label="Position"    value={user?.position} />
            <InfoRow icon={<MapPin size={16}/>}      label="Region"      value={user?.region_name} />
            <InfoRow icon={<Lock size={16}/>}        label="Email"       value={user?.email} />
            <InfoRow icon={<Calendar size={16}/>}    label="Member Since" value={user?.created_at ? new Date(user.created_at).toLocaleDateString('en-NG', {year:'numeric',month:'long',day:'numeric'}) : '—'} />
          </div>
          <div style={{padding:'12px 22px',background:'var(--slate-50)',borderTop:'1px solid var(--slate-100)',borderRadius:'0 0 10px 10px'}}>
            <p style={{fontSize:12.5,color:'var(--slate-400)'}}>
              To update your profile details, please contact the Super Administrator.
            </p>
          </div>
        </div>
      )}

      {/* Profile picture */}
      {tab === 'picture' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Profile Picture</span></div>
          <div className="card-body">
            {picError   && <div className="alert alert-error">{picError}</div>}
            {picSuccess && <div className="alert alert-success">{picSuccess}</div>}
            
            {/* Current picture preview */}
            <div style={{textAlign:'center',marginBottom:24}}>
              <div style={{width:120,height:120,borderRadius:12,background:'var(--slate-100)',display:'inline-flex',alignItems:'center',justifyContent:'center',overflow:'hidden',marginBottom:12,border:'2px solid var(--slate-200)'}}>
                {previewUrl || user?.profile_picture ? (
                  <img src={previewUrl || user?.profile_picture} alt="Profile" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                ) : (
                  <User size={40} color="var(--slate-400)"/>
                )}
              </div>
              <p style={{fontSize:13,color:'var(--slate-500)',marginBottom:12}}>Current Profile Picture</p>
              {(previewUrl || user?.profile_picture) && (
                <button type="button" onClick={handleRemovePicture} className="btn btn-outline btn-sm" disabled={picLoading}>
                  <Trash2 size={12}/> Remove Picture
                </button>
              )}
            </div>

            {/* Upload form */}
            <div style={{borderTop:'1px solid var(--slate-100)',paddingTop:20}}>
              <label className="form-label">Choose new picture</label>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handlePictureUpload}
                  disabled={picLoading}
                  style={{padding:10,border:'1px solid var(--slate-200)',borderRadius:6}}
                />
                <p style={{fontSize:12,color:'var(--slate-400)'}}>
                  Supported formats: JPEG, PNG, WebP, GIF · Max size: 5 MB
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change password */}
      {tab === 'password' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Change Password</span></div>
          <div className="card-body">
            {pwError   && <div className="alert alert-error">{pwError}</div>}
            {pwSuccess && <div className="alert alert-success">{pwSuccess}</div>}
            <form onSubmit={handlePasswordChange}>
              <PwInput field="currentPassword" label="Current Password"  placeholder="Enter current password"/>
              <PwInput field="newPassword"     label="New Password"      placeholder="At least 8 characters"/>
              <PwInput field="confirmPassword" label="Confirm New Password" placeholder="Repeat new password"/>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Lock size={14}/> {saving ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
