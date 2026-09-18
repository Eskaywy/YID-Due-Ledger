/**
 * End-to-end preview check: verifies frontend dev server, Vite->backend proxy,
 * a real Firestore-backed API endpoint, and live database state.
 * Run with:  node preview-check.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const out = [];
const get = async (url, timeoutMs = 8000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const body = await r.text();
    return { status: r.status, body: body.slice(0, 300) };
  } finally { clearTimeout(t); }
};

(async () => {
  // 1. Frontend (Vite dev server)
  try {
    const r = await get('http://localhost:5173');
    out.push('1. FRONTEND http://localhost:5173 -> HTTP ' + r.status + (r.status === 200 ? ' (serving app)' : ''));
  } catch (e) { out.push('1. FRONTEND http://localhost:5173 -> DOWN (' + e.message + ')'); }

  // 2. Vite proxy -> backend health (the path the app itself uses)
  try {
    const r = await get('http://localhost:5173/api/health');
    out.push('2. PROXY   /api/health via Vite -> HTTP ' + r.status + ' ' + r.body);
  } catch (e) { out.push('2. PROXY   /api/health via Vite -> FAILED (' + e.message + ')'); }

  // 3. Public API endpoint backed by real Firestore data
  try {
    const r = await get('http://localhost:3001/api/auth/regions');
    out.push('3. API     GET /api/auth/regions -> HTTP ' + r.status + ' body: ' + r.body);
  } catch (e) { out.push('3. API     GET /api/auth/regions -> FAILED (' + e.message + ')'); }

  // 4. Live Firestore state (collections after boot-time seeding)
  try {
        const { db } = require(path.join(ROOT, 'firebaseAdmin.js'));
    const cols = await db.listCollections();
    const names = [];
    for (const c of cols) {
      const s = await c.limit(1).get();
      names.push(c.id + (s.size ? '[has data]' : '[empty]'));
    }
    out.push('4. FIREBASE collections now: ' + names.join(', '));
  } catch (e) { out.push('4. FIREBASE state check FAILED: ' + e.message); }

  const text = out.join('\n');
    fs.writeFileSync(path.join(ROOT, 'preview-check.txt'), text);
  console.log(text);
})();
