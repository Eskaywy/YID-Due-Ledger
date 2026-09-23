/**
 * routes/oauth.js — OAuth 2.0 / OpenID Connect Authorization Server
 *
 * Provides a complete authorization-code flow with a consent screen:
 *   GET  /oauth/authorize          — entry point (validates client → consent)
 *   GET  /oauth/consent            — consent screen (login form if unauth)
 *   POST /oauth/consent            — handles login / approve / deny
 *   POST /oauth/login              — programmatic login (sets JWT cookie)
 *   POST /oauth/token              — exchange auth code for access token
 *   GET  /oauth/userinfo           — protected user info endpoint
 *   GET  /oauth/callback           — callback handler (end-to-end testing)
 *   GET  /oauth/.well-known/openid-configuration
 *   GET  /oauth/.well-known/jwks.json
 *   GET  /oauth/logout
 *
 * Clients, users, and auth codes are in-memory for the demo.
 * When real Supabase credentials are present, user lookups fall back
 * to the Supabase `users` table.
 */

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'yid-due-ledger-secret-key-change-in-production';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:' + (process.env.PORT || 3000);

/* ────────────────────── OAuth Client Registry ────────────────────────────── */

const CLIENTS = new Map([
  ['yid-web-app', {
    client_id: 'yid-web-app',
    name: 'YID Due Ledger',
    description: 'Dues Management Platform — Lagos & South-West Region Pilot',
    tagline: 'A secure digitization platform giving every department member instant, transparent access to their financial records.',
    logo: '/logo.svg',
    redirect_uris: [
      'http://localhost:3000/oauth/callback',
      'http://localhost:5173/oauth/callback',
      'http://localhost:3000/callback',
    ],
    scopes: ['openid', 'profile', 'email', 'member_data'],
  }],
  ['yid-mobile-app', {
    client_id: 'yid-mobile-app',
    name: 'YID Due Ledger Mobile',
    description: 'Mobile companion app for on-the-go dues tracking',
    logo: '/logo.svg',
    redirect_uris: ['http://localhost:3000/oauth/callback'],
    scopes: ['openid', 'profile', 'email'],
  }],
]);

/* ─────────────────────────── Demo Users ──────────────────────────────────── */

const DEMO_USERS = [
  {
    id: 'demo-super-admin',
    user_id_code: 'LGS-MED-202506-0001',
    full_name: 'Super Administrator',
    email: 'superadmin@drdp.ng',
    password_hash: '$2a$10$placeholder',
    position: 'Super Administrator',
    role: 'super_admin',
    is_active: true,
  },
  {
    id: 'demo-member',
    user_id_code: 'LGS-MED-202506-0002',
    full_name: 'Adewale Ogundimu',
    email: 'adewale@drdp.ng',
    password_hash: '$2a$10$placeholder',
    position: 'Journalist',
    role: 'member',
    is_active: true,
  },
];

/* Generate bcrypt hashes for demo passwords at startup */
async function initDemoUsers() {
  DEMO_USERS[0].password_hash = await bcrypt.hash('Admin@2025', 10);
  DEMO_USERS[1].password_hash = await bcrypt.hash('Member@2025', 10);
}
initDemoUsers();

/* ────────────────────── Authorization Code Store ─────────────────────────── */

const AUTH_CODES = new Map();
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function storeCode(code, payload) {
  AUTH_CODES.set(code, { ...payload, expires_at: Date.now() + CODE_TTL_MS });
}

function consumeCode(code) {
  const entry = AUTH_CODES.get(code);
  if (!entry) return null;
  if (entry.expires_at < Date.now()) { AUTH_CODES.delete(code); return null; }
  AUTH_CODES.delete(code);
  return entry;
}

/* ────────────────────────── Scope Definitions ────────────────────────────── */

const SCOPE_INFO = {
  openid: { name: 'OpenID Connect', description: 'Authenticate your identity' },
  profile: { name: 'Profile', description: 'View your full name, position, and role' },
  email: { name: 'Email Address', description: 'View your registered email address' },
  member_data: { name: 'Member Data', description: 'View your monthly dues and pledge records' },
};

/* ────────────────── Cookie-based Auth Helper ────────────────────────────── */
async function getOAuthUser(req) {
  const token = req.cookies?.oauth_token;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    try {
      const { supabase } = require('../supabaseAdmin');
      const hasSupa = supabase && process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder');
      if (hasSupa) {
        const { data: user, error } = await supabase.from('users').select('*').eq('id', decoded.userId).single();
        if (!error && user && user.is_active) return user;
      }
    } catch { /* fall through */ }
    const user = DEMO_USERS.find(u => u.id === decoded.userId);
    if (!user || !user.is_active) return null;
    return user;
  } catch { return null; }
}

function validateConsentParams(query) {
  const { client_id, redirect_uri, scope } = query;
  if (!client_id || !redirect_uri) return { error: 'Missing client_id or redirect_uri' };
  const client = CLIENTS.get(client_id);
  if (!client) return { error: 'Unknown client_id' };
  if (!client.redirect_uris.includes(redirect_uri)) return { error: 'redirect_uri does not match client registration' };
  const requestedScopes = (scope || 'openid').split(' ').filter(s => s);
  const invalid = requestedScopes.filter(s => !client.scopes.includes(s));
  if (invalid.length > 0) return { error: 'Unknown scope(s): ' + invalid.join(', ') };
  return { client, client_id, redirect_uri, requestedScopes, state: query.state || '' };
}

async function verifyCredentials(email, password) {
  try {
    const { supabase } = require('../supabaseAdmin');
    const hasSupa = supabase && process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder');
    if (hasSupa) {
      const { data: users, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).eq('is_active', true).limit(1);
      if (!error && users?.length && await bcrypt.compare(password, users[0].password_hash)) return users[0];
    }
  } catch { /* fall through */ }
  const demo = DEMO_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (demo && await bcrypt.compare(password, demo.password_hash)) return demo;
  return null;
}

function getUserInfoById(userId) {
  const demo = DEMO_USERS.find(u => u.id === userId);
  if (demo) return { sub: demo.id, email: demo.email, full_name: demo.full_name, role: demo.role, user_id_code: demo.user_id_code };
  return { sub: userId };
}

async function fetchToken(code, redirect_uri, client_id) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri, client_id }).toString();
    const lib = SERVER_URL.startsWith('https') ? require('https') : require('http');
    const req = lib.request(SERVER_URL + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, (resp) => {
      let data = '';
      resp.on('data', c => { data += c; });
      resp.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* ─── Routes: Authorize & Consent ─── */
router.get('/authorize', async (req, res) => {
  const { response_type } = req.query;
  const v = validateConsentParams(req.query);
  if (v.error) return res.status(400).json({ error: 'invalid_request', error_description: v.error });
  if (response_type !== 'code') return res.status(400).json({ error: 'unsupported_response_type' });
  const user = await getOAuthUser(req);
  const qs = new URLSearchParams({ client_id: v.client_id, redirect_uri: v.redirect_uri, scope: v.requestedScopes.join(' '), state: v.state });
  res.redirect('/oauth/consent?' + qs.toString() + (user ? '&authenticated=true' : ''));
});

router.get('/consent', async (req, res) => {
  const v = validateConsentParams(req.query);
  if (v.error) {
    if (!req.query.client_id && !req.query.redirect_uri) {
      const defaultUri = 'http://localhost:' + (process.env.PORT || 3000) + '/oauth/callback';
      return res.redirect('/oauth/authorize?response_type=code&client_id=yid-web-app&redirect_uri=' + encodeURIComponent(defaultUri) + '&scope=openid%20profile%20email%20member_data&state=');
    }
    return res.status(400).send('<h1 style="color:#ef4444">OAuth Error</h1><p>' + v.error + '</p>');
  }
  const user = await getOAuthUser(req);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderConsentPage({ client: v.client, requestedScopes: v.requestedScopes, state: v.state, isAuthenticated: !!user, user, error: req.query.error }));
});

router.post('/consent', async (req, res) => {
  const { client_id, redirect_uri, scope, state, action } = req.body;
  const client = CLIENTS.get(client_id);
  if (!client) return res.status(400).json({ error: 'Unknown client' });
  if (!client.redirect_uris.includes(redirect_uri)) return res.status(400).json({ error: 'redirect_uri mismatch' });
  const requestedScopes = (scope || 'openid').split(' ').filter(s => s);
  const qsBase = '?client_id=' + encodeURIComponent(client_id) + '&redirect_uri=' + encodeURIComponent(redirect_uri) + '&scope=' + encodeURIComponent(requestedScopes.join(' '));

  if (action === 'login' || req.body.email) {
    const user = await verifyCredentials(req.body.email, req.body.password);
    if (!user) return res.redirect(qsBase + '&state=' + encodeURIComponent(state || '') + '&error=invalid_credentials');
    const token = jwt.sign({ sub: user.id, userId: user.id }, JWT_SECRET, { expiresIn: '8h' });
    res.cookie('oauth_token', token, { httpOnly: true, maxAge: 8 * 60 * 60 * 1000, sameSite: 'lax', path: '/oauth' });
    return res.redirect(qsBase + '&state=' + encodeURIComponent(state || '') + '&authenticated=true');
  }

  if (action === 'approve' || req.body.consent === 'approve') {
    const user = await getOAuthUser(req);
    if (!user) return res.redirect(qsBase + '&state=' + encodeURIComponent(state || '') + '&error=login_required');
    const code = crypto.randomBytes(32).toString('hex');
    storeCode(code, { client_id, redirect_uri, scope: requestedScopes.join(' '), user_id: user.id });
    let url = redirect_uri + '?code=' + code;
    if (state) url += '&state=' + encodeURIComponent(state);
    return res.redirect(url);
  }

  if (action === 'deny' || req.body.consent === 'deny') {
    let url = redirect_uri + '?error=access_denied';
    if (state) url += '&state=' + encodeURIComponent(state);
    return res.redirect(url);
  }
    res.status(400).json({ error: 'Invalid form submission' });
});

/* ─── Routes: Login (API), Token, UserInfo, Callback ─── */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = await verifyCredentials(email, password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ sub: user.id, userId: user.id }, JWT_SECRET, { expiresIn: '8h' });
  res.cookie('oauth_token', token, { httpOnly: true, maxAge: 8 * 60 * 60 * 1000, sameSite: 'lax', path: '/oauth' });
  res.json({ access_token: token, token_type: 'Bearer', expires_in: 8 * 60 * 60, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, user_id_code: user.user_id_code } });
});

router.post('/token', (req, res) => {
  const { grant_type, code, redirect_uri, client_id } = req.body;
  if (grant_type !== 'authorization_code') return res.status(400).json({ error: 'unsupported_grant_type' });
  if (!code || !client_id) return res.status(400).json({ error: 'invalid_request' });
  const client = CLIENTS.get(client_id);
  if (!client) return res.status(401).json({ error: 'invalid_client' });
  const stored = consumeCode(code);
  if (!stored) return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid, expired, or already-used code' });
  if (stored.client_id !== client_id) return res.status(401).json({ error: 'invalid_client' });
  if (stored.redirect_uri !== redirect_uri) return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
  const accessToken = jwt.sign({ sub: stored.user_id, client_id: stored.client_id, scope: stored.scope }, JWT_SECRET, { expiresIn: '8h' });
  const userInfo = getUserInfoById(stored.user_id);
  res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 8 * 60 * 60, scope: stored.scope, user: userInfo });
});

router.get('/userinfo', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'invalid_token' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    const info = getUserInfoById(decoded.sub);
    Object.assign(info, { client_id: decoded.client_id, scope: decoded.scope });
    res.json(info);
  } catch { res.status(401).json({ error: 'invalid_token' }); }
});

router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) return res.send('<h1>OAuth Error</h1><p><strong>' + error + ':</strong> ' + (error_description || 'Access denied') + '</p>');
  if (!code) return res.send('<h1>Missing Code</h1><p>No authorization code was returned.</p>');
  let tokenData, tokenError;
  try { tokenData = await fetchToken(code, 'http://localhost:3000/oauth/callback', 'yid-web-app'); } catch (e) { tokenError = e.message; }
  if (tokenError || !tokenData) return res.send('<h1>Token Exchange Failed</h1><p>' + (tokenError || 'Unknown error') + '</p>');
  const { access_token, token_type, expires_in, user } = tokenData;
  let payload = {};
  try { payload = JSON.parse(Buffer.from(access_token.split('.')[1], 'base64').toString()); } catch { }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderCallbackPage({ code, state: state || '', access_token, token_type, expires_in, user, payload }));
});

router.get('/.well-known/openid-configuration', (req, res) => {
  const base = 'http://' + req.headers.host;
  res.json({
    issuer: base, authorization_endpoint: base + '/oauth/authorize',
    token_endpoint: base + '/oauth/token', userinfo_endpoint: base + '/oauth/userinfo',
    jwks_uri: base + '/oauth/.well-known/jwks.json', end_session_endpoint: base + '/oauth/logout',
    response_types_supported: ['code'], grant_types_supported: ['authorization_code'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    id_token_signing_alg_values_supported: ['HS256'], scopes_supported: ['openid', 'profile', 'email', 'member_data'],
    code_challenge_methods_supported: ['plain'],
    claims_supported: ['sub', 'email', 'full_name', 'role', 'user_id_code', 'position'],
  });
});
router.get('/.well-known/jwks.json', (req, res) => res.json({ keys: [] }));
router.get('/logout', (req, res) => { res.clearCookie('oauth_token', { path: '/oauth' }); res.redirect('/oauth/consent'); });

/* ─── HTML Rendering ─── */

function renderConsentPage({ client, requestedScopes, state, isAuthenticated, user, error }) {
  const scopeBadges = requestedScopes.map(s => {
    const info = SCOPE_INFO[s] || { name: s };
    return '<div class="scope-pill"><span class="scope-pill-dot"></span>' + info.name + '</div>';
  }).join('');
  const scopeDetails = requestedScopes.map(s => {
    const info = SCOPE_INFO[s] || { name: s, description: '' };
    return '<div class="scope-row"><div class="scope-icon">' + info.name.charAt(0) + '</div><div class="scope-col"><div class="scope-name">' + info.name + '</div><div class="scope-desc">' + info.description + '</div></div></div>';
  }).join('');
  const hiddenFields = '<input type="hidden" name="client_id" value="' + client.client_id + '">' +
    '<input type="hidden" name="redirect_uri" value="' + client.redirect_uris[0] + '">' +
    '<input type="hidden" name="scope" value="' + requestedScopes.join(' ') + '">' +
    '<input type="hidden" name="state" value="' + (state || '') + '">';
  const errorBanner = error ? '<div class="error-banner">' +
    (error === 'invalid_credentials' ? 'Invalid email or password. Please try again.' :
     error === 'login_required' ? 'You need to sign in to continue.' : 'An error occurred.') + '</div>' : '';
  const clientCard = '<div class="client-card"><div class="client-header"><img class="client-logo" src="/logo.svg" alt=""><div><div class="client-name">' + client.name + '</div><div class="client-tag">OAuth Client</div></div></div>' +
    '<div class="client-desc">' + client.description + '</div></div>';

  let body = '';
  if (!isAuthenticated) {
    body = '<div class="login-section"><h2 class="section-title">Sign in to continue</h2>' +
      '<p class="section-desc">You\'re signing into "' + client.name + '". Enter your credentials to proceed.</p>' +
      errorBanner +
      '<form method="POST" action="/oauth/consent"><input type="hidden" name="action" value="login">' + hiddenFields +
      '<div class="form-group"><label class="form-label">Email Address</label>' +
      '<input type="email" name="email" placeholder="you@example.com" required autocomplete="email" class="form-input"></div>' +
      '<div class="form-group"><label class="form-label">Password</label>' +
      '<input type="password" name="password" placeholder="Enter your password" required autocomplete="current-password" class="form-input"></div>' +
      '<button type="submit" class="btn btn-primary btn-lg">Sign In &amp; Continue</button></form>' +
      '<div class="demo-creds"><div class="demo-creds-title">Demo Credentials</div>' +
      '<div class="demo-cred-row"><code>superadmin@drdp.ng</code> / <code>Admin@2025</code></div>' +
      '<div class="demo-cred-row"><code>adewale@drdp.ng</code> / <code>Member@2025</code></div></div></div>';
  }

  const consentForm = isAuthenticated ? '<form method="POST" action="/oauth/consent">' +
    '<input type="hidden" name="action" value="approve">' + hiddenFields +
    '<div class="actions-row"><button type="submit" class="btn btn-approve">✓ Allow Access</button>' +
    '<button type="submit" name="consent" value="deny" class="btn btn-deny">✕ Deny</button></div></form>' +
    '<div class="user-signed-in"><span class="user-avatar">' + user.full_name.charAt(0).toUpperCase() +
    '</span><span class="user-name">' + user.full_name + '</span><span class="user-email">' + user.email + '</span></div>' : '';

  const midContent = isAuthenticated
    ? (clientCard + '<h2 class="section-title">Permissions Requested</h2>' +
      '<p class="section-desc">This application is requesting access to the following information:</p>' +
      '<div class="scope-list">' + scopeDetails + '</div>' + consentForm)
    : (clientCard + '<h2 class="section-title">Permissions Requested</h2>' +
      '<p class="section-desc">After signing in, ' + client.name + ' will ask you to grant access to:</p>' +
      '<div class="scope-pills">' + scopeBadges + '</div>');

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + (isAuthenticated ? 'Consent Required' : 'Sign In — OAuth') + ' — YID Due Ledger</title>\n' +
    renderConsentCSS() + '\n</head>\n<body>\n<div class="consent-card">\n' +
    '<div class="consent-header"><img class="app-logo" src="/logo.svg" alt=""><span class="app-title">YID Due Ledger</span></div>\n' +
    '<div class="consent-body">\n<div class="left-col">\n' +
    (isAuthenticated ? '' : body) + '\n' + midContent + '\n</div>\n' +
    '<div class="right-col">\n' + clientCard + '\n</div>\n</div>\n</div>\n' +
    '</body>\n</html>';
}

function renderConsentCSS() {
  return '<style>\n* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { background: #0f172a; color: #e2e8f0; font-family: \'Inter\', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }\n.consent-card { background: #1e293b; border: 1px solid #334155; border-radius: 14px; width: 100%; max-width: 900px; box-shadow: 0 20px 60px rgba(0,0,0,.4); }\n.consent-header { display: flex; align-items: center; gap: 12px; padding: 20px 24px; border-bottom: 1px solid #334155; }\n.app-logo { width: 40px; height: 40px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }\n.app-title { font-size: 18px; font-weight: 700; color: #fff; font-family: \'Space Grotesk\', sans-serif; }\n.consent-body { display: flex; gap: 24px; padding: 24px; }\n@media (max-width: 700px) { .consent-body { flex-direction: column; gap: 16px; padding: 20px; } }\n.left-col { flex: 1; min-width: 0; }\n.right-col { flex: 0 0 320px; display: flex; flex-direction: column; gap: 16px; }\n@media (max-width: 700px) { .right-col { flex: 0 0 auto; } }\n.section-title { font-size: 16px; font-weight: 600; color: #f1f5f9; margin-bottom: 8px; }\n.section-desc { color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 16px; }\n.client-card { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 16px; }\n.client-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }\n.client-logo { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }\n.client-name { font-size: 15px; font-weight: 600; color: #f1f5f9; }\n.client-desc { color: #94a3b8; font-size: 12px; line-height: 1.4; }\n.scope-list { display: flex; flex-direction: column; gap: 10px; }\n.scope-row { display: flex; align-items: flex-start; gap: 10px; }\n.scope-icon { width: 32px; height: 32px; background: #3b82f6; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #fff; flex-shrink: 0; }\n.scope-col { flex: 1; }\n.scope-name { font-size: 13px; font-weight: 600; color: #f1f5f9; }\n.scope-desc { color: #94a3b8; font-size: 12px; line-height: 1.4; }\n.scope-pills { display: flex; flex-wrap: gap: 6px; }\n.scope-pill { background: rgba(14,165,233,.15); border: 1px solid rgba(14,165,233,.3); border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 500; color: #38bdf8; }\n.form-group { margin-bottom: 16px; }\n.form-label { display: block; font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }\n.form-input { width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 14px; outline: none; }\n.form-input:focus { border-color: #22c55e; }\n.btn { padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; font-size: 15px; display: inline-flex; align-items: center; gap: 8px; }\n.btn:hover { opacity: .9; }\n.btn-lg { width: 100%; }\n.btn-primary { background: #22c55e; color: #fff; }\n.btn-approve { background: #22c55e; color: #fff; flex: 1; }\n.btn-deny { background: #ef4444; color: #fff; flex: 1; }\n.actions-row { display: flex; gap: 12px; margin-top: 8px; }\n.error-banner { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }\n.demo-creds { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px; margin-top: 16px; }\n.demo-creds-title { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }\n.demo-cred-row { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 4px; }\n.client-tag { font-size: 11px; color: #22c55e; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; margin-top: 2px; }\n.user-signed-in { display: flex; align-items: center; gap: 8px; padding-top: 8px; border-top: 1px solid #334155; margin-top: 16px; }\n.user-avatar { width: 28px; height: 28px; background: linear-gradient(135deg,#22c55e,#16a34a); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0; }\n.user-name { font-size: 13px; font-weight: 600; color: #f1f5f9; }\n.user-email { font-size: 12px; color: #94a3b8; }\n</style>';
}

function renderCallbackPage({ code, state, access_token, token_type, expires_in, user, payload }) {
  const payloadStr = JSON.stringify(payload || {}, null, 2);
  const u = user || {};
  const exp = expires_in || 28800;
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>OAuth Callback — YID Due Ledger</title>\n<style>\n* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { background: #0f172a; color: #e2e8f0; font-family: \'Inter\', sans-serif; min-height: 100vh; padding: 40px 16px; }\n.container { max-width: 800px; margin: 0 auto; }\n.header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }\n.logo { width: 40px; height: 40px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }\nh1 { font-size: 24px; font-weight: 700; color: #f1f5f9; }\n.card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 16px; }\n.success-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(34,197,94,.15); color: #4ade80; border-radius: 999px; padding: 4px 12px; font-size: 13px; font-weight: 600; }\n.info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; }\n.info-label { color: #94a3b8; font-size: 13px; }\n.info-value { color: #e2e8f0; font-size: 13px; font-family: \'Courier New\', monospace; word-break: break-all; }\n.code-block { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-top: 12px; overflow-x: auto; }\n.code-text { color: #4ade80; font-size: 13px; font-family: \'Courier New\', monospace; line-height: 1.6; }\n.user-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }\n@media (max-width: 600px) { .user-grid { grid-template-columns: 1fr; } }\n.back-link { display: inline-block; margin-top: 16px; color: #38bdf8; text-decoration: none; font-size: 13px; }\n.back-link:hover { text-decoration: underline; }\n</style>\n</head>\n<body>\n<div class="container">\n<div class="header"><img class="logo" src="/logo.svg" alt=""><h1>OAuth Flow Complete</h1></div>\n<div class="card"><span class="success-badge">✓ Access Granted</span><p style="margin-top:12px;color:#94a3b8;font-size:14px;">The authorization code was successfully exchanged for an access token.</p></div>\n<div class="card"><h2 style="color:#e2e8f0;font-size:16px;margin-bottom:12px;">Authorization Code</h2><div class="code-block"><div class="code-text">code=' + code + '&amp;state=' + (state || '') + '</div></div></div>\n<div class="card"><h2 style="color:#e2e8f0;font-size:16px;margin-bottom:12px;">Access Token</h2><div class="code-block"><div class="code-text">' + access_token + '</div></div><div class="info-row"><span class="info-label">Token Type</span><span class="info-value">' + (token_type || 'Bearer') + '</span></div><div class="info-row"><span class="info-label">Expires In</span><span class="info-value">' + exp + ' seconds (' + Math.round(exp / 3600) + ' hours)</span></div></div>\n<div class="card"><h2 style="color:#e2e8f0;font-size:16px;margin-bottom:12px;">User Information</h2><div class="user-grid"><div class="info-row"><span class="info-label">User ID</span><span class="info-value">' + (u.sub || '—') + '</span></div><div class="info-row"><span class="info-label">Email</span><span class="info-value">' + (u.email || '—') + '</span></div><div class="info-row"><span class="info-label">Full Name</span><span class="info-value">' + (u.full_name || '—') + '</span></div><div class="info-row"><span class="info-label">Role</span><span class="info-value">' + (u.role || '—') + '</span></div><div class="info-row"><span class="info-label">Member ID Code</span><span class="info-value">' + (u.user_id_code || '—') + '</span></div><div class="info-row"><span class="info-label">Client ID</span><span class="info-value">yid-web-app</span></div></div></div>\n<div class="card"><h2 style="color:#e2e8f0;font-size:16px;margin-bottom:12px;">JWT Payload (decoded)</h2><div class="code-block"><pre class="code-text">' + payloadStr + '</pre></div></div>\n<a href="/oauth/consent" class="back-link">← Back to consent page</a>\n</div>\n</body>\n</html>';
}

module.exports = router;