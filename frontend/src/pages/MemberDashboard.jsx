import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';
import { AlertCircle, CheckCircle, Clock, TrendingDown, CreditCard, Star, BookOpen } from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = n => '₦' + Number(n||0).toLocaleString('en-NG', { minimumFractionDigits: 2 });

function Badge({ status }) {
  return <span className={`badge badge-${status}`}>{status.charAt(0).toUpperCase()+status.slice(1)}</span>;
}

export default function MemberDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('dues');
  const [dues, setDues]   = useState([]);
  const [prog, setProg]   = useState([]);
  const [other, setOther] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      API.get('/members/my/dues'),
      API.get('/members/my/pledges/program'),
      API.get('/members/my/pledges/other'),
      API.get('/members/my/summary'),
    ]).then(([d,p,o,s]) => {
      setDues(d.data); setProg(p.data); setOther(o.data); setSummary(s.data);
    }).finally(() => setLoading(false));
  }, []);

  const initials = user?.full_name?.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() || 'U';

  if (loading) return <div className="loading-container"><div className="spinner"/></div>;

  return (
    <div>
      {/* Profile card */}
      <div className="profile-card">
        <div className="profile-avatar">{initials}</div>
        <div className="profile-name">{user?.full_name}</div>
        <div className="profile-id"><CreditCard size={11}/> {user?.user_id_code}</div>
        <div className="profile-meta">
          <div><div className="profile-meta-label">Position</div><div className="profile-meta-value">{user?.position || '—'}</div></div>
          <div><div className="profile-meta-label">Region</div><div className="profile-meta-value">{user?.region_name || '—'}</div></div>
          <div><div className="profile-meta-label">Department</div><div className="profile-meta-value">{user?.dept_code}</div></div>
        </div>
      </div>

      {/* Outstanding balance banner */}
      {summary?.total_outstanding > 0 && (
        <div className="outstanding-banner">
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <AlertCircle size={17} color="var(--red-500)"/>
            <div>
              <div style={{fontWeight:600,color:'var(--red-500)',fontSize:13.5}}>Outstanding Balance</div>
              <div style={{fontSize:12.5,color:'var(--slate-500)'}}>You have pending or arrears amounts</div>
            </div>
          </div>
          <div className="outstanding-amount">{fmt(summary.total_outstanding)}</div>
        </div>
      )}

      {/* Summary stats */}
      {summary && (
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-icon green"><CheckCircle size={19}/></div><div><div className="stat-value">{fmt(summary.dues.paid)}</div><div className="stat-label">Dues Paid</div></div></div>
          <div className="stat-card"><div className="stat-icon gold"><Clock size={19}/></div><div><div className="stat-value">{fmt(summary.dues.pending + summary.dues.arrears)}</div><div className="stat-label">Dues Pending / Arrears</div></div></div>
          <div className="stat-card"><div className="stat-icon blue"><Star size={19}/></div><div><div className="stat-value">{fmt(summary.program_pledges.paid)}</div><div className="stat-label">Pledges Fulfilled</div></div></div>
          <div className="stat-card"><div className="stat-icon red"><TrendingDown size={19}/></div><div><div className="stat-value">{fmt(summary.total_outstanding)}</div><div className="stat-label">Total Outstanding</div></div></div>
        </div>
      )}

      {/* Ledger */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">My Financial Ledger</span>
          <span style={{fontSize:12.5,color:'var(--slate-400)'}}>{user?.region_name} · {new Date().getFullYear()}</span>
        </div>
        <div className="card-body">
          <div className="tabs">
            <button className={`tab ${tab==='dues'?'active':''}`}    onClick={() => setTab('dues')}>Monthly Dues ({dues.length})</button>
            <button className={`tab ${tab==='program'?'active':''}`} onClick={() => setTab('program')}>Program Pledges ({prog.length})</button>
            <button className={`tab ${tab==='other'?'active':''}`}   onClick={() => setTab('other')}>Other Pledges ({other.length})</button>
          </div>

          {tab === 'dues' && (
            dues.length === 0
              ? <div className="empty-state"><BookOpen size={34}/><p>No dues records found</p></div>
              : <div className="table-wrapper"><table>
                  <thead><tr><th>Month / Year</th><th>Amount</th><th>Status</th><th>Last Updated</th><th>Notes</th></tr></thead>
                  <tbody>{dues.map(d => (
                    <tr key={d.id}>
                      <td style={{fontWeight:500}}>{MONTHS[d.due_month-1]} {d.due_year}</td>
                      <td>{fmt(d.amount)}</td>
                      <td><Badge status={d.status}/></td>
                      <td style={{color:'var(--slate-400)',fontSize:12.5}}>{d.updated_at ? new Date(d.updated_at).toLocaleDateString('en-NG') : '—'}</td>
                      <td style={{color:'var(--slate-500)',fontSize:12.5}}>{d.notes || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
          )}

          {tab === 'program' && (
            prog.length === 0
              ? <div className="empty-state"><Star size={34}/><p>No program pledges found</p></div>
              : <div className="table-wrapper"><table>
                  <thead><tr><th>Program / Event</th><th>Pledge Amount</th><th>Status</th><th>Date</th><th>Notes</th></tr></thead>
                  <tbody>{prog.map(p => (
                    <tr key={p.id}>
                      <td style={{fontWeight:500}}>{p.program_name}</td>
                      <td>{fmt(p.pledge_amount)}</td>
                      <td><Badge status={p.status}/></td>
                      <td style={{color:'var(--slate-400)',fontSize:12.5}}>{p.pledge_date ? new Date(p.pledge_date).toLocaleDateString('en-NG') : '—'}</td>
                      <td style={{color:'var(--slate-500)',fontSize:12.5}}>{p.notes || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
          )}

          {tab === 'other' && (
            other.length === 0
              ? <div className="empty-state"><BookOpen size={34}/><p>No other pledges found</p></div>
              : <div className="table-wrapper"><table>
                  <thead><tr><th>Description</th><th>Amount</th><th>Status</th><th>Date</th><th>Notes</th></tr></thead>
                  <tbody>{other.map(p => (
                    <tr key={p.id}>
                      <td style={{fontWeight:500}}>{p.description}</td>
                      <td>{fmt(p.pledge_amount)}</td>
                      <td><Badge status={p.status}/></td>
                      <td style={{color:'var(--slate-400)',fontSize:12.5}}>{p.pledge_date ? new Date(p.pledge_date).toLocaleDateString('en-NG') : '—'}</td>
                      <td style={{color:'var(--slate-500)',fontSize:12.5}}>{p.notes || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
          )}
        </div>
      </div>
    </div>
  );
}
