import React, { useState } from 'react';
import API from '../utils/api';
import { Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';

export default function BatchUploadPage() {
  const [file, setFile]       = useState(null);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = f => {
    const ext = f?.name.split('.').pop().toLowerCase();
    if (!['csv','xlsx','xls'].includes(ext)) { alert('Please upload a CSV or Excel (.xlsx/.xls) file.'); return; }
    setFile(f); setResult(null);
  };

  const handleDrop = e => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await API.post('/admin/batch-upload', fd, { headers:{'Content-Type':'multipart/form-data'} });
      setResult(res.data);
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Upload failed' });
    } finally { setLoading(false); }
  };

  const downloadTemplate = () => {
    const csv = `user_id,email,due_month,due_year,due_amount,due_status,pledge_program,pledge_amount,pledge_status,pledge_date
LGS-MED-202506-0002,adewale@drdp.ng,6,2025,2000,paid,,,,
LGS-MED-202506-0002,adewale@drdp.ng,,,,,Annual Dinner 2025,5000,paid,2025-03-15`;
    const blob = new Blob([csv], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='yid-due-ledger-upload-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{maxWidth:760}}>
      <div className="card" style={{marginBottom:20}}>
        <div className="card-header">
          <span className="card-title">Batch Upload Records</span>
          <button className="btn btn-outline btn-sm" onClick={downloadTemplate}><Download size={13}/> Download Template</button>
        </div>
        <div className="card-body">
          <div className="alert alert-info" style={{marginBottom:18}}>
            Upload a <strong>CSV or Excel</strong> file to update monthly dues and program pledges in bulk.
            Use the Member ID (<code>user_id</code>) or email to identify members.
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e=>{e.preventDefault();setDragOver(true)}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('fileInput').click()}
            style={{
              border:`2px dashed ${dragOver ? 'var(--green-500)' : 'var(--slate-200)'}`,
              borderRadius:10, padding:'40px 24px', textAlign:'center', cursor:'pointer',
              background: dragOver ? 'var(--green-50)' : 'var(--slate-50)',
              transition:'all .15s', marginBottom:18,
            }}>
            <input id="fileInput" type="file" accept=".csv,.xlsx,.xls" style={{display:'none'}}
              onChange={e => handleFile(e.target.files[0])}/>
            {file ? (
              <div>
                <FileText size={36} color="var(--green-600)" style={{margin:'0 auto 10px'}}/>
                <div style={{fontWeight:600,fontSize:15,color:'var(--slate-800)'}}>{file.name}</div>
                <div style={{fontSize:13,color:'var(--slate-400)',marginTop:4}}>{(file.size/1024).toFixed(1)} KB · Click to change</div>
              </div>
            ) : (
              <div>
                <Upload size={36} color="var(--slate-300)" style={{margin:'0 auto 10px'}}/>
                <div style={{fontWeight:600,fontSize:15,color:'var(--slate-600)'}}>Drop your file here or click to browse</div>
                <div style={{fontSize:13,color:'var(--slate-400)',marginTop:6}}>Supports CSV, XLSX, XLS · Max 5 MB</div>
              </div>
            )}
          </div>

          <button className="btn btn-primary" style={{width:'100%'}} onClick={handleUpload} disabled={!file||loading}>
            <Upload size={15}/> {loading ? 'Uploading…' : 'Upload & Process'}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="card">
          <div className="card-header"><span className="card-title">Upload Results</span></div>
          <div className="card-body">
            {result.error ? (
              <div className="alert alert-error"><AlertCircle size={16}/> {result.error}</div>
            ) : (
              <>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:20}}>
                  <div style={{background:'var(--slate-50)',borderRadius:8,padding:'14px 16px',textAlign:'center'}}>
                    <div style={{fontSize:24,fontWeight:700,color:'var(--slate-800)',fontFamily:'Space Grotesk,sans-serif'}}>{result.processed}</div>
                    <div style={{fontSize:12.5,color:'var(--slate-400)',marginTop:3}}>Rows Processed</div>
                  </div>
                  <div style={{background:'var(--green-50)',borderRadius:8,padding:'14px 16px',textAlign:'center'}}>
                    <div style={{fontSize:24,fontWeight:700,color:'var(--green-700)',fontFamily:'Space Grotesk,sans-serif'}}>{result.successes}</div>
                    <div style={{fontSize:12.5,color:'var(--green-600)',marginTop:3}}>Successful</div>
                  </div>
                  <div style={{background: result.errors?.length ? 'var(--red-100)' : 'var(--slate-50)',borderRadius:8,padding:'14px 16px',textAlign:'center'}}>
                    <div style={{fontSize:24,fontWeight:700,color:result.errors?.length?'var(--red-500)':'var(--slate-400)',fontFamily:'Space Grotesk,sans-serif'}}>{result.errors?.length||0}</div>
                    <div style={{fontSize:12.5,color:result.errors?.length?'var(--red-500)':'var(--slate-400)',marginTop:3}}>Errors</div>
                  </div>
                </div>

                {result.errors?.length > 0 && (
                  <div>
                    <div style={{fontWeight:600,fontSize:14,marginBottom:10,color:'var(--red-500)'}}>
                      <AlertCircle size={14} style={{verticalAlign:'middle',marginRight:5}}/> Error Details
                    </div>
                    <div style={{background:'var(--red-100)',borderRadius:8,padding:'10px 14px'}}>
                      {result.errors.map((e,i) => (
                        <div key={i} style={{fontSize:13,color:'#c62828',padding:'4px 0',borderBottom:i<result.errors.length-1?'1px solid #ffcdd2':'none'}}>
                          Row {e.row}: {e.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.errors?.length === 0 && (
                  <div className="alert alert-success"><CheckCircle size={15}/> All records imported successfully!</div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Column reference */}
      <div className="card" style={{marginTop:20}}>
        <div className="card-header"><span className="card-title">CSV Column Reference</span></div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Column</th><th>Required</th><th>Description</th><th>Example</th></tr></thead>
            <tbody>
              {[
                ['user_id','One of two','Member ID code','LGS-MED-202506-0002'],
                ['email','One of two','Member email address','adewale@drdp.ng'],
                ['due_month','For dues','Month number (1–12)','6'],
                ['due_year','For dues','4-digit year','2025'],
                ['due_amount','For dues','Amount in Naira','2000'],
                ['due_status','For dues','paid / pending / arrears','paid'],
                ['pledge_program','For pledges','Program or event name','Annual Dinner 2025'],
                ['pledge_amount','For pledges','Pledge amount in Naira','5000'],
                ['pledge_status','For pledges','paid / pending / arrears','pending'],
                ['pledge_date','Optional','ISO date YYYY-MM-DD','2025-03-15'],
              ].map(([col,req,desc,ex],i) => (
                <tr key={i}>
                  <td><code style={{background:'var(--slate-100)',padding:'2px 6px',borderRadius:4,fontSize:12.5}}>{col}</code></td>
                  <td style={{fontSize:12.5,color:req==='Required'?'var(--red-500)':'var(--slate-500)'}}>{req}</td>
                  <td style={{fontSize:13}}>{desc}</td>
                  <td style={{fontSize:12.5,color:'var(--slate-500)',fontFamily:'monospace'}}>{ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
