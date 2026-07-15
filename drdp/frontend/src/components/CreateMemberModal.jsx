import React, { useState } from 'react';
import API from '../utils/api';
import { X, UserPlus } from 'lucide-react';

export default function CreateMemberModal({ regions, onClose, onCreated }) {
  const [form, setForm] = useState({ full_name:'', email:'', position:'', region_id:'', dept_code:'MED' });
  const [error, setError]   = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.region_id) { setError('Name, email, and region are required.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await API.post('/admin/members', form);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create member');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3><UserPlus size={17} style={{marginRight:7,verticalAlign:'middle'}}/> Add New Member</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--slate-400)',cursor:'pointer',padding:4}}><X size={18}/></button>
        </div>

        {result ? (
          <div className="modal-body">
            <div className="alert alert-success" style={{marginBottom:16}}>
              Member created successfully!
            </div>
            <div style={{background:'var(--slate-50)',borderRadius:8,padding:16,border:'1px solid var(--slate-100)'}}>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:12,color:'var(--slate-400)',marginBottom:3}}>Member ID</div>
                <div style={{fontFamily:'monospace',fontWeight:700,fontSize:15,color:'var(--green-700)'}}>{result.user_id_code}</div>
              </div>
              <div>
                <div style={{fontSize:12,color:'var(--slate-400)',marginBottom:3}}>Temporary Password</div>
                <div style={{fontFamily:'monospace',fontWeight:600,fontSize:14,color:'var(--slate-800)'}}>{result.temp_password}</div>
              </div>
              <div style={{marginTop:12,fontSize:12.5,color:'var(--slate-500)'}}>
                Share these credentials with the member. They should change their password on first login.
              </div>
            </div>
            <div className="modal-footer" style={{padding:'16px 0 0',borderTop:'none'}}>
              <button className="btn btn-primary" onClick={onCreated}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input value={form.full_name} onChange={e => set('full_name',e.target.value)} placeholder="e.g. Adewale Ogundimu"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input type="email" value={form.email} onChange={e => set('email',e.target.value)} placeholder="email@example.com"/>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Position / Role</label>
                  <input value={form.position} onChange={e => set('position',e.target.value)} placeholder="e.g. Journalist"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Region *</label>
                  <select value={form.region_id} onChange={e => set('region_id',e.target.value)}>
                    <option value="">Select region…</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Department Code</label>
                <select value={form.dept_code} onChange={e => set('dept_code',e.target.value)}>
                  <option value="MED">MED – Media</option>
                  <option value="INF">INF – Information</option>
                </select>
              </div>
              <div style={{fontSize:12.5,color:'var(--slate-400)',marginTop:4}}>
                A unique Member ID will be auto-generated. Default password: <code>Member@2025</code>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <UserPlus size={14}/> {loading ? 'Creating…' : 'Create Member'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
