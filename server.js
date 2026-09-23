require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Behind Vercel / reverse proxies so rate limits see the real client IP.
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Friendly JSON body on 429s so the frontend can surface it (audit H4).
const limitOpts = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
};
// Strict cap only on login attempts. Everything else under /api/auth
// (including /auth/me, fired on every page load) shares a generous bucket so
// refreshes can't lock users out (audit H4).
app.use('/api/auth/login', rateLimit({ ...limitOpts, max: 20 }));
app.use('/api/', rateLimit({ ...limitOpts, max: 300 }));
app.use('/api/auth/', rateLimit({ ...limitOpts, max: 300 }));

app.use(cookieParser());

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/members', require('./routes/members'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/records', require('./routes/records'));
app.use('/oauth',       require('./routes/oauth'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Skip static file serving when running on Vercel — the frontend is served
// by Vercel's static build (CDN), not by this Express app.
const isVercel = process.env.VERCEL === 'true';

// Only serve static files when this file is run directly (node server.js),
// not when it's required as a module by Vercel.
// In that environment, the Vercel CDN serves the frontend, and this Express
// app only handles /api/* requests.
const isMainModule = require.main === module;
if ((process.env.NODE_ENV === 'production' || !process.env.NODE_ENV) && !isVercel && isMainModule) {
  const distPath = path.join(__dirname, 'frontend', 'dist');
  app.use(express.static(distPath));
  // Use a param-less catch-all for newer express
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Initialize the database (Supabase seed). Runs once on cold-start / app start;
// idempotent because it checks for existing data before seeding.
initDatabase().catch(err => {
  console.error('DB init failed:', err);
  console.warn('Server starting without database — DB-dependent routes will return errors.');
});

// Export the Express app so it can be consumed by the Vercel serverless
// function (api/index.js). When run directly via `node server.js`, start the
// HTTP listener for local development and production (self-hosted) mode.
if (require.main === module) {
  app.listen(PORT, () => console.log(`YID Due Ledger running on http://localhost:${PORT}`));
}

module.exports = app;
