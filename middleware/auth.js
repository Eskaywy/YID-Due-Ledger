const jwt = require('jsonwebtoken');
const { supabase } = require('../supabaseAdmin');

const JWT_SECRET = process.env.JWT_SECRET || 'yid-due-ledger-secret-key-change-in-production';

// Verify the JWT, then load the user from Supabase.
// req.user is set to the raw user row (snake_case fields, includes id/role/is_active).
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();
    if (error || !user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = user;

    // Accounts that still carry an admin-issued temp password must change it
    // before any other authenticated action. Keep the read-only profile
    // endpoint and the change endpoint itself reachable so the client can
    // detect the flag and complete the change.
    if (req.user.must_change_password === true) {
      const isMe = req.method === 'GET' && req.originalUrl.includes('/auth/me');
      const isChange = req.method === 'PUT' && req.originalUrl.includes('/auth/change-password');
      if (!isMe && !isChange) {
        return res.status(403).json({ error: 'Password change required before continuing', code: 'PASSWORD_CHANGE_REQUIRED' });
      }
    }

    next();
  } catch (err) {
    if (err?.name === 'TokenExpiredError') return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

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
