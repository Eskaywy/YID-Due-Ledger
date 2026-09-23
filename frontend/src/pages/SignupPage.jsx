import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, UserPlus, Shield } from 'lucide-react';
import API, { errorMessage } from '../utils/api';

export default function SignupPage() {
  const [full_name, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [position, setPosition] = useState('');
  const [region_id, setRegionId] = useState('');
  const [dept_code, setDeptCode] = useState('');
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [regionsError, setRegionsError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  // Regions are required for signup — failures are now visible and retryable
  // instead of a silently empty dropdown (audit H1).
  const loadRegions = () => {
    setRegionsLoading(true);
    setRegionsError('');
    API.get('/auth/regions')
      .then(r => setRegions(r.data))
      .catch(err => setRegionsError(errorMessage(err, 'Could not load regions.')))
      .finally(() => setRegionsLoading(false));
  };
  useEffect(() => { loadRegions(); }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    
    if (!full_name || !email || !password || !confirmPassword || !position || !region_id || !dept_code) {
      setError('Please fill in all required fields');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    setLoading(true);
    try {
      const user = await signup(full_name, email, password, position, region_id, dept_code);
      navigate(user.role === 'super_admin' ? '/admin' : '/my-records');
    } catch (err) {
      setError(errorMessage(err, 'Signup failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left branding panel */}
      <div className="login-left">
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'auto'}}>
          <img className="logo-icon" src="/logo.svg" alt="" aria-hidden="true" style={{width:40,height:40}} />
          <div>
            <div style={{color:'#fff',fontWeight:700,fontSize:16,fontFamily:'Space Grotesk,sans-serif'}}>YID Due Ledger</div>
            <div style={{color:'rgba(255,255,255,.55)',fontSize:11}}>Dues Management Platform</div>
          </div>
        </div>

        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',paddingBottom:36}}>
          <div style={{color:'rgba(255,255,255,.6)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:14}}>
            Pilot Programme · Lagos & South-West
          </div>
          <h1 style={{color:'#fff',fontSize:32,fontFamily:'Space Grotesk,sans-serif',fontWeight:700,lineHeight:1.15,marginBottom:14}}>
            Join our community today.
          </h1>
          <p style={{color:'rgba(255,255,255,.65)',fontSize:14,lineHeight:1.65,marginBottom:28}}>
            Create an account to manage your dues and pledges with ease.
          </p>
          {['Verify monthly dues status at any time','Track program and other pledges','Secure portal — your data only'].map((t,i) => (
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
          <h1 className="login-title">Create your account</h1>
          <p className="login-subtitle">Enter your details to get started.</p>

          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="su-name">Full Name</label>
              <input id="su-name" type="text" placeholder="John Doe" value={full_name}
                onChange={e => setFullName(e.target.value)} autoComplete="name"/>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="su-email">Email Address</label>
              <input id="su-email" type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} autoComplete="email"/>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="su-position">Position *</label>
              <select id="su-position" value={position} onChange={e => setPosition(e.target.value)} required>
                <option value="">Select your position</option>
                <option value="Leader">Leader</option>
                <option value="Member">Member</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="su-region">Region *</label>
              <select id="su-region" value={region_id} onChange={e => setRegionId(e.target.value)} required
                disabled={regionsLoading} aria-invalid={!!regionsError}>
                <option value="">{regionsLoading ? 'Loading regions…' : 'Select your region'}</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {regionsError && (
                <div className="form-error" role="alert" style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                  <span>{regionsError}</span>
                  <button type="button" onClick={loadRegions}
                    style={{background:'none',border:'none',color:'var(--green-700)',fontWeight:700,cursor:'pointer',fontSize:13,textDecoration:'underline'}}>
                    Retry
                  </button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="su-dept">Department *</label>
              <select id="su-dept" value={dept_code} onChange={e => setDeptCode(e.target.value)} required>
                <option value="">Select your department</option>
                <option value="MED">Media</option>
                <option value="INF">Information</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="su-password">Password</label>
              <div style={{position:'relative'}}>
                <input id="su-password" type={showPass ? 'text':'password'} placeholder="Minimum 8 characters"
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password" style={{paddingRight:48}}/>
                <button type="button" onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'} aria-pressed={showPass}
                  style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',
                    background:'none',border:'none',color:'var(--slate-400)',cursor:'pointer',padding:'8px'}}>
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="su-confirm">Confirm Password</label>
              <div style={{position:'relative'}}>
                <input id="su-confirm" type={showConfirmPass ? 'text':'password'} placeholder="Confirm your password"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password" style={{paddingRight:48}}/>
                <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)}
                  aria-label={showConfirmPass ? 'Hide password' : 'Show password'} aria-pressed={showConfirmPass}
                  style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',
                    background:'none',border:'none',color:'var(--slate-400)',cursor:'pointer',padding:'8px'}}>
                  {showConfirmPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{width:'100%',marginTop:4}} disabled={loading}
              aria-busy={loading}>
              <UserPlus size={15}/> {loading ? 'Creating Account…' : 'Sign Up'}
            </button>
          </form>

          <div style={{marginTop:24,textAlign:'center',fontSize:14,color:'var(--slate-500)'}}>
            Already have an account? <Link to="/login" style={{color:'var(--green-600)',fontWeight:600}}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
