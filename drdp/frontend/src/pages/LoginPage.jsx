import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, LogIn, Shield } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setError(''); setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'super_admin' ? '/admin' : '/my-records');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  const fill = type => {
    if (type === 'super')  { setEmail('superadmin@drdp.ng'); setPassword('Admin@2025'); }
    if (type === 'member') { setEmail('adewale@drdp.ng');    setPassword('Member@2025'); }
  };

  return (
    <div className="login-page">
      {/* Left branding panel */}
      <div className="login-left">
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'auto'}}>
          <div className="logo-icon" style={{width:40,height:40,fontSize:15}}>DR</div>
          <div>
            <div style={{color:'#fff',fontWeight:700,fontSize:16,fontFamily:'Space Grotesk,sans-serif'}}>DRDP</div>
            <div style={{color:'rgba(255,255,255,.4)',fontSize:11}}>Departmental Records Platform</div>
          </div>
        </div>

        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',paddingBottom:36}}>
          <div style={{color:'rgba(255,255,255,.45)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:14}}>
            Pilot Programme · Lagos & South-West
          </div>
          <h1 style={{color:'#fff',fontSize:32,fontFamily:'Space Grotesk,sans-serif',fontWeight:700,lineHeight:1.15,marginBottom:14}}>
            Your records, verified in seconds.
          </h1>
          <p style={{color:'rgba(255,255,255,.5)',fontSize:14,lineHeight:1.65,marginBottom:28}}>
            A secure digitization platform giving every department member instant, transparent access to their financial records — dues, pledges, and commitments.
          </p>
          {['Verify monthly dues status at any time','Track program and other pledges','Secure portal — your data only','Managed by Super Admin'].map((t,i) => (
            <div key={i} style={{display:'flex',gap:9,color:'rgba(255,255,255,.65)',fontSize:13,marginBottom:10}}>
              <span style={{color:'#4dc47b',fontWeight:700,marginTop:1}}>✓</span>{t}
            </div>
          ))}
        </div>

        <div style={{color:'rgba(255,255,255,.25)',fontSize:11,borderTop:'1px solid rgba(255,255,255,.08)',paddingTop:16}}>
          Lagos & South-West Region Pilot · 2025
        </div>
      </div>

      {/* Right form panel */}
      <div className="login-right">
        <div className="login-form-box">
          <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:7}}>
            <Shield size={18} color="var(--green-600)"/>
            <span style={{fontSize:13,fontWeight:500,color:'var(--green-600)'}}>Secure Member Portal</span>
          </div>
          <h2 className="login-title">Sign in to your account</h2>
          <p className="login-subtitle">Enter your registered email and password to continue.</p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} autoComplete="email"/>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{position:'relative'}}>
                <input type={showPass ? 'text':'password'} placeholder="Enter your password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" style={{paddingRight:42}}/>
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',
                    background:'none',border:'none',color:'var(--slate-400)',cursor:'pointer',padding:2}}>
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{width:'100%',marginTop:4}} disabled={loading}>
              <LogIn size={15}/> {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Demo credentials */}
          <div style={{marginTop:24,padding:14,background:'var(--slate-50)',borderRadius:8,border:'1px solid var(--slate-100)'}}>
            <div style={{fontSize:11,fontWeight:600,color:'var(--slate-500)',marginBottom:9,textTransform:'uppercase',letterSpacing:'.5px'}}>
              Demo Accounts
            </div>
            <div style={{display:'flex',gap:7}}>
              <button className="btn btn-outline btn-sm" onClick={() => fill('super')}>
                <ShieldCheck size={12}/> Super Admin
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => fill('member')}>
                Member
              </button>
            </div>
            <div style={{marginTop:10,fontSize:12,color:'var(--slate-400)'}}>
              Admin: <code>Admin@2025</code> · Member: <code>Member@2025</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShieldCheck({ size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>;
}
