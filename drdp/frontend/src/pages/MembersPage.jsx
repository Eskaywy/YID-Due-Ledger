import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { Search, Plus, Download, Eye, Trash2, UserX } from 'lucide-react';
import CreateMemberModal from '../components/CreateMemberModal';

export default function MembersPage() {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [regions, setRegions] = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch]         = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [alert, setAlert] = useState(null);
  const LIMIT = 15;

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: LIMIT });
      if (search)       p.append('search', search);
      if (filterRegion) p.append('region_id', filterRegion);
      const res = await API.get(`/admin/members?${p}`);
      setMembers(res.data.members);
      setTotal(res.data.total);
    } catch {}
    setLoading(false);
  }, [page, search, filterRegion]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  useEffect(() => { API.get('/admin/regions').then(r => setRegions(r.data)); }, []);

  const showAlert = (type, msg) => { setAlert({ type, msg }); setTimeout(() => setAlert(null), 4000); };

  const handleDelete = async (id, name) => {
    if (!confirm(`Archive "${name}"? They will lose access.`)) return;
    try {
      await API.delete(`/admin/members/${id}`);
      showAlert('success', `${name} archived successfully.`);
      fetchMembers();
    } catch (err) { showAlert('error', err.response?.data?.error || 'Failed to archive member'); }
  };

  const handleExport = async () => {
    const p = new URLSearchParams();
    if (filterRegion) p.append('region_id', filterRegion);
    const res = await API.get(`/admin/export?${p}`, { responseType:'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href=url; a.download='members-export.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / LIMIT);
  const initials = name => name?.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() || '?';

  return (
    <div>
      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Toolbar */}
      <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap',alignItems:'center'}}>
        <div className="search-bar" style={{flex:'1 1 220px',minWidth:180}}>
          <Search size={15}/>
          <input placeholder="Search name, ID, or email…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/>
        </div>
        <select style={{width:'auto',minWidth:150}} value={filterRegion}
          onChange={e => { setFilterRegion(e.target.value); setPage(1); }}>
          <option value="">All Regions</option>
          {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button className="btn btn-outline" onClick={handleExport}><Download size={14}/> Export</button>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14}/> Add Member</button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">All Members</span>
          <span style={{fontSize:12.5,color:'var(--slate-400)'}}>{total} total</span>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-container"><div className="spinner"/></div>
          ) : members.length === 0 ? (
            <div className="empty-state" style={{padding:44}}>
              <UserX size={34}/><p style={{marginTop:8}}>No members found</p>
              {search && <p style={{fontSize:12.5,marginTop:4}}>Try a different search</p>}
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Member</th><th>Member ID</th><th>Position</th><th>Region</th><th>Joined</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:9}}>
                        <div style={{width:30,height:30,borderRadius:'50%',background:'var(--green-100)',
                          display:'flex',alignItems:'center',justifyContent:'center',
                          color:'var(--green-700)',fontSize:11,fontWeight:600,flexShrink:0}}>
                          {initials(m.full_name)}
                        </div>
                        <div>
                          <div style={{fontWeight:500,fontSize:13.5}}>{m.full_name}</div>
                          <div style={{fontSize:12,color:'var(--slate-400)'}}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{fontFamily:'monospace',fontSize:12.5,color:'var(--slate-600)'}}>{m.user_id_code}</td>
                    <td style={{fontSize:13}}>{m.position || '—'}</td>
                    <td style={{fontSize:13}}>{m.region_name}</td>
                    <td style={{fontSize:12.5,color:'var(--slate-400)'}}>{new Date(m.created_at).toLocaleDateString('en-NG')}</td>
                    <td>
                      <div style={{display:'flex',gap:5}}>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/members/${m.id}`)}>
                          <Eye size={12}/>
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id, m.full_name)}>
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{padding:'14px 18px',borderTop:'1px solid var(--slate-50)'}}>
            <div className="pagination">
              <button className="page-btn" onClick={() => setPage(p=>p-1)} disabled={page===1}>← Prev</button>
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{
                const p = page<=4 ? i+1 : page-3+i;
                if (p<1||p>totalPages) return null;
                return <button key={p} className={`page-btn ${p===page?'active':''}`} onClick={()=>setPage(p)}>{p}</button>;
              })}
              <button className="page-btn" onClick={() => setPage(p=>p+1)} disabled={page===totalPages}>Next →</button>
              <span style={{fontSize:12,color:'var(--slate-400)',marginLeft:6}}>{((page-1)*LIMIT)+1}–{Math.min(page*LIMIT,total)} of {total}</span>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateMemberModal
          regions={regions}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchMembers(); showAlert('success','Member created successfully.'); }}
        />
      )}
    </div>
  );
}
