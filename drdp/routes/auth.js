const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase, generateUserId } = require('../db');
const { authenticate, generateToken } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = getDb();
    const rows = db.exec(`
      SELECT u.*, r.name as region_name, r.code as region_code
      FROM users u LEFT JOIN regions r ON u.region_id = r.id
      WHERE u.email=? AND u.is_active=1`, [email.toLowerCase().trim()]);

    if (!rows[0]?.values?.length) return res.status(401).json({ error: 'Invalid email or password' });

    const cols = rows[0].columns;
    const user = {};
    cols.forEach((c, i) => user[c] = rows[0].values[0][i]);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateToken(user.id);
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, (req, res) => {
  try {
    const db = getDb();
    const rows = db.exec(`
      SELECT u.id, u.user_id_code, u.full_name, u.email, u.position, u.role, u.dept_code, u.is_active, u.created_at,
             r.name as region_name, r.code as region_code, r.id as region_id
      FROM users u LEFT JOIN regions r ON u.region_id = r.id
      WHERE u.id=?`, [req.user.id]);
    if (!rows[0]?.values?.length) return res.status(404).json({ error: 'User not found' });
    const cols = rows[0].columns;
    const user = {};
    cols.forEach((c, i) => user[c] = rows[0].values[0][i]);
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const db = getDb();
    const rows = db.exec('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
    const hash = rows[0]?.values[0][0];
    const valid = await bcrypt.compare(currentPassword, hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    db.run("UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?", [newHash, req.user.id]);
    saveDatabase();
    auditLog(req.user.id, 'CHANGE_PASSWORD', 'users', req.user.id, null, null);
    res.json({ message: 'Password updated successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
