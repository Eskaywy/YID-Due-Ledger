const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, generateUserId } = require('../db');
const { authenticate, generateToken } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const usersSnapshot = await db.collection('users').where('email', '==', email.toLowerCase().trim()).where('isActive', '==', true).get();
    if (usersSnapshot.empty) return res.status(401).json({ error: 'Invalid email or password' });

    const userDoc = usersSnapshot.docs[0];
    const user = userDoc.data();
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    // Get region data
    let regionName = null, regionCode = null;
    if (user.regionId) {
      const regionDoc = await db.collection('regions').doc(user.regionId).get();
      if (regionDoc.exists) {
        regionName = regionDoc.data().name;
        regionCode = regionDoc.data().code;
      }
    }

    const token = generateToken(user.id);
    const { passwordHash, ...safeUser } = user;
    res.json({ token, user: { ...safeUser, regionName, regionCode } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.id).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const user = userDoc.data();

    let regionName = null, regionCode = null, regionId = user.regionId;
    if (regionId) {
      const regionDoc = await db.collection('regions').doc(regionId).get();
      if (regionDoc.exists) {
        regionName = regionDoc.data().name;
        regionCode = regionDoc.data().code;
      }
    }

    const { passwordHash, ...safeUser } = user;
    res.json({ ...safeUser, regionName, regionCode, regionId });
  } catch (err) {
    console.error(err);
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

    // Check if email already exists
    const existingEmailSnapshot = await db.collection('users').where('email', '==', email.toLowerCase().trim()).get();
    if (!existingEmailSnapshot.empty) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create new user
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Get default region if not provided (Lagos region)
    let finalRegionId = region_id;
    if (!finalRegionId) {
      const defaultRegionSnapshot = await db.collection('regions').where('code', '==', 'LGS').get();
      if (!defaultRegionSnapshot.empty) {
        finalRegionId = defaultRegionSnapshot.docs[0].id;
      }
    }
    
    // Generate user ID code
    const user_id_code = await generateUserId('LGS', 'MED'); // Default LGS MED for now
    
    await db.collection('users').doc(userId).set({
      id: userId,
      userIdCode: user_id_code,
      fullName: full_name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      position: position || null,
      regionId: finalRegionId,
      deptCode: 'MED',
      role: 'member',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    // Auto login after signup
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();
    
    // Get region data
    let regionName = null, regionCode = null;
    if (user.regionId) {
      const regionDoc = await db.collection('regions').doc(user.regionId).get();
      if (regionDoc.exists) {
        regionName = regionDoc.data().name;
        regionCode = regionDoc.data().code;
      }
    }
    
    const token = generateToken(user.id);
    const { passwordHash: _, ...safeUser } = user;
    res.json({ token, user: { ...safeUser, regionName, regionCode } });
    
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

    const userDoc = await db.collection('users').doc(req.user.id).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const user = userDoc.data();

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.collection('users').doc(req.user.id).update({
      passwordHash: newHash,
      updatedAt: new Date().toISOString(),
    });

    await auditLog(req.user.id, 'CHANGE_PASSWORD', 'users', req.user.id, null, null);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
