import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, LogIn, Shield } from 'lucide-react';
import { errorMessage } from '../utils/api';

export default function LoginPage() {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const { login, user, loading: authLoading, sessionExpired } = useAuth();
  const navigate   = useNavigate();
  const [searchParams] = useSearchParams();

  // Surface a friendly notice when the interceptor bounced an expired session
  // here (audit C2) — hidden once the user starts trying to sign in.
  const showExpired = !attempted && (sessionExpired || searchParams.get('session') === 'expired');

  // Already authenticated (deep link / refresh) — go to the portal instead of
  // showing a login form (audit M8).
  useEffect(() => {
    if (!authLoading && user) {
      navigate(user.role === 'super_admin' ? '/admin' : '/my-records', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleSubmit = async e => {
    e.preventDefault();
    setAttempted(true);
    if (!email || !password) { setError('Please enter your email or username and password.'); return; }
    setError(''); setLoading(true);
    try {
      const loggedIn = await login(email, password);
      navigate(loggedIn.role === 'super_admin' ? '/admin' : '/my-records');
    } catch (err) {
      // 401 from /auth/login is no longer intercepted globally (audit C1),
      // so bad credentials now actually reach this error banner.
      setError(errorMessage(err, 'Login failed. Please try again.'));
    } finally { setLoading(false); }
  };

  if (authLoading || user) {
    return <div className="loading-container" role="status" aria-label="Loading"><div className="spinner" /></div>;
  }

  return (
    <div className="login-page">
      {/* Left branding panel */}
      <div className="login-left">
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'auto'}}>
          <img className="logo-icon" src="/logo.svg" alt="" aria-hidden="true" style={{width:40,height:40}} />
          <div>
            <div style={{color:'#fff',fontWeight:700,fontSize:16,fontFamily:'Space Grotesk,sans-serif'}}>YISD-DUE-LEDGER</div>
            <div style={{color:'rgba(255,255,255,.55)',fontSize:11}}>Youth Information Department</div>
          </div>
        </div>

        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',paddingBottom:36}}>
          <div style={{color:'rgba(255,255,255,.6)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:14}}>
            Pilot Programme · Lagos & South-West
          </div>
          <h1 style={{color:'#fff',fontSize:32,fontFamily:'Space Grotesk,sans-serif',fontWeight:700,lineHeight:1.15,marginBottom:14}}>
            Your records, verified in seconds.
          </h1>
          <p style={{color:'rgba(255,255,255,.65)',fontSize:14,lineHeight:1.65,marginBottom:28}}>
            A secure digitization platform giving every department member instant, transparent access to their financial records — dues, pledges, and commitments.
          </p>
          {['Verify monthly dues status at any time','Track program and other pledges','Secure portal — your data only','Managed by Super Admin'].map((t,i) => (
            <div key={i} style={{display:'flex',gap:9,color:'rgba(255,255,255,.65)',fontSize:13,marginBottom:10}}>
              <span style={{color:'#4dc47b',fontWeight:700,marginTop:1}}>✓</span>{t}
            </div>
          ))}
        </div>

        <div style={{color:'rgba(255,255,255,.55)',fontSize:11,borderTop:'1px solid rgba(255,255,255,.08)',paddingTop:16}}>
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
          <h1 className="login-title">Sign in to your account</h1>
          <p className="login-subtitle">Enter your email, username or Smart ID to continue.</p>

          {showExpired && (
            <div className="alert alert-info" role="status">Your session has expired. Please sign in again.</div>
          )}
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-identifier">Email or Username</label>
              <input id="login-identifier" type="text" placeholder="you@example.com or username" value={email}
                onChange={e => setEmail(e.target.value)} autoComplete="username" aria-invalid={!!error}/>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div style={{position:'relative'}}>
                <input id="login-password" type={showPass ? 'text':'password'} placeholder="Enter your password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" style={{paddingRight:48}} aria-invalid={!!error}/>
                <button type="button" onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'} aria-pressed={showPass}
                  style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',
                    background:'none',border:'none',color:'var(--slate-400)',cursor:'pointer',padding:'8px'}}>
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{width:'100%',marginTop:4}} disabled={loading}
              aria-busy={loading}>
              <LogIn size={15}/> {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={{marginTop:20,textAlign:'center',fontSize:14,color:'var(--slate-500)'}}>
            Don't have an account? <Link to="/signup" style={{color:'var(--green-600)',fontWeight:600}}>Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
