import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API, { errorMessage } from '../utils/api';
import { Search, Plus, Download, Eye, Trash2, UserX, RotateCcw, Archive, RefreshCw } from 'lucide-react';
import CreateMemberModal from '../components/CreateMemberModal';

export default function MembersPage() {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [regions, setRegions] = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [archived, setArchived] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [alert, setAlert] = useState(null);
  const abortRef = useRef(null);
  const LIMIT = 15;

  // Debounce search so typing doesn't fire one request per keystroke and
  // exhaust the API rate limit (audit M6).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Errors surface as an explicit error + retry — never a fake
  // "No members found" empty state (audit H1). In-flight requests are
  // cancelled so stale responses can't overwrite newer ones (audit M6).
  const fetchMembers = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ page, limit: LIMIT });
      if (debouncedSearch) p.append('search', debouncedSearch);
      if (filterRegion)    p.append('region_id', filterRegion);
      if (archived)        p.append('archived', '1');
      const res = await API.get(`/admin/members?${p}`, { signal: ctrl.signal });
      setMembers(res.data.members);
      setTotal(res.data.total);
    } catch (err) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || abortRef.current !== ctrl) return;
      setError(errorMessage(err, 'Failed to load members.'));
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }, [page, debouncedSearch, filterRegion, archived]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  useEffect(() => {
    API.get('/admin/regions')
      .then(r => setRegions(r.data))
      .catch(err => setAlert({ type:'error', msg: errorMessage(err, 'Failed to load regions for filtering.') }));
  }, []);

  const showAlert = (type, msg) => { setAlert({ type, msg }); setTimeout(() => setAlert(null), 4000); };

  const handleDelete = async (id, name) => {
    if (actingId) return;
    if (!confirm(`Archive "${name}"? They will lose access. You can restore them later from the Archived view.`)) return;
    setActingId(id);
    try {
      await API.delete(`/admin/members/${id}`);
      showAlert('success', `${name} archived. Restore any time from the Archived view.`);
      fetchMembers();
    } catch (err) { showAlert('error', errorMessage(err, 'Failed to archive member')); }
    finally { setActingId(null); }
  };

  // Restore path for archived members (audit H5 — archive is no longer a
  // one-way door from the UI).
  const handleRestore = async (id, name) => {
    if (actingId) return;
    setActingId(id);
    try {
      await API.post(`/admin/members/${id}/restore`);
      showAlert('success', `${name} restored and can sign in again.`);
      fetchMembers();
    } catch (err) { showAlert('error', errorMessage(err, 'Failed to restore member')); }
    finally { setActingId(null); }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const p = new URLSearchParams();
      if (filterRegion)    p.append('region_id', filterRegion);
      if (debouncedSearch) p.append('search', debouncedSearch);
      const res = await API.get(`/admin/export?${p}`, { responseType:'blob', timeout: 60000 });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href=url; a.download='members-export.xlsx'; a.click();
      URL.revokeObjectURL(url);
      showAlert('success', 'Export downloaded.');
    } catch (err) {
      showAlert('error', errorMessage(err, 'Export failed. Please try again.'));
    } finally { setExporting(false); }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const initials = name => name?.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() || '?';

  return (
    <div>
      {alert && <div className={`alert alert-${alert.type}`} role={alert.type === 'error' ? 'alert' : 'status'}>{alert.msg}</div>}

      {/* Toolbar */}
      <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap',alignItems:'center'}}>
        <div className="search-bar" style={{flex:'1 1 220px',minWidth:180}}>
          <Search size={15}/>
          <input placeholder="Search name, ID, or email…" aria-label="Search members"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/>
        </div>
        <select style={{width:'auto',minWidth:150}} value={filterRegion} aria-label="Filter by region"
          onChange={e => { setFilterRegion(e.target.value); setPage(1); }}>
          <option value="">All Regions</option>
          {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {!archived && (
          <>
            <button className="btn btn-outline" onClick={handleExport} disabled={exporting} aria-busy={exporting}>
              <Download size={14}/> {exporting ? 'Exporting…' : 'Export'}
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14}/> Add Member</button>
          </>
        )}
        <button className="btn btn-outline" onClick={() => { setArchived(a => !a); setPage(1); }}
          aria-pressed={archived} title={archived ? 'Show active members' : 'Show archived members'}>
          <Archive size={14}/> {archived ? 'Show Active Members' : 'Show Archived'}
        </button>
      </div>

      {archived && (
        <div className="alert alert-info" role="status" style={{marginBottom:16}}>
          Showing archived members. They cannot sign in until restored.
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">{archived ? 'Archived Members' : 'All Members'}</span>
        <span style={{fontSize:12.5,color:'var(--slate-400)'}}>{total} total</span>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-container" role="status" aria-label="Loading members"><div className="spinner"/></div>
          ) : error ? (
            <div className="empty-state" style={{padding:44}} role="alert">
              <RefreshCw size={34}/>
              <p style={{marginTop:8,color:'var(--red-500)'}}>{error}</p>
              <button className="btn btn-outline btn-sm" style={{marginTop:14}} onClick={fetchMembers}>
                <RefreshCw size={13}/> Try again
              </button>
            </div>
          ) : members.length === 0 ? (
            <div className="empty-state" style={{padding:44}}>
              <UserX size={34}/><p style={{marginTop:8}}>{archived ? 'No archived members' : 'No members found'}</p>
              {search && !archived && <p style={{fontSize:12.5,marginTop:4}}>Try a different search</p>}
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
                        {archived ? (
                          <button className="btn btn-outline btn-sm" onClick={() => handleRestore(m.id, m.full_name)}
                            disabled={actingId === m.id} aria-label={`Restore ${m.full_name}`}
                            title="Restore member">
                            <RotateCcw size={12}/> Restore
                          </button>
                        ) : (
                          <>
                            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/members/${m.id}`)}
                              aria-label={`View ${m.full_name}`} title="View member">
                              <Eye size={12}/>
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id, m.full_name)}
                              disabled={actingId === m.id} aria-label={`Archive ${m.full_name}`}
                              title="Archive member">
                              <Trash2 size={12}/>
                            </button>
                          </>
                        )}
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
