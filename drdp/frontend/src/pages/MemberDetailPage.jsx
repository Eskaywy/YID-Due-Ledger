import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { ArrowLeft, Edit2, Plus, Trash2, Save, X, CreditCard } from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = n => '₦' + Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:2});

function Badge({ status }) {
  return <span className={`badge badge-${status}`}>{status.charAt(0).toUpperCase()+status.slice(1)}</span>;
}

// Inline edit row for monthly dues
function DueRow({ due, userId, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ status: due.status, amount: due.amount, notes: due.notes||'' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await API.put(`/records/dues/${userId}`, { due_month: due.due_month, due_year: due.due_year, ...form });
      onRefresh(); setEditing(false);
    } catch { setSaving(false); }
  };

  if (editing) return (
    <tr style={{background:'var(--green-50)'}}>
      <td style={{fontWeight:500}}>{MONTHS[due.due_month-1]} {due.due_year}</td>
      <td><input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={{width:100,padding:'5px 8px'}}/></td>
      <td>
        <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{width:'auto',padding:'5px 8px'}}>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="arrears">Arrears</option>
        </select>
      </td>
      <td><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes…" style={{padding:'5px 8px'}}/></td>
      <td>
        <div style={{display:'flex',gap:5}}>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}><Save size={12}/></button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setEditing(false)}><X size={12}/></button>
        </div>
      </td>
    </tr>
  );

  return (
    <tr>
      <td style={{fontWeight:500}}>{MONTHS[due.due_month-1]} {due.due_year}</td>
      <td>{fmt(due.amount)}</td>
      <td><Badge status={due.status}/></td>
      <td style={{fontSize:12.5,color:'var(--slate-500)'}}>{due.notes||'—'}</td>
      <td><button className="btn btn-outline btn-sm" onClick={()=>setEditing(true)}><Edit2 size={12}/></button></td>
    </tr>
  );
}

// Add due row
function AddDueRow({ userId, onRefresh, onCancel }) {
  const [form, setForm] = useState({ due_month:'', due_year: new Date().getFullYear(), amount:2000, status:'pending', notes:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.due_month) return;
    setSaving(true);
    try { await API.put(`/records/dues/${userId}`, form); onRefresh(); onCancel(); }
    catch { setSaving(false); }
  };

  return (
    <tr style={{background:'var(--green-50)'}}>
      <td>
        <div style={{display:'flex',gap:5}}>
          <select value={form.due_month} onChange={e=>set('due_month',e.target.value)} style={{width:80,padding:'5px 8px'}}>
            <option value="">Month</option>
            {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <input type="number" value={form.due_year} onChange={e=>set('due_year',e.target.value)} style={{width:72,padding:'5px 8px'}}/>
        </div>
      </td>
      <td><input type="number" value={form.amount} onChange={e=>set('amount',e.target.value)} style={{width:100,padding:'5px 8px'}}/></td>
      <td>
        <select value={form.status} onChange={e=>set('status',e.target.value)} style={{width:'auto',padding:'5px 8px'}}>
          <option value="paid">Paid</option><option value="pending">Pending</option><option value="arrears">Arrears</option>
        </select>
      </td>
      <td><input value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Notes…" style={{padding:'5px 8px'}}/></td>
      <td>
        <div style={{display:'flex',gap:5}}>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}><Save size={12}/></button>
          <button className="btn btn-secondary btn-sm" onClick={onCancel}><X size={12}/></button>
        </div>
      </td>
    </tr>
  );
}

export default function MemberDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]     = useState('dues');
  const [addingDue, setAddingDue] = useState(false);
  const [editingMember, setEditingMember] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [regions, setRegions]   = useState([]);
  const [alert, setAlert] = useState(null);

  const load = async () => {
    try {
      const res = await API.get(`/admin/members/${id}`);
      setData(res.data);
      setEditForm({ full_name: res.data.member.full_name, email: res.data.member.email, position: res.data.member.position||'', region_id: res.data.member.region_id });
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); API.get('/admin/regions').then(r => setRegions(r.data)); }, [id]);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4000); };

  const saveMember = async () => {
    try { await API.put(`/admin/members/${id}`, editForm); setEditingMember(false); load(); showAlert('success','Profile updated.'); }
    catch (err) { showAlert('error', err.response?.data?.error || 'Update failed'); }
  };

  const deletePledge = async (type, pledgeId) => {
    if (!confirm('Delete this pledge record?')) return;
    try {
      await API.delete(`/records/pledges/${type}/${pledgeId}`);
      load(); showAlert('success','Pledge deleted.');
    } catch { showAlert('error','Failed to delete.'); }
  };

  if (loading) return <div className="loading-container"><div className="spinner"/></div>;
  if (!data)   return <div className="alert alert-error">Member not found.</div>;

  const { member, dues, program_pledges, other_pledges } = data;
  const initials = member.full_name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();

  return (
    <div>
      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <button className="btn btn-secondary" style={{marginBottom:18}} onClick={() => navigate('/admin/members')}>
        <ArrowLeft size={14}/> Back to Members
      </button>

      {/* Profile header */}
      <div className="profile-card" style={{marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
          <div>
            <div className="profile-avatar">{initials}</div>
            {editingMember ? (
              <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>
                <input value={editForm.full_name} onChange={e=>setEditForm(f=>({...f,full_name:e.target.value}))} style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',color:'#fff',borderRadius:6,padding:'7px 12px',width:260}}/>
                <input value={editForm.email}     onChange={e=>setEditForm(f=>({...f,email:e.target.value}))}     style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',color:'#fff',borderRadius:6,padding:'7px 12px',width:260}}/>
                <input value={editForm.position}  onChange={e=>setEditForm(f=>({...f,position:e.target.value}))}  style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',color:'#fff',borderRadius:6,padding:'7px 12px',width:260}} placeholder="Position"/>
                <select value={editForm.region_id} onChange={e=>setEditForm(f=>({...f,region_id:e.target.value}))}
                  style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',color:'#fff',borderRadius:6,padding:'7px 12px',width:260}}>
                  {regions.map(r=><option key={r.id} value={r.id} style={{color:'#000'}}>{r.name}</option>)}
                </select>
                <div style={{display:'flex',gap:8,marginTop:4}}>
                  <button className="btn btn-primary btn-sm" onClick={saveMember}><Save size={12}/> Save</button>
                  <button className="btn btn-secondary btn-sm" onClick={()=>setEditingMember(false)}><X size={12}/> Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="profile-name">{member.full_name}</div>
                <div className="profile-id"><CreditCard size={11}/> {member.user_id_code}</div>
                <div className="profile-meta">
                  <div><div className="profile-meta-label">Email</div><div className="profile-meta-value" style={{fontSize:13}}>{member.email}</div></div>
                  <div><div className="profile-meta-label">Position</div><div className="profile-meta-value">{member.position||'—'}</div></div>
                  <div><div className="profile-meta-label">Region</div><div className="profile-meta-value">{member.region_name}</div></div>
                </div>
              </>
            )}
          </div>
          {!editingMember && (
            <button onClick={()=>setEditingMember(true)}
              style={{background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.2)',color:'#fff',borderRadius:7,padding:'7px 14px',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',gap:6}}>
              <Edit2 size={13}/> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Ledger tabs */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Financial Ledger</span>
          <span style={{fontSize:12.5,color:'var(--slate-400)'}}>Managing records for {member.full_name}</span>
        </div>
        <div className="card-body">
          <div className="tabs">
            <button className={`tab ${tab==='dues'?'active':''}`}    onClick={()=>setTab('dues')}>Monthly Dues ({dues.length})</button>
            <button className={`tab ${tab==='program'?'active':''}`} onClick={()=>setTab('program')}>Program Pledges ({program_pledges.length})</button>
            <button className={`tab ${tab==='other'?'active':''}`}   onClick={()=>setTab('other')}>Other Pledges ({other_pledges.length})</button>
          </div>

          {/* Monthly Dues */}
          {tab==='dues' && (
            <>
              <div style={{marginBottom:12,display:'flex',justifyContent:'flex-end'}}>
                <button className="btn btn-primary btn-sm" onClick={()=>setAddingDue(true)} disabled={addingDue}>
                  <Plus size={13}/> Add Due Record
                </button>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Month / Year</th><th>Amount</th><th>Status</th><th>Notes</th><th>Edit</th></tr></thead>
                  <tbody>
                    {addingDue && <AddDueRow userId={id} onRefresh={load} onCancel={()=>setAddingDue(false)}/>}
                    {dues.length===0 && !addingDue && <tr><td colSpan={5} style={{textAlign:'center',padding:32,color:'var(--slate-400)'}}>No dues records yet</td></tr>}
                    {dues.map(d => <DueRow key={d.id} due={d} userId={id} onRefresh={load}/>)}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Program Pledges */}
          {tab==='program' && (
            <>
              <div style={{marginBottom:12,display:'flex',justifyContent:'flex-end'}}>
                <AddPledgeInline type="program" userId={id} onRefresh={load}/>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Program / Event</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                  <tbody>
                    {program_pledges.length===0 && <tr><td colSpan={5} style={{textAlign:'center',padding:32,color:'var(--slate-400)'}}>No program pledges yet</td></tr>}
                    {program_pledges.map(p => (
                      <PledgeRow key={p.id} pledge={p} type="program" userId={id} onRefresh={load}
                        onDelete={()=>deletePledge('program',p.id)} nameField="program_name"/>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Other Pledges */}
          {tab==='other' && (
            <>
              <div style={{marginBottom:12,display:'flex',justifyContent:'flex-end'}}>
                <AddPledgeInline type="other" userId={id} onRefresh={load}/>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Description</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                  <tbody>
                    {other_pledges.length===0 && <tr><td colSpan={5} style={{textAlign:'center',padding:32,color:'var(--slate-400)'}}>No other pledges yet</td></tr>}
                    {other_pledges.map(p => (
                      <PledgeRow key={p.id} pledge={p} type="other" userId={id} onRefresh={load}
                        onDelete={()=>deletePledge('other',p.id)} nameField="description"/>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AddPledgeInline({ type, userId, onRefresh }) {
  const [open, setOpen] = useState(false);
  const isProgram = type === 'program';
  const [form, setForm] = useState({ name:'', amount:0, status:'pending', date:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    setSaving(true);
    try {
      const body = isProgram
        ? { program_name: form.name, pledge_amount: form.amount, status: form.status, pledge_date: form.date }
        : { description: form.name,  pledge_amount: form.amount, status: form.status, pledge_date: form.date };
      await API.post(`/records/pledges/${type}/${userId}`, body);
      onRefresh(); setOpen(false); setForm({name:'',amount:0,status:'pending',date:''});
    } catch { setSaving(false); }
  };

  if (!open) return <button className="btn btn-primary btn-sm" onClick={()=>setOpen(true)}><Plus size={13}/> Add {isProgram?'Program Pledge':'Other Pledge'}</button>;

  return (
    <div style={{background:'var(--green-50)',border:'1px solid var(--green-100)',borderRadius:8,padding:14,marginBottom:12,width:'100%'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 100px auto auto',gap:8,alignItems:'end'}}>
        <div>
          <label className="form-label">{isProgram?'Program Name':'Description'}</label>
          <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder={isProgram?'e.g. Annual Dinner 2025':'e.g. Building Fund'}/>
        </div>
        <div>
          <label className="form-label">Amount (₦)</label>
          <input type="number" value={form.amount} onChange={e=>set('amount',e.target.value)}/>
        </div>
        <div>
          <label className="form-label">Status</label>
          <select value={form.status} onChange={e=>set('status',e.target.value)} style={{width:'auto'}}>
            <option value="paid">Paid</option><option value="pending">Pending</option><option value="arrears">Arrears</option>
          </select>
        </div>
        <div>
          <label className="form-label">Date</label>
          <input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={{width:140}}/>
        </div>
      </div>
      <div style={{display:'flex',gap:7,marginTop:10}}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}><Save size={12}/> Save</button>
        <button className="btn btn-secondary btn-sm" onClick={()=>setOpen(false)}><X size={12}/> Cancel</button>
      </div>
    </div>
  );
}

function PledgeRow({ pledge, type, userId, onRefresh, onDelete, nameField }) {
  const [editing, setEditing] = useState(false);
  const isProgram = type === 'program';
  const [form, setForm] = useState({ name: pledge[nameField], amount: pledge.pledge_amount, status: pledge.status, date: pledge.pledge_date||'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    setSaving(true);
    try {
      const body = isProgram
        ? { program_name: form.name, pledge_amount: form.amount, status: form.status, pledge_date: form.date }
        : { description: form.name,  pledge_amount: form.amount, status: form.status, pledge_date: form.date };
      await API.put(`/records/pledges/${type}/${pledge.id}`, body);
      onRefresh(); setEditing(false);
    } catch { setSaving(false); }
  };

  if (editing) return (
    <tr style={{background:'var(--green-50)'}}>
      <td><input value={form.name} onChange={e=>set('name',e.target.value)} style={{padding:'5px 8px'}}/></td>
      <td><input type="number" value={form.amount} onChange={e=>set('amount',e.target.value)} style={{width:100,padding:'5px 8px'}}/></td>
      <td><select value={form.status} onChange={e=>set('status',e.target.value)} style={{width:'auto',padding:'5px 8px'}}>
        <option value="paid">Paid</option><option value="pending">Pending</option><option value="arrears">Arrears</option>
      </select></td>
      <td><input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={{padding:'5px 8px',width:140}}/></td>
      <td><div style={{display:'flex',gap:5}}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}><Save size={12}/></button>
        <button className="btn btn-secondary btn-sm" onClick={()=>setEditing(false)}><X size={12}/></button>
      </div></td>
    </tr>
  );

  return (
    <tr>
      <td style={{fontWeight:500}}>{pledge[nameField]}</td>
      <td>{'₦'+Number(pledge.pledge_amount||0).toLocaleString('en-NG',{minimumFractionDigits:2})}</td>
      <td><span className={`badge badge-${pledge.status}`}>{pledge.status.charAt(0).toUpperCase()+pledge.status.slice(1)}</span></td>
      <td style={{fontSize:12.5,color:'var(--slate-400)'}}>{pledge.pledge_date ? new Date(pledge.pledge_date).toLocaleDateString('en-NG') : '—'}</td>
      <td><div style={{display:'flex',gap:5}}>
        <button className="btn btn-outline btn-sm" onClick={()=>setEditing(true)}><Edit2 size={12}/></button>
        <button className="btn btn-danger btn-sm" onClick={onDelete}><Trash2 size={12}/></button>
      </div></td>
    </tr>
  );
}
