import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { ClipboardList, RefreshCw } from 'lucide-react';

const ACTION_LABELS = {
  CREATE_MEMBER: 'Created member',
  UPDATE_MEMBER: 'Updated member',
  DELETE_MEMBER: 'Archived member',
  CREATE_DUE: 'Added due record',
  UPDATE_DUE: 'Updated due record',
  DELETE_DUE: 'Deleted due record',
  CREATE_PROGRAM_PLEDGE: 'Added program pledge',
  UPDATE_PROGRAM_PLEDGE: 'Updated program pledge',
  DELETE_PROGRAM_PLEDGE: 'Deleted program pledge',
  CREATE_OTHER_PLEDGE: 'Added other pledge',
  UPDATE_OTHER_PLEDGE: 'Updated other pledge',
  DELETE_OTHER_PLEDGE: 'Deleted other pledge',
  BATCH_UPLOAD: 'Batch upload processed',
  CHANGE_PASSWORD: 'Password changed',
};

const ACTION_COLORS = {
  CREATE_MEMBER: 'badge-paid', UPDATE_MEMBER: 'badge-pending',
  DELETE_MEMBER: 'badge-arrears', BATCH_UPLOAD: 'badge-super',
};

export default function AuditLogsPage() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');

  const load = async () => {
    setLoading(true);
    try { const res = await API.get('/admin/audit-logs'); setLogs(res.data); }
    catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter ? logs.filter(l => l.action.includes(filter) || l.actor_name?.toLowerCase().includes(filter.toLowerCase())) : logs;

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span className="card-title"><ClipboardList size={16} style={{verticalAlign:'middle',marginRight:6}}/>Audit Trail</span>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <input
              placeholder="Filter by action or user…"
              value={filter} onChange={e => setFilter(e.target.value)}
              style={{width:220,padding:'7px 12px',fontSize:13}}
            />
            <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={13}/> Refresh</button>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-container"><div className="spinner"/></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{padding:48}}>
              <ClipboardList size={34}/><p style={{marginTop:8}}>No audit records found</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Performed By</th>
                  <th>Target</th>
                  <th>Date & Time</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`badge ${ACTION_COLORS[log.action] || 'badge-member'}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td style={{fontWeight:500,fontSize:13.5}}>{log.actor_name || 'System'}</td>
                    <td style={{fontSize:12.5,color:'var(--slate-500)',fontFamily:'monospace'}}>{log.target_table || '—'}</td>
                    <td style={{fontSize:12.5,color:'var(--slate-400)'}}>{new Date(log.created_at).toLocaleString('en-NG')}</td>
                    <td style={{fontSize:12,color:'var(--slate-400)',maxWidth:220}}>
                      {log.after_value ? (
                        <span style={{fontFamily:'monospace',fontSize:11,background:'var(--slate-50)',padding:'2px 6px',borderRadius:4,display:'inline-block',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {log.after_value}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{padding:'12px 18px',borderTop:'1px solid var(--slate-50)',fontSize:12.5,color:'var(--slate-400)'}}>
          Showing {filtered.length} of {logs.length} records · Last 100 entries
        </div>
      </div>
    </div>
  );
}
