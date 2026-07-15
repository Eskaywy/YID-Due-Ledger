import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { ClipboardList, ShieldCheck } from 'lucide-react';

const ACTION_LABELS = {
  CREATE_MEMBER:'Created member', UPDATE_MEMBER:'Updated member', DELETE_MEMBER:'Archived member',
  CREATE_DUE:'Added due record', UPDATE_DUE:'Updated due record', DELETE_DUE:'Deleted due record',
  CREATE_PROGRAM_PLEDGE:'Added program pledge', UPDATE_PROGRAM_PLEDGE:'Updated program pledge', DELETE_PROGRAM_PLEDGE:'Deleted program pledge',
  CREATE_OTHER_PLEDGE:'Added other pledge', UPDATE_OTHER_PLEDGE:'Updated other pledge', DELETE_OTHER_PLEDGE:'Deleted other pledge',
  BATCH_UPLOAD:'Batch upload processed', CHANGE_PASSWORD:'Password changed',
};
const TC = {
  users:{ bg:'#e8f0fe', color:'#1558d6' },
  monthly_dues:{ bg:'var(--green-100)', color:'var(--green-700)' },
  program_pledges:{ bg:'var(--amber-100)', color:'#92400e' },
  other_pledges:{ bg:'var(--red-100)', color:'var(--red-500)' },
  multiple:{ bg:'var(--slate-100)', color:'var(--slate-600)' },
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { API.get('/admin/audit-logs').then(r => setLogs(r.data)).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="loading-container"><div className="spinner"/></div>;
  return (
    <div>
      <div className="alert alert-info" style={{marginBottom:20}}><ShieldCheck size={15}/> Audit logs record every administrative action. Only Super Admins can view this page.</div>
      <div className="card">
        <div className="card-header">
          <span className="card-title"><ClipboardList size={16} style={{verticalAlign:'middle',marginRight:7}}/>Activity Log</span>
          <span style={{fontSize:12.5,color:'var(--slate-400)'}}>Last 100 actions</span>
        </div>
        <div className="table-wrapper">
          {logs.length===0 ? (
            <div className="empty-state" style={{padding:48}}><ClipboardList size={34}/><p style={{marginTop:8}}>No audit entries yet</p></div>
          ) : (
            <table>
              <thead><tr><th>Action</th><th>Table</th><th>Performed By</th><th>Date &amp; Time</th><th>Details</th></tr></thead>
              <tbody>{logs.map((log,i) => {
                const tc = TC[log.target_table] || TC.multiple;
                let after = null;
                try { after = log.after_value ? JSON.parse(log.after_value) : null; } catch {}
                return (
                  <tr key={i}>
                    <td style={{fontWeight:500,fontSize:13.5}}>{ACTION_LABELS[log.action]||log.action}</td>
                    <td>{log.target_table && <span style={{display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:11.5,fontWeight:600,background:tc.bg,color:tc.color}}>{log.target_table}</span>}</td>
                    <td style={{fontSize:13,color:'var(--slate-600)'}}>{log.actor_name||'System'}</td>
                    <td style={{fontSize:12.5,color:'var(--slate-400)',whiteSpace:'nowrap'}}>{new Date(log.created_at).toLocaleString('en-NG')}</td>
                    <td style={{fontSize:12,color:'var(--slate-500)',maxWidth:220}}>{after && <span title={JSON.stringify(after)}>{Object.entries(after).slice(0,2).map(([k,v])=>`${k}: ${String(v).slice(0,20)}`).join(' · ')}</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
