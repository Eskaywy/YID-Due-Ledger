/**
 * Preflight check: verifies project files, loads every server module, and
 * pings the live Firebase project (read-only) to prove real connectivity.
 * Run with:  node preflight-check.js
 */
const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
  'server.js', 'db.js', 'firebaseAdmin.js', 'package.json',
  'firebase.json', 'firestore.indexes.json', 'serviceAccountKey.json',
  'middleware/auth.js', 'middleware/audit.js',
  'routes/auth.js', 'routes/members.js', 'routes/admin.js', 'routes/records.js',
  'frontend/package.json', 'frontend/vite.config.js', 'frontend/index.html',
  'frontend/src/utils/firebase.js', 'frontend/src/utils/api.js',
];

let failures = 0;
const fail = (msg) => { failures++; console.error('FAIL ' + msg); };
const withTimeout = (p, ms, label) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)),
]);

console.log('--- 1. Required files ---');
for (const f of REQUIRED_FILES) {
  if (fs.existsSync(path.join(__dirname, f))) console.log('OK   ' + f);
  else fail(f + '  (MISSING FILE)');
}

console.log('\n--- 2. Module loading (require every server module) ---');
const MODULES = [
  './firebaseAdmin.js', './db.js',
  './middleware/auth.js', './middleware/audit.js',
  './routes/auth.js', './routes/members.js', './routes/admin.js', './routes/records.js',
];
for (const m of MODULES) {
  try { require(m); console.log('OK   ' + m); }
  catch (e) { fail(m + '  -> ' + e.message); }
}

console.log('\n--- 3. Live Firebase connection (read-only) ---');
// firebaseAdmin.js is cached from section 2, so this reuses the same app instance.
const { db, auth } = require('./firebaseAdmin');

(async () => {
  try {
    const cols = await withTimeout(db.listCollections(), 20000, 'Firestore listCollections');
    console.log('OK   Firestore reachable - collections: ' + (cols.map(c => c.id).join(', ') || '(empty database)'));
  } catch (e) { fail('Firestore listCollections -> ' + e.message); }

  try {
    const snap = await withTimeout(db.collection('regions').limit(1).get(), 20000, 'Firestore regions read');
    console.log('OK   Firestore regions query returned ' + snap.size + ' doc(s) (seed data present: ' + (snap.size > 0) + ')');
  } catch (e) { fail('Firestore regions read -> ' + e.message); }

  try {
    const res = await withTimeout(auth.listUsers(1), 20000, 'Firebase Auth listUsers');
    console.log('OK   Firebase Auth reachable - ' + res.users.length + ' user(s) visible');
  } catch (e) { fail('Firebase Auth listUsers -> ' + e.message); }

  console.log('\n===== RESULT: ' + (failures === 0 ? 'ALL CHECKS PASSED ✓' : failures + ' CHECK(S) FAILED ✗') + ' =====');
  process.exit(failures === 0 ? 0 : 1);
})();
