const express = require('express');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

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

router.get('/my/dues', authenticate, async (req, res) => {
  try {
    const duesSnapshot = await db.collection('monthlyDues').where('userId', '==', req.user.id).orderBy('dueYear', 'desc').orderBy('dueMonth', 'desc').get();
    const dues = duesSnapshot.docs.map(doc => mapDue(doc.data()));
    res.json(dues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dues' });
  }
});

router.get('/my/pledges/program', authenticate, async (req, res) => {
  try {
    const pledgesSnapshot = await db.collection('programPledges').where('userId', '==', req.user.id).orderBy('createdAt', 'desc').get();
    const pledges = pledgesSnapshot.docs.map(doc => mapProgramPledge(doc.data()));
    res.json(pledges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch program pledges' });
  }
});

router.get('/my/pledges/other', authenticate, async (req, res) => {
  try {
    const pledgesSnapshot = await db.collection('otherPledges').where('userId', '==', req.user.id).orderBy('createdAt', 'desc').get();
    const pledges = pledgesSnapshot.docs.map(doc => mapOtherPledge(doc.data()));
    res.json(pledges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch other pledges' });
  }
});

router.get('/my/summary', authenticate, async (req, res) => {
  try {
    const uid = req.user.id;
    const duesSnapshot = await db.collection('monthlyDues').where('userId', '==', uid).get();
    const programPledgesSnapshot = await db.collection('programPledges').where('userId', '==', uid).get();
    const otherPledgesSnapshot = await db.collection('otherPledges').where('userId', '==', uid).get();

    let duesPaid = 0, duesPending = 0, duesArrears = 0, duesTotal = 0;
    duesSnapshot.forEach(doc => {
      const due = doc.data();
      duesTotal++;
      if (due.status === 'paid') duesPaid += due.amount;
      else if (due.status === 'pending') duesPending += due.amount;
      else if (due.status === 'arrears') duesArrears += due.amount;
    });

    let progPaid = 0, progPending = 0, progArrears = 0;
    programPledgesSnapshot.forEach(doc => {
      const pledge = doc.data();
      if (pledge.status === 'paid') progPaid += pledge.pledgeAmount;
      else if (pledge.status === 'pending') progPending += pledge.pledgeAmount;
      else if (pledge.status === 'arrears') progArrears += pledge.pledgeAmount;
    });

    let otherPaid = 0, otherPending = 0, otherArrears = 0;
    otherPledgesSnapshot.forEach(doc => {
      const pledge = doc.data();
      if (pledge.status === 'paid') otherPaid += pledge.pledgeAmount;
      else if (pledge.status === 'pending') otherPending += pledge.pledgeAmount;
      else if (pledge.status === 'arrears') otherArrears += pledge.pledgeAmount;
    });

    res.json({
      dues: { paid: duesPaid, pending: duesPending, arrears: duesArrears, total: duesTotal },
      program_pledges: { paid: progPaid, pending: progPending, arrears: progArrears },
      other_pledges: { paid: otherPaid, pending: otherPending, arrears: otherArrears },
      total_outstanding: (duesPending + duesArrears + progPending + progArrears + otherPending + otherArrears)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

module.exports = router;
