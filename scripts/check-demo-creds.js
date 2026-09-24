#!/usr/bin/env node
/**
 * CI gate: fail the build if well-known demo credentials leak into shipped
 * artifacts or web-served pages (approved plan Sprint 0 / §6).
 *
 * Scans:
 *   1. The built frontend (frontend/dist) — what browsers download.
 *   2. consent-page.html — the standalone OAuth page.
 *   3. routes/oauth.js — must not contain plaintext demo passwords in the
 *      production code path (the DEMO_USERS block must stay behind the
 *      DEMO_MODE_ENABLED gate).
 *
 * Exit code 1 on any hit so CI/CD (and `npm run build`) fails loudly.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FORBIDDEN = [
  'Admin@2025',
  'Member@2025',
  'superadmin@drdp.ng',
  'adewale@drdp.ng',
  'Demo Credentials',
];

const hits = [];

function scanFile(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return;
  let content;
  try {
    content = fs.readFileSync(abs, 'utf8');
  } catch {
    return;
  }
  for (const needle of FORBIDDEN) {
    if (content.includes(needle)) {
      hits.push(`${relPath}  →  "${needle}"`);
    }
  }
}

function scanDir(relDir) {
  const abs = path.join(ROOT, relDir);
  if (!fs.existsSync(abs)) return;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(html?|js|mjs|css|json|svg|txt|md)$/i.test(entry.name)) {
        scanFile(path.relative(ROOT, full));
      }
    }
  };
  walk(abs);
}

// 1. Built frontend (the actual production artifact).
scanDir(path.join('frontend', 'dist'));
// 2. Standalone OAuth consent page.
scanFile('consent-page.html');
// 3. OAuth route source.
scanFile('db.js');
scanFile(path.join('routes', 'oauth.js'));
scanFile(path.join('routes', 'auth.js'));
scanFile('README.md');

if (hits.length > 0) {
  console.error('\n✗ DEMO CREDENTIAL GATE FAILED — demo credentials found in shipped files:\n');
  for (const h of hits) console.error('   • ' + h);
  console.error('\nRemove the reference or gate it behind DEMO_MODE (non-production only).\n');
  process.exit(1);
}

console.log('✓ Demo credential gate passed — no demo credentials in shipped files.');
