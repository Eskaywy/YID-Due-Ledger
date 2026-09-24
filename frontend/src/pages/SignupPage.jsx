import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, UserPlus, Shield } from 'lucide-react';
import API, { errorMessage } from '../utils/api';

const OTHER = '__other__';

export default function SignupPage() {
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [position, setPosition] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [region_id, setRegionId] = useState('');
  const [region_name, setRegionName] = useState('');
  const [dept_code, setDeptCode] = useState('');
  const [department_name, setDepartmentName] = useState('');
  const [regions, setRegions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [regionsError, setRegionsError] = useState('');
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useState('');
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

  // Departments come from the DB so custom "Other" entries appear for everyone.
  const loadDepartments = () => {
    setDepartmentsLoading(true);
    setDepartmentsError('');
    API.get('/auth/departments')
      .then(r => setDepartments(r.data))
      .catch(err => setDepartmentsError(errorMessage(err, 'Could not load departments.')))
      .finally(() => setDepartmentsLoading(false));
  };

  useEffect(() => { loadRegions(); loadDepartments(); }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !surname.trim() || !email || !password || !confirmPassword || !position || !region_id || !dept_code) {
      setError('Please fill in all required fields');
      return;
    }

    if (position !== 'Leader' && position !== 'Member') {
      setError('Position must be Leader or Member');
      return;
    }

    if (region_id === OTHER && !region_name.trim()) {
      setError('Please enter your region name');
      return;
    }
    if (dept_code === OTHER && !department_name.trim()) {
      setError('Please enter your department name');
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
      const user = await signup({
        first_name: firstName.trim(),
        surname: surname.trim(),
        email: email.trim(),
        password,
        position,
        role_title: roleTitle.trim(),
        region_id: region_id === OTHER ? '' : region_id,
        region_name: region_id === OTHER ? region_name.trim() : '',
        dept_code: dept_code === OTHER ? '' : dept_code,
        department_name: dept_code === OTHER ? department_name.trim() : '',
      });
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
            <div style={{color:'#fff',fontWeight:700,fontSize:16,fontFamily:'Space Grotesk,sans-serif'}}>YISD-DUE-LEDGER</div>
            <div style={{color:'rgba(255,255,255,.55)',fontSize:11}}>Youth Information Department</div>
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
              <label className="form-label" htmlFor="su-first">First Name *</label>
              <input id="su-first" type="text" placeholder="John" value={firstName}
                onChange={e => setFirstName(e.target.value)} autoComplete="given-name" required/>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="su-surname">Surname *</label>
              <input id="su-surname" type="text" placeholder="Doe" value={surname}
                onChange={e => setSurname(e.target.value)} autoComplete="family-name" required/>
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
              <label className="form-label" htmlFor="su-role">Role <span style={{fontWeight:400,textTransform:'none',letterSpacing:0}}>(optional)</span></label>
              <input id="su-role" type="text" placeholder="e.g. Protocol, Usher, Writer" value={roleTitle}
                onChange={e => setRoleTitle(e.target.value)} maxLength={60}/>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="su-region">Region *</label>
              <select id="su-region" value={region_id}
                onChange={e => { setRegionId(e.target.value); if (e.target.value !== OTHER) setRegionName(''); }}
                required disabled={regionsLoading} aria-invalid={!!regionsError}>
                <option value="">{regionsLoading ? 'Loading regions…' : 'Select your region'}</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                <option value={OTHER}>Other…</option>
              </select>
              {region_id === OTHER && (
                <input id="su-region-other" type="text" placeholder="Enter your region"
                  value={region_name} onChange={e => setRegionName(e.target.value)}
                  style={{marginTop:8}} required aria-label="Custom region name"/>
              )}
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
              <select id="su-dept" value={dept_code}
                onChange={e => { setDeptCode(e.target.value); if (e.target.value !== OTHER) setDepartmentName(''); }}
                required disabled={departmentsLoading} aria-invalid={!!departmentsError}>
                <option value="">{departmentsLoading ? 'Loading departments…' : 'Select your department'}</option>
                {departments.map(d => <option key={d.id} value={d.code}>{d.name}</option>)}
                <option value={OTHER}>Other…</option>
              </select>
              {dept_code === OTHER && (
                <input id="su-dept-other" type="text" placeholder="Enter your department"
                  value={department_name} onChange={e => setDepartmentName(e.target.value)}
                  style={{marginTop:8}} required aria-label="Custom department name"/>
              )}
              {departmentsError && (
                <div className="form-error" role="alert" style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                  <span>{departmentsError}</span>
                  <button type="button" onClick={loadDepartments}
                    style={{background:'none',border:'none',color:'var(--green-700)',fontWeight:700,cursor:'pointer',fontSize:13,textDecoration:'underline'}}>
                    Retry
                  </button>
                </div>
              )}
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
