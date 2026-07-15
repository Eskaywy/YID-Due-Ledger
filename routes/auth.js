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

router.post('/signup', async (req, res) => {
  try {
    const { full_name, email, password, position, region_id } = req.body;
    
    // Validate required fields
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const db = getDb();
    
    // Check if email already exists
    const existingEmail = db.exec('SELECT id FROM users WHERE email=?', [email.toLowerCase().trim()]);
    if (existingEmail[0]?.values?.length) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create new user
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Get default region if not provided (Lagos region)
    let finalRegionId = region_id;
    if (!finalRegionId) {
      const defaultRegion = db.exec('SELECT id FROM regions WHERE code=?', ['LGS']);
      if (defaultRegion[0]?.values?.length) {
        finalRegionId = defaultRegion[0].values[0][0];
      }
    }
    
    // Generate user ID code
    const user_id_code = generateUserId('LGS', 'MED'); // Default LGS MED for now
    
    db.run(`
      INSERT INTO users (id, user_id_code, full_name, email, password_hash, position, region_id, dept_code, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'member', 1)
    `, [userId, user_id_code, full_name.trim(), email.toLowerCase().trim(), passwordHash, position || null, finalRegionId, 'MED']);
    
    saveDatabase();
    
    // Auto login after signup
    const rows = db.exec(`
      SELECT u.*, r.name as region_name, r.code as region_code
      FROM users u LEFT JOIN regions r ON u.region_id = r.id
      WHERE u.id=?`, [userId]);
      
    const cols = rows[0].columns;
    const user = {};
    cols.forEach((c, i) => user[c] = rows[0].values[0][i]);
    
    const token = generateToken(user.id);
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
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
