/**
 * End-to-end preview check: verifies frontend dev server, Vite->backend proxy,
 * and a live Supabase-backed API endpoint.
 * Run with:  node scripts/preview-check.js
 */
const http = require('http');

const get = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  }).on('error', reject);
});

(async () => {
  const out = [];

  // 1. Backend direct
  try {
    const r = await get('http://localhost:3000/api/health');
    out.push(r.status === 200 ? '1. BACKEND http://localhost:3000/api/health -> OK' : `1. BACKEND -> HTTP ${r.status}`);
  } catch (e) { out.push('1. BACKEND /api/health direct -> FAILED (' + e.message + ')'); }

  // 2. Vite dev server + proxy
  try {
    const r = await get('http://localhost:5173/api/health');
    out.push(r.status === 200 ? '2. PROXY   /api/health via Vite (:5173 → :3000) -> OK' : `2. PROXY   -> HTTP ${r.status}`);
  } catch (e) { out.push('2. PROXY   /api/health via Vite -> FAILED (' + e.message + ')'); }

  // 3. Public API endpoint backed by real Supabase data
  try {
    const r = await get('http://localhost:3000/api/auth/regions');
    out.push(r.status === 200 ? '3. API     GET /api/auth/regions -> OK (' + r.body.slice(0, 80) + ')' : `3. API     -> HTTP ${r.status}`);
  } catch (e) { out.push('3. API     GET /api/auth/regions -> FAILED (' + e.message + ')'); }

  console.log(out.join('\n'));
  if (out.some(l => l.includes('FAILED'))) process.exitCode = 1;
})();
