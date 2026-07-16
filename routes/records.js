const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// ── Monthly Dues ────────────────────────────────────────────────────────────

router.put('/dues/:userId', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { due_month, due_year, amount, status, notes } = req.body;
    if (!due_month || !due_year || !status) return res.status(400).json({ error: 'Month, year and status are required' });
    if (!['paid','pending','arrears'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const userDoc = await db.collection('users').doc(req.params.userId).get();
    if (!userDoc.exists || !userDoc.data().isActive) return res.status(404).json({ error: 'User not found' });

    const existingSnapshot = await db.collection('monthlyDues')
      .where('userId', '==', req.params.userId)
      .where('dueMonth', '==', parseInt(due_month))
      .where('dueYear', '==', parseInt(due_year))
      .get();

    if (!existingSnapshot.empty) {
      const existDoc = existingSnapshot.docs[0];
      const existId = existDoc.id;
      const oldStatus = existDoc.data().status;
      await existDoc.ref.update({
        amount: parseFloat(amount) || 0,
        status,
        notes: notes || null,
        updatedBy: req.user.id,
        updatedAt: new Date().toISOString()
      });
      await auditLog(req.user.id, 'UPDATE_DUE', 'monthly_dues', existId, { status: oldStatus }, { status, amount });
    } else {
      const id = uuidv4();
      await db.collection('monthlyDues').doc(id).set({
        id,
        userId: req.params.userId,
        dueMonth: parseInt(due_month),
        dueYear: parseInt(due_year),
        amount: parseFloat(amount) || 0,
        status,
        notes: notes || null,
        updatedBy: req.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await auditLog(req.user.id, 'CREATE_DUE', 'monthly_dues', id, null, { due_month, due_year, status, amount });
    }
    res.json({ message: 'Due record saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update due' });
  }
});

router.delete('/dues/:dueId', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const docRef = db.collection('monthlyDues').doc(req.params.dueId);
    await docRef.delete();
    await auditLog(req.user.id, 'DELETE_DUE', 'monthly_dues', req.params.dueId, null, null);
    res.json({ message: 'Due deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete due' });
  }
});

// ── Program Pledges ─────────────────────────────────────────────────────────

router.post('/pledges/program/:userId', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { program_name, pledge_amount, status, pledge_date, notes } = req.body;
    if (!program_name) return res.status(400).json({ error: 'Program name required' });

    const id = uuidv4();
    await db.collection('programPledges').doc(id).set({
      id,
      userId: req.params.userId,
      programName: program_name,
      pledgeAmount: parseFloat(pledge_amount) || 0,
      status: ['paid','pending','arrears'].includes(status) ? status : 'pending',
      pledgeDate: pledge_date || null,
      notes: notes || null,
      updatedBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await auditLog(req.user.id, 'CREATE_PROGRAM_PLEDGE', 'program_pledges', id, null, { program_name, pledge_amount, status });
    res.status(201).json({ message: 'Pledge created', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create pledge' });
  }
});

router.put('/pledges/program/:pledgeId', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { program_name, pledge_amount, status, pledge_date, notes } = req.body;
    const docRef = db.collection('programPledges').doc(req.params.pledgeId);
    await docRef.update({
      programName: program_name,
      pledgeAmount: parseFloat(pledge_amount) || 0,
      status,
      pledgeDate: pledge_date || null,
      notes: notes || null,
      updatedBy: req.user.id,
      updatedAt: new Date().toISOString()
    });
    await auditLog(req.user.id, 'UPDATE_PROGRAM_PLEDGE', 'program_pledges', req.params.pledgeId, null, { status, pledge_amount });
    res.json({ message: 'Pledge updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update pledge' });
  }
});

router.delete('/pledges/program/:pledgeId', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const docRef = db.collection('programPledges').doc(req.params.pledgeId);
    await docRef.delete();
    await auditLog(req.user.id, 'DELETE_PROGRAM_PLEDGE', 'program_pledges', req.params.pledgeId, null, null);
    res.json({ message: 'Pledge deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete pledge' });
  }
});

// ── Other Pledges ───────────────────────────────────────────────────────────

router.post('/pledges/other/:userId', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { description, pledge_amount, status, pledge_date, notes } = req.body;
    if (!description) return res.status(400).json({ error: 'Description required' });

    const id = uuidv4();
    await db.collection('otherPledges').doc(id).set({
      id,
      userId: req.params.userId,
      description,
      pledgeAmount: parseFloat(pledge_amount) || 0,
      status: ['paid','pending','arrears'].includes(status) ? status : 'pending',
      pledgeDate: pledge_date || null,
      notes: notes || null,
      updatedBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await auditLog(req.user.id, 'CREATE_OTHER_PLEDGE', 'other_pledges', id, null, { description, pledge_amount, status });
    res.status(201).json({ message: 'Pledge created', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create pledge' });
  }
});

router.put('/pledges/other/:pledgeId', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { description, pledge_amount, status, pledge_date, notes } = req.body;
    const docRef = db.collection('otherPledges').doc(req.params.pledgeId);
    await docRef.update({
      description,
      pledgeAmount: parseFloat(pledge_amount) || 0,
      status,
      pledgeDate: pledge_date || null,
      notes: notes || null,
      updatedBy: req.user.id,
      updatedAt: new Date().toISOString()
    });
    await auditLog(req.user.id, 'UPDATE_OTHER_PLEDGE', 'other_pledges', req.params.pledgeId, null, { status, pledge_amount });
    res.json({ message: 'Pledge updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update pledge' });
  }
});

router.delete('/pledges/other/:pledgeId', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const docRef = db.collection('otherPledges').doc(req.params.pledgeId);
    await docRef.delete();
    await auditLog(req.user.id, 'DELETE_OTHER_PLEDGE', 'other_pledges', req.params.pledgeId, null, null);
    res.json({ message: 'Pledge deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete pledge' });
  }
});

module.exports = router;
