const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, generateSmartId, findOrCreateDepartment, findOrCreateRegion } = require('../db');
const { authenticate, generateToken } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// Convert a Firestore user doc into the snake_case API shape the frontend expects
// (never exposes passwordHash).
const publicUser = (user, regionName = null, regionCode = null) => ({
  id: user.id,
  user_id_code: user.userIdCode ?? null,
  full_name: user.fullName ?? null,
  email: user.email ?? null,
  position: user.position ?? null,
  role_title: user.roleTitle ?? null,
  region_id: user.regionId ?? null,
  region_name: regionName,
  region_code: regionCode,
  dept_code: user.deptCode ?? null,
  role: user.role ?? 'member',
  is_active: user.isActive ?? true,
  must_change_password: user.mustChangePassword === true,
  created_at: user.createdAt ?? null,
  updated_at: user.updatedAt ?? null,
});

// Load a region's name/code by its id.
const getRegion = async (regionId) => {
  if (!regionId) return { regionName: null, regionCode: null };
  const regionDoc = await db.collection('regions').doc(regionId).get();
  if (!regionDoc.exists) return { regionName: null, regionCode: null };
  const region = regionDoc.data();
  return { regionName: region.name ?? null, regionCode: region.code ?? null };
};

router.post('/login', async (req, res) => {
  try {
    // Accept an email OR a Smart Ledger ID (e.g. LA1-MED-1001) — per the
    // prototype's signin.html ("Email or Smart ID").
    const identifier = String(req.body.identifier ?? req.body.email ?? '').trim();
    const { password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'Email / Smart ID and password required' });

    const usersSnapshot = identifier.includes('@')
      ? await db.collection('users').where('email', '==', identifier.toLowerCase()).where('isActive', '==', true).limit(1).get()
      : await db.collection('users').where('userIdCode', '==', identifier.toUpperCase()).where('isActive', '==', true).limit(1).get();
    if (usersSnapshot.empty) return res.status(401).json({ error: 'Invalid credentials' });

    const user = usersSnapshot.docs[0].data();
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Get region data
    const { regionName, regionCode } = await getRegion(user.regionId);

    const token = generateToken(user.id);
    res.json({ token, user: publicUser(user, regionName, regionCode) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Public list of regions (used by the signup form, no auth required)
router.get('/regions', async (req, res) => {
  try {
    const regionsSnapshot = await db.collection('regions').orderBy('name').get();
    const regions = regionsSnapshot.docs.map(doc => {
      const r = doc.data();
      return { id: r.id ?? doc.id, name: r.name ?? null, code: r.code ?? null };
    });
    res.json(regions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
});

// Public list of departments for the signup form; seeds the prototype's
// defaults (Information / Media) on first call so the dropdown is never empty.
router.get('/departments', async (req, res) => {
  try {
    let snapshot = await db.collection('departments').orderBy('name').get();
    if (snapshot.empty) {
      for (const d of [{ name: 'Information', code: 'INF' }, { name: 'Media', code: 'MED' }]) {
        const ref = db.collection('departments').doc();
        await ref.set({ id: ref.id, ...d, createdAt: new Date().toISOString() });
      }
      snapshot = await db.collection('departments').orderBy('name').get();
    }
    res.json(snapshot.docs.map(doc => {
      const d = doc.data();
      return { id: d.id ?? doc.id, name: d.name ?? null, code: d.code ?? null };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.id).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const user = userDoc.data();

    const { regionName, regionCode } = await getRegion(user.regionId);
    res.json(publicUser(user, regionName, regionCode));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.post('/signup', async (req, res) => {
  try {
    // Prototype signup fields (signup.html): first name + surname, position
    // (Leader/Member), a free-text role, and department/region selects where
    // "Other" names a new entry that becomes a standard option for everyone.
    const {
      first_name, surname, full_name, email, password, position, role_title,
      region_id, region_name, dept_code, department_name,
    } = req.body;

    const fullName = `${String(first_name || '').trim()} ${String(surname || '').trim()}`.trim()
      || String(full_name || '').trim();
    const roleTitle = String(role_title || '').trim();

    // Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password required' });
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
    
    // Resolve the department: an explicit code picks an existing doc, a raw
    // name (the prototype's "Other" path) is upserted for everyone.
    const dept = await findOrCreateDepartment(dept_code, department_name);
    if (!dept) return res.status(400).json({ error: 'Department is required' });

    // Same for the region; fall back to the seeded default (Lagos).
    let region = null;
    if (region_id || region_name) {
      region = await findOrCreateRegion(region_id, region_name);
    }
    if (!region) {
      const defaultRegionSnapshot = await db.collection('regions').where('code', '==', 'LGS').limit(1).get();
      region = defaultRegionSnapshot.empty ? null : defaultRegionSnapshot.docs[0].data();
    }
    if (!region) return res.status(400).json({ error: 'Region is required' });

    // Mint the Smart Ledger ID: REGION-DEPT-serial (e.g. LA1-MED-1001)
    const user_id_code = await generateSmartId({
      regionName: region.name,
      regionCode: region.code,
      deptName: dept.name,
      deptCode: dept.code,
    });

    await db.collection('users').doc(userId).set({
      id: userId,
      userIdCode: user_id_code,
      fullName,
      roleTitle: roleTitle || null,
      email: email.toLowerCase().trim(),
      passwordHash,
      position: position || null,
      regionId: region.id,
      deptCode: dept.code,
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
    res.json({ token, user: publicUser(user, regionName, regionCode) });
    
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
      mustChangePassword: false,
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
