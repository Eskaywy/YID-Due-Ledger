const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb, saveDatabase, generateUserId } = require('../db');
const { authenticate, generateToken } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// Setup multer for profile picture uploads
const uploadDir = path.join(__dirname, '..', 'uploads', 'profiles');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed'));
    } else {
      cb(null, true);
    }
  }
});

// Public endpoint to get regions for signup
router.get('/regions', (req, res) => {
  try {
    const db = getDb();
    const rows = db.exec('SELECT id, name, code FROM regions ORDER BY name');
    const regions = [];
    if (rows[0]?.values?.length) {
      rows[0].values.forEach(val => {
        regions.push({
          id: val[0],
          name: val[1],
          code: val[2]
        });
      });
    }
    res.json(regions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { full_name, email, password, position, region_id, dept_code } = req.body;
    if (!full_name || !email || !password || !position || !region_id || !dept_code) {
      return res.status(400).json({ error: 'Full name, email, password, position, region, and department code are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const db = getDb();
    
    // Check if email already exists
    if (db.exec('SELECT id FROM users WHERE email=?', [email.toLowerCase().trim()])[0]?.values?.length) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Verify region exists
    const regionRows = db.exec('SELECT code FROM regions WHERE id=?', [region_id]);
    if (!regionRows[0]?.values?.length) {
      return res.status(400).json({ error: 'Invalid region selected' });
    }

    const regionCode = regionRows[0].values[0][0];
    const dCode = (dept_code || 'MED').toUpperCase();
    const userId = uuidv4();
    const userIdCode = generateUserId(regionCode, dCode);
    const hash = await bcrypt.hash(password, 10);

    db.run(`INSERT INTO users (id, user_id_code, full_name, email, password_hash, position, region_id, dept_code, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'member')`,
      [userId, userIdCode, full_name.trim(), email.toLowerCase().trim(), hash, position.trim(), region_id, dCode]);
    
    saveDatabase();
    auditLog(userId, 'SELF_REGISTER', 'users', userId, null, { full_name, email, userIdCode });

    const token = generateToken(userId);
    const user = {
      id: userId,
      user_id_code: userIdCode,
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      position: position.trim(),
      region_id: region_id,
      dept_code: dCode,
      role: 'member'
    };

    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

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
      SELECT u.id, u.user_id_code, u.full_name, u.email, u.position, u.role, u.dept_code, u.is_active, u.created_at, u.profile_picture,
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

router.post('/upload-picture', authenticate, upload.single('picture'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const db = getDb();
    const fileName = `${req.user.id}-${Date.now()}${path.extname(req.file.originalname)}`;
    const filePath = path.join(uploadDir, fileName);
    
    // Rename the uploaded file
    fs.renameSync(req.file.path, filePath);

    // Get old picture path to delete it
    const oldRows = db.exec('SELECT profile_picture FROM users WHERE id=?', [req.user.id]);
    const oldPicture = oldRows[0]?.values[0][0];

    // Update database with new picture path
    const pictureUrl = `/uploads/profiles/${fileName}`;
    db.run("UPDATE users SET profile_picture=?, updated_at=datetime('now') WHERE id=?", 
      [pictureUrl, req.user.id]);
    saveDatabase();

    // Delete old picture if it exists
    if (oldPicture) {
      const oldFilePath = path.join(__dirname, '..', oldPicture);
      if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
    }

    auditLog(req.user.id, 'UPDATE_PROFILE_PICTURE', 'users', req.user.id, null, { picture_url: pictureUrl });

    res.json({ message: 'Profile picture uploaded successfully', profile_picture: pictureUrl });
  } catch (err) {
    console.error(err);
    if (err.message.includes('file type')) {
      res.status(400).json({ error: err.message });
    } else if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File size exceeds 5MB limit' });
    } else {
      res.status(500).json({ error: 'Failed to upload picture' });
    }
  }
});

router.post('/remove-picture', authenticate, (req, res) => {
  try {
    const db = getDb();
    const rows = db.exec('SELECT profile_picture FROM users WHERE id=?', [req.user.id]);
    const oldPicture = rows[0]?.values[0][0];

    // Remove picture from database
    db.run("UPDATE users SET profile_picture=NULL, updated_at=datetime('now') WHERE id=?", [req.user.id]);
    saveDatabase();

    // Delete file if it exists
    if (oldPicture) {
      const filePath = path.join(__dirname, '..', oldPicture);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    auditLog(req.user.id, 'REMOVE_PROFILE_PICTURE', 'users', req.user.id, null, null);

    res.json({ message: 'Profile picture removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove picture' });
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
