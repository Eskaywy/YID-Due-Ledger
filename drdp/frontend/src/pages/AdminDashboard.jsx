import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { Users, CheckCircle, AlertTriangle, Wallet, Upload, ChevronRight, Activity, MapPin } from 'lucide-react';

const fmt = n => '₦' + Number(n||0).toLocaleString('en-NG', { minimumFractionDigits: 2 });

const ACTION_LABELS = {
  CREATE_MEMBER:'Created member', UPDATE_MEMBER:'Updated member', DELETE_MEMBER:'Archived member',
  CREATE_DUE:'Added due record', UPDATE_DUE:'Updated due record',
  CREATE_PROGRAM_PLEDGE:'Added program pledge', UPDATE_PROGRAM_PLEDGE:'Updated program pledge',
  BATCH_UPLOAD:'Batch upload processed', CHANGE_PASSWORD:'Password changed',
};

export default function AdminDashboard() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { API.get('/admin/stats').then(r => setStats(r.data)).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="loading-container"><div className="spinner"/></div>;

  return (
    <div>
      {/* Top stats */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><Users size={19}/></div><div><div className="stat-value">{stats?.total_members||0}</div><div className="stat-label">Active Members</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><CheckCircle size={19}/></div><div><div className="stat-value">{stats?.paid_members||0}</div><div className="stat-label">Members Up to Date</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><AlertTriangle size={19}/></div><div><div className="stat-value">{stats?.arrears_members||0}</div><div className="stat-label">Members in Arrears</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Wallet size={19}/></div><div><div className="stat-value">{fmt(stats?.total_collected)}</div><div className="stat-label">Total Dues Collected</div></div></div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
        {/* Quick actions */}
        <div className="card">
          <div className="card-header"><span className="card-title">Quick Actions</span></div>
          <div className="card-body" style={{display:'flex',flexDirection:'column',gap:10}}>
            {[
              { icon:<Users size={17}/>,  label:'Manage Members',    desc:'Search, create, edit and archive member profiles', path:'/admin/members' },
              { icon:<Upload size={17}/>, label:'Batch Upload',       desc:'Upload CSV/Excel to update dues records in bulk',  path:'/admin/batch-upload' },
              { icon:<Activity size={17}/>, label:'View Audit Logs', desc:'Track all administrative actions and changes',     path:'/admin/audit-logs' },
            ].map((a,i) => (
              <button key={i} onClick={() => navigate(a.path)}
                style={{display:'flex',alignItems:'center',gap:12,padding:'13px',borderRadius:8,
                  border:'1.5px solid var(--slate-100)',background:'var(--slate-50)',cursor:'pointer',
                  textAlign:'left',transition:'border-color .15s',width:'100%'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--green-400)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--slate-100)'}>
                <div style={{width:38,height:38,borderRadius:8,background:'var(--green-100)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--green-600)',flexShrink:0}}>{a.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13.5,color:'var(--slate-800)'}}>{a.label}</div>
                  <div style={{fontSize:12.5,color:'var(--slate-400)',marginTop:2}}>{a.desc}</div>
                </div>
                <ChevronRight size={15} color="var(--slate-300)"/>
              </button>
            ))}
          </div>
        </div>

        {/* Region breakdown */}
        <div className="card">
          <div className="card-header"><span className="card-title">By Region</span><MapPin size={15} color="var(--slate-400)"/></div>
          <div style={{padding:'8px 0'}}>
            {(stats?.region_stats||[]).map((r,i) => (
              <div key={i} style={{padding:'13px 20px',borderBottom:'1px solid var(--slate-50)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:14,color:'var(--slate-800)'}}>{r.name}</div>
                    <div style={{fontSize:12.5,color:'var(--slate-400)',marginTop:2}}>{r.member_count} members</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:600,fontSize:14,color:'var(--green-700)'}}>{fmt(r.collected)}</div>
                    <div style={{fontSize:12,color:'var(--slate-400)'}}>collected</div>
                  </div>
                </div>
              </div>
            ))}
            {!stats?.region_stats?.length && <div className="empty-state" style={{padding:32}}>No data yet</div>}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <div className="card-header"><span className="card-title">Recent Activity</span><Activity size={15} color="var(--slate-400)"/></div>
        <div className="table-wrapper">
          {!(stats?.recent_activity?.length) ? (
            <div className="empty-state" style={{padding:36}}>No activity yet</div>
          ) : (
            <table>
              <thead><tr><th>Action</th><th>Performed By</th><th>Date & Time</th></tr></thead>
              <tbody>{stats.recent_activity.map((a,i) => (
                <tr key={i}>
                  <td style={{fontWeight:500}}>{ACTION_LABELS[a.action] || a.action}</td>
                  <td style={{color:'var(--slate-500)'}}>{a.actor_name || 'System'}</td>
                  <td style={{color:'var(--slate-400)',fontSize:12.5}}>{new Date(a.created_at).toLocaleString('en-NG')}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
