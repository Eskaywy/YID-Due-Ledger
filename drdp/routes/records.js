const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase } = require('../db');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// ── Monthly Dues ────────────────────────────────────────────────────────────

router.put('/dues/:userId', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const { due_month, due_year, amount, status, notes } = req.body;
    if (!due_month || !due_year || !status) return res.status(400).json({ error: 'Month, year and status are required' });
    if (!['paid','pending','arrears'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const db = getDb();
    if (!db.exec('SELECT id FROM users WHERE id=? AND is_active=1', [req.params.userId])[0]?.values?.length)
      return res.status(404).json({ error: 'User not found' });

    const existing = db.exec('SELECT id, status FROM monthly_dues WHERE user_id=? AND due_month=? AND due_year=?',
      [req.params.userId, parseInt(due_month), parseInt(due_year)]);

    if (existing[0]?.values?.length) {
      const [existId, oldStatus] = existing[0].values[0];
      db.run(`UPDATE monthly_dues SET amount=?, status=?, notes=?, updated_by=?, updated_at=datetime('now')
        WHERE user_id=? AND due_month=? AND due_year=?`,
        [parseFloat(amount)||0, status, notes||null, req.user.id, req.params.userId, parseInt(due_month), parseInt(due_year)]);
      auditLog(req.user.id, 'UPDATE_DUE', 'monthly_dues', existId, { status: oldStatus }, { status, amount });
    } else {
      const id = uuidv4();
      db.run(`INSERT INTO monthly_dues (id, user_id, due_month, due_year, amount, status, notes, updated_by)
        VALUES (?,?,?,?,?,?,?,?)`,
        [id, req.params.userId, parseInt(due_month), parseInt(due_year), parseFloat(amount)||0, status, notes||null, req.user.id]);
      auditLog(req.user.id, 'CREATE_DUE', 'monthly_dues', id, null, { due_month, due_year, status, amount });
    }
    saveDatabase();
    res.json({ message: 'Due record saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update due' });
  }
});

router.delete('/dues/:dueId', authenticate, requireSuperAdmin, (req, res) => {
  try {
    getDb().run('DELETE FROM monthly_dues WHERE id=?', [req.params.dueId]);
    saveDatabase();
    auditLog(req.user.id, 'DELETE_DUE', 'monthly_dues', req.params.dueId, null, null);
    res.json({ message: 'Due deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete due' });
  }
});

// ── Program Pledges ─────────────────────────────────────────────────────────

router.post('/pledges/program/:userId', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const { program_name, pledge_amount, status, pledge_date, notes } = req.body;
    if (!program_name) return res.status(400).json({ error: 'Program name required' });

    const id = uuidv4();
    getDb().run(`INSERT INTO program_pledges (id, user_id, program_name, pledge_amount, status, pledge_date, notes, updated_by)
      VALUES (?,?,?,?,?,?,?,?)`,
      [id, req.params.userId, program_name, parseFloat(pledge_amount)||0,
       ['paid','pending','arrears'].includes(status) ? status : 'pending',
       pledge_date||null, notes||null, req.user.id]);
    saveDatabase();
    auditLog(req.user.id, 'CREATE_PROGRAM_PLEDGE', 'program_pledges', id, null, { program_name, pledge_amount, status });
    res.status(201).json({ message: 'Pledge created', id });
  } catch {
    res.status(500).json({ error: 'Failed to create pledge' });
  }
});

router.put('/pledges/program/:pledgeId', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const { program_name, pledge_amount, status, pledge_date, notes } = req.body;
    getDb().run(`UPDATE program_pledges SET program_name=?, pledge_amount=?, status=?, pledge_date=?, notes=?,
      updated_by=?, updated_at=datetime('now') WHERE id=?`,
      [program_name, parseFloat(pledge_amount)||0, status, pledge_date||null, notes||null, req.user.id, req.params.pledgeId]);
    saveDatabase();
    auditLog(req.user.id, 'UPDATE_PROGRAM_PLEDGE', 'program_pledges', req.params.pledgeId, null, { status, pledge_amount });
    res.json({ message: 'Pledge updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update pledge' });
  }
});

router.delete('/pledges/program/:pledgeId', authenticate, requireSuperAdmin, (req, res) => {
  try {
    getDb().run('DELETE FROM program_pledges WHERE id=?', [req.params.pledgeId]);
    saveDatabase();
    auditLog(req.user.id, 'DELETE_PROGRAM_PLEDGE', 'program_pledges', req.params.pledgeId, null, null);
    res.json({ message: 'Pledge deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete pledge' });
  }
});

// ── Other Pledges ───────────────────────────────────────────────────────────

router.post('/pledges/other/:userId', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const { description, pledge_amount, status, pledge_date, notes } = req.body;
    if (!description) return res.status(400).json({ error: 'Description required' });

    const id = uuidv4();
    getDb().run(`INSERT INTO other_pledges (id, user_id, description, pledge_amount, status, pledge_date, notes, updated_by)
      VALUES (?,?,?,?,?,?,?,?)`,
      [id, req.params.userId, description, parseFloat(pledge_amount)||0,
       ['paid','pending','arrears'].includes(status) ? status : 'pending',
       pledge_date||null, notes||null, req.user.id]);
    saveDatabase();
    auditLog(req.user.id, 'CREATE_OTHER_PLEDGE', 'other_pledges', id, null, { description, pledge_amount, status });
    res.status(201).json({ message: 'Pledge created', id });
  } catch {
    res.status(500).json({ error: 'Failed to create pledge' });
  }
});

router.put('/pledges/other/:pledgeId', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const { description, pledge_amount, status, pledge_date, notes } = req.body;
    getDb().run(`UPDATE other_pledges SET description=?, pledge_amount=?, status=?, pledge_date=?, notes=?,
      updated_by=?, updated_at=datetime('now') WHERE id=?`,
      [description, parseFloat(pledge_amount)||0, status, pledge_date||null, notes||null, req.user.id, req.params.pledgeId]);
    saveDatabase();
    auditLog(req.user.id, 'UPDATE_OTHER_PLEDGE', 'other_pledges', req.params.pledgeId, null, { status, pledge_amount });
    res.json({ message: 'Pledge updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update pledge' });
  }
});

router.delete('/pledges/other/:pledgeId', authenticate, requireSuperAdmin, (req, res) => {
  try {
    getDb().run('DELETE FROM other_pledges WHERE id=?', [req.params.pledgeId]);
    saveDatabase();
    auditLog(req.user.id, 'DELETE_OTHER_PLEDGE', 'other_pledges', req.params.pledgeId, null, null);
    res.json({ message: 'Pledge deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete pledge' });
  }
});

module.exports = router;
