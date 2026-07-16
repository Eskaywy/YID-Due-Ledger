const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'yid-due-ledger-secret-key-change-in-production';

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    const rows = db.exec('SELECT * FROM users WHERE id=? AND is_active=1', [decoded.userId]);
    if (!rows[0]?.values?.length) return res.status(401).json({ error: 'User not found or inactive' });
    const cols = rows[0].columns;
    req.user = {};
    cols.forEach((c, i) => req.user[c] = rows[0].values[0][i]);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Only super_admin can access admin routes
function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin access required' });
  next();
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '8h' });
}

module.exports = { authenticate, requireSuperAdmin, generateToken };
