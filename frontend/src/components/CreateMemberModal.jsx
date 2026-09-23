import React, { useState, useEffect, useRef } from 'react';
import API, { errorMessage } from '../utils/api';
import { X, UserPlus } from 'lucide-react';

export default function CreateMemberModal({ regions, onClose, onCreated }) {
  const [form, setForm] = useState({ full_name:'', email:'', position:'', region_id:'', dept_code:'MED' });
  const [error, setError]   = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Modal keyboard support (audit M5): Escape closes, focus moves into the
  // dialog on open and returns to the trigger on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    modalRef.current?.querySelector('input')?.focus();
    const onKey = e => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.region_id) { setError('Name, email, and region are required.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await API.post('/admin/members', form);
      setResult(res.data);
    } catch (err) {
      setError(errorMessage(err, 'Failed to create member'));
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-member-title" ref={modalRef}>
        <div className="modal-header">
          <h3 id="create-member-title"><UserPlus size={17} style={{marginRight:7,verticalAlign:'middle'}}/> Add New Member</h3>
          <button onClick={onClose} aria-label="Close dialog" style={{background:'none',border:'none',color:'var(--slate-400)',cursor:'pointer',padding:'8px'}}><X size={18}/></button>
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
              {error && <div className="alert alert-error" role="alert">{error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="cm-name">Full Name *</label>
                  <input id="cm-name" value={form.full_name} onChange={e => set('full_name',e.target.value)} placeholder="e.g. Adewale Ogundimu"/>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="cm-email">Email Address *</label>
                  <input id="cm-email" type="email" value={form.email} onChange={e => set('email',e.target.value)} placeholder="email@example.com"/>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="cm-position">Position / Role</label>
                  <input id="cm-position" value={form.position} onChange={e => set('position',e.target.value)} placeholder="e.g. Journalist"/>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="cm-region">Region *</label>
                  <select id="cm-region" value={form.region_id} onChange={e => set('region_id',e.target.value)}>
                    <option value="">Select region…</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cm-dept">Department Code</label>
                <select id="cm-dept" value={form.dept_code} onChange={e => set('dept_code',e.target.value)}>
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
