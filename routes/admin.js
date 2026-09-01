const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { db, generateUserId } = require('../db');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 } });

// Map Firestore camelCase docs to the snake_case API shape the frontend expects
const mapDue = (d = {}) => ({
  id: d.id,
  user_id: d.userId ?? null,
  due_month: d.dueMonth ?? null,
  due_year: d.dueYear ?? null,
  amount: d.amount ?? 0,
  status: d.status ?? 'pending',
  notes: d.notes ?? null,
  updated_by: d.updatedBy ?? null,
  created_at: d.createdAt ?? null,
  updated_at: d.updatedAt ?? null,
});

const mapProgramPledge = (p = {}) => ({
  id: p.id,
  user_id: p.userId ?? null,
  program_name: p.programName ?? null,
  pledge_amount: p.pledgeAmount ?? 0,
  status: p.status ?? 'pending',
  pledge_date: p.pledgeDate ?? null,
  notes: p.notes ?? null,
  created_at: p.createdAt ?? null,
  updated_at: p.updatedAt ?? null,
});

const mapOtherPledge = (o = {}) => ({
  id: o.id,
  user_id: o.userId ?? null,
  description: o.description ?? null,
  pledge_amount: o.pledgeAmount ?? 0,
  status: o.status ?? 'pending',
  pledge_date: o.pledgeDate ?? null,
  notes: o.notes ?? null,
  created_at: o.createdAt ?? null,
  updated_at: o.updatedAt ?? null,
});

const mapMember = (m = {}) => ({
  id: m.id,
  user_id_code: m.userIdCode ?? null,
  full_name: m.fullName ?? null,
  email: m.email ?? null,
  position: m.position ?? null,
  dept_code: m.deptCode ?? null,
  region_id: m.regionId ?? null,
  role: m.role ?? 'member',
  is_active: m.isActive ?? true,
  created_at: m.createdAt ?? null,
  updated_at: m.updatedAt ?? null,
});

// Dashboard stats
router.get('/stats', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const membersSnapshot = await db.collection('users').where('role', '==', 'member').where('isActive', '==', true).get();
    const totalMembers = membersSnapshot.size;

    const duesSnapshot = await db.collection('monthlyDues').get();
    let paidMembersSet = new Set(), arrearsMembersSet = new Set(), totalCollected = 0;
    duesSnapshot.forEach(doc => {
      const due = doc.data();
      if (due.status === 'paid') {
        totalCollected += due.amount;
        paidMembersSet.add(due.userId);
      } else if (due.status === 'arrears') {
        arrearsMembersSet.add(due.userId);
      }
    });

    const auditLogsSnapshot = await db.collection('auditLogs').orderBy('createdAt', 'desc').limit(10).get();
    const recentActivity = [];
    for (const doc of auditLogsSnapshot.docs) {
      const log = doc.data();
      let actorName = 'Unknown';
      if (log.actorId) {
        const actorDoc = await db.collection('users').doc(log.actorId).get();
        if (actorDoc.exists) {
          actorName = actorDoc.data().fullName || 'Unknown';
        }
      }
      recentActivity.push({ id: log.id, action: log.action, target_table: log.targetTable ?? null, target_id: log.targetId ?? null, actor_name: actorName, created_at: log.createdAt ?? null });
    }

    const regionsSnapshot = await db.collection('regions').orderBy('name').get();
    const regionStats = [];
    for (const regionDoc of regionsSnapshot.docs) {
      const region = regionDoc.data();
      const regionMembersSnapshot = await db.collection('users').where('regionId', '==', region.id).where('role', '==', 'member').where('isActive', '==', true).get();
      let collected = 0;
      for (const memberDoc of regionMembersSnapshot.docs) {
        const memberDuesSnapshot = await db.collection('monthlyDues').where('userId', '==', memberDoc.id).where('status', '==', 'paid').get();
        memberDuesSnapshot.forEach(dueDoc => {
          collected += dueDoc.data().amount;
        });
      }
      regionStats.push({
        name: region.name,
        code: region.code,
        member_count: regionMembersSnapshot.size,
        collected
      });
    }

    res.json({ 
      total_members: totalMembers, 
      paid_members: paidMembersSet.size, 
      arrears_members: arrearsMembersSet.size, 
      total_collected: totalCollected, 
      recent_activity: recentActivity, 
      region_stats: regionStats 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// List members
router.get('/members', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { search, region_id, page = 1, limit = 15 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db.collection('users').where('role', '==', 'member').where('isActive', '==', true);
    if (region_id) {
      query = query.where('regionId', '==', region_id);
    }

    const snapshot = await query.get();
    let members = [];
    for (const doc of snapshot.docs) {
      const member = doc.data();
      if (search) {
        const searchLower = search.toLowerCase();
        if (!((member.fullName || '').toLowerCase().includes(searchLower) ||
              (member.userIdCode || '').toLowerCase().includes(searchLower) ||
              (member.email || '').toLowerCase().includes(searchLower))) {
          continue;
        }
      }
      let regionName = null, regionId = member.regionId;
      if (regionId) {
        const regionDoc = await db.collection('regions').doc(regionId).get();
        if (regionDoc.exists) {
          regionName = regionDoc.data().name;
        }
      }
      members.push({ ...mapMember(member), region_name: regionName, region_id: regionId });
    }
    members.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    const total = members.length;
    const paginatedMembers = members.slice(offset, offset + parseInt(limit));
    res.json({ members: paginatedMembers, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Single member with full ledger
router.get('/members/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const memberDoc = await db.collection('users').doc(req.params.id).get();
    if (!memberDoc.exists || memberDoc.data().role !== 'member' || !memberDoc.data().isActive) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const member = memberDoc.data();

    // Region lookup and the three collection queries are independent, so run
    // them concurrently instead of four sequential Firestore round trips.
    const [regionDoc, duesSnapshot, programPledgesSnapshot, otherPledgesSnapshot] = await Promise.all([
      member.regionId ? db.collection('regions').doc(member.regionId).get() : Promise.resolve(null),
      db.collection('monthlyDues').where('userId', '==', req.params.id).orderBy('dueYear', 'desc').orderBy('dueMonth', 'desc').get(),
      db.collection('programPledges').where('userId', '==', req.params.id).orderBy('createdAt', 'desc').get(),
      db.collection('otherPledges').where('userId', '==', req.params.id).orderBy('createdAt', 'desc').get(),
    ]);

    let regionName = null, regionCode = null;
    if (regionDoc && regionDoc.exists) {
      regionName = regionDoc.data().name;
      regionCode = regionDoc.data().code;
    }

    const dues = duesSnapshot.docs.map(doc => mapDue(doc.data()));
    const programPledges = programPledgesSnapshot.docs.map(doc => mapProgramPledge(doc.data()));
    const otherPledges = otherPledgesSnapshot.docs.map(doc => mapOtherPledge(doc.data()));

    res.json({
      member: { ...mapMember(member), region_name: regionName, region_code: regionCode },
      dues,
      program_pledges: programPledges,
      other_pledges: otherPledges
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// Create member
router.post('/members', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { full_name, email, position, region_id, dept_code } = req.body;
    if (!full_name || !email || !region_id) return res.status(400).json({ error: 'Name, email, and region are required' });

    const existingEmailSnapshot = await db.collection('users').where('email', '==', email.toLowerCase()).get();
    if (!existingEmailSnapshot.empty) return res.status(409).json({ error: 'Email already exists' });

    const regionDoc = await db.collection('regions').doc(region_id).get();
    if (!regionDoc.exists) return res.status(400).json({ error: 'Invalid region' });
    const regionCode = regionDoc.data().code;

    const dCode = (dept_code || 'MED').toUpperCase();
    const userId = uuidv4();
    const userIdCode = await generateUserId(regionCode, dCode);
    // Cryptographically random temp password instead of a fixed shared one.
    // Keeps the Member@… shape the password policy expects (upper, lower, digit, symbol).
    const tempPass = `Member@${crypto.randomBytes(4).toString('hex')}`;
    const hash = await bcrypt.hash(tempPass, 10);

    await db.collection('users').doc(userId).set({
      id: userId,
      userIdCode,
      fullName: full_name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hash,
      position: position || '',
      regionId: region_id,
      deptCode: dCode,
      role: 'member',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await auditLog(req.user.id, 'CREATE_MEMBER', 'users', userId, null, { full_name, email, userIdCode });
    res.status(201).json({ message: 'Member created', id: userId, user_id_code: userIdCode, temp_password: tempPass });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// Update member
router.put('/members/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const memberDocRef = db.collection('users').doc(req.params.id);
    const memberDoc = await memberDocRef.get();
    if (!memberDoc.exists) return res.status(404).json({ error: 'Member not found' });

    const before = memberDoc.data();
    delete before.passwordHash;

    const { full_name, email, position, region_id, dept_code, is_active } = req.body;

    // Enforce the same email-uniqueness rule as member creation so an admin
    // edit cannot collide two accounts onto one login identity.
    if (email && email.toLowerCase() !== String(before.email).toLowerCase()) {
      const dupSnapshot = await db.collection('users').where('email', '==', email.toLowerCase()).get();
      if (!dupSnapshot.empty) return res.status(409).json({ error: 'Email already exists' });
    }

    const updateData = {
      fullName: full_name || before.fullName,
      email: email || before.email,
      position: position ?? before.position,
      regionId: region_id || before.regionId,
      deptCode: dept_code || before.deptCode,
      isActive: is_active !== undefined ? is_active : before.isActive,
      updatedAt: new Date().toISOString()
    };

    await memberDocRef.update(updateData);
    await auditLog(req.user.id, 'UPDATE_MEMBER', 'users', req.params.id, before, req.body);
    res.json({ message: 'Member updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Soft-delete member
router.delete('/members/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const memberDocRef = db.collection('users').doc(req.params.id);
    const memberDoc = await memberDocRef.get();
    if (!memberDoc.exists) return res.status(404).json({ error: 'Member not found' });

    const fullName = memberDoc.data().fullName;
    await memberDocRef.update({ isActive: false, updatedAt: new Date().toISOString() });
    await auditLog(req.user.id, 'DELETE_MEMBER', 'users', req.params.id, { fullName }, null);
    res.json({ message: 'Member archived' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to archive member' });
  }
});

// Get regions
router.get('/regions', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const regionsSnapshot = await db.collection('regions').orderBy('name').get();
    const regions = regionsSnapshot.docs.map(doc => doc.data());
    res.json(regions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
});

// Batch upload CSV / Excel
router.post('/batch-upload', authenticate, requireSuperAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let records = [];

    if (ext === '.csv') {
      const content = fs.readFileSync(req.file.path, 'utf8');
      records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    } else if (['.xlsx', '.xls'].includes(ext)) {
      const wb = XLSX.readFile(req.file.path);
      records = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    } else {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Only CSV or Excel files accepted' });
    }
    fs.unlinkSync(req.file.path);

    const errors = [], successes = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2;

      let userId = null;
      if (row.user_id) {
        const snapshot = await db.collection('users').where('userIdCode', '==', row.user_id).get();
        if (!snapshot.empty) {
          userId = snapshot.docs[0].id;
        }
      }
      if (!userId && row.email) {
        const snapshot = await db.collection('users').where('email', '==', row.email).get();
        if (!snapshot.empty) {
          userId = snapshot.docs[0].id;
        }
      }
      if (!userId) {
        errors.push({ row: rowNum, error: `User not found: ${row.user_id || row.email}` }); 
        continue;
      }

      if (row.due_month && row.due_year) {
        const month = parseInt(row.due_month), year = parseInt(row.due_year);
        const status = ['paid','pending','arrears'].includes(row.due_status) ? row.due_status : 'pending';
        if (month < 1 || month > 12 || year < 2000) {
          errors.push({ row: rowNum, error: `Invalid month/year: ${month}/${year}` });
        } else {
          const existingDueSnapshot = await db.collection('monthlyDues').where('userId', '==', userId).where('dueMonth', '==', month).where('dueYear', '==', year).get();
          if (!existingDueSnapshot.empty) {
            await existingDueSnapshot.docs[0].ref.update({
              amount: parseFloat(row.due_amount) || 0,
              status,
              updatedBy: req.user.id,
              updatedAt: new Date().toISOString()
            });
          } else {
            const dueId = uuidv4();
            await db.collection('monthlyDues').doc(dueId).set({
              id: dueId,
              userId,
              dueMonth: month,
              dueYear: year,
              amount: parseFloat(row.due_amount) || 0,
              status,
              updatedBy: req.user.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
          successes.push(rowNum);
        }
      }

      if (row.pledge_program) {
        const pledgeId = uuidv4();
        await db.collection('programPledges').doc(pledgeId).set({
          id: pledgeId,
          userId,
          programName: row.pledge_program,
          pledgeAmount: parseFloat(row.pledge_amount) || 0,
          status: ['paid','pending','arrears'].includes(row.pledge_status) ? row.pledge_status : 'pending',
          pledgeDate: row.pledge_date || null,
          updatedBy: req.user.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        successes.push(`${rowNum}(pledge)`);
      }
    }

    await auditLog(req.user.id, 'BATCH_UPLOAD', 'multiple', null, null, { successes: successes.length, errors: errors.length });
    res.json({ processed: records.length, successes: successes.length, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Batch upload failed: ' + err.message });
  }
});

// Export members to Excel
router.get('/export', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { region_id } = req.query;
    let query = db.collection('users').where('role', '==', 'member').where('isActive', '==', true);
    if (region_id) {
      query = query.where('regionId', '==', region_id);
    }

    const snapshot = await query.get();
    const members = [];
    for (const doc of snapshot.docs) {
      const member = doc.data();
      let region = '';
      if (member.regionId) {
        const regionDoc = await db.collection('regions').doc(member.regionId).get();
        if (regionDoc.exists) {
          region = regionDoc.data().name;
        }
      }
      members.push({
        user_id_code: member.userIdCode,
        full_name: member.fullName,
        email: member.email,
        position: member.position,
        region,
        created_at: member.createdAt
      });
    }
    members.sort((a, b) => a.region.localeCompare(b.region) || a.full_name.localeCompare(b.full_name));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(members), 'Members');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="members-export.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Audit logs
router.get('/audit-logs', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('auditLogs').orderBy('createdAt', 'desc').limit(100).get();
    const logs = [];
    for (const doc of snapshot.docs) {
      const log = doc.data();
      let actorName = 'Unknown';
      if (log.actorId) {
        const actorDoc = await db.collection('users').doc(log.actorId).get();
        if (actorDoc.exists) {
          actorName = actorDoc.data().fullName || 'Unknown';
        }
      }
      logs.push({ id: log.id, action: log.action, target_table: log.targetTable ?? null, target_id: log.targetId ?? null, actor_name: actorName, before_value: log.beforeValue ?? null, after_value: log.afterValue ?? null, created_at: log.createdAt ?? null });
    }
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
