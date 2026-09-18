const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/members', require('./routes/members'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/records', require('./routes/records'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

if (process.env.NODE_ENV === 'production' || !process.env.NODE_ENV) {
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

// Initialize the database (Firestore seed). Runs once on cold-start / app start;
// idempotent because it checks for existing data before seeding.
initDatabase().catch(err => {
  console.error('DB init failed:', err);
  if (require.main === module) process.exit(1);
});

// Export the Express app so it can be consumed by Firebase Cloud Functions
// (functions/index.js). When run directly via `node server.js`, start the
// HTTP listener for local development and production (self-hosted) mode.
if (require.main === module) {
  app.listen(PORT, () => console.log(`YID Due Ledger running on http://localhost:${PORT}`));
}

module.exports = app;
