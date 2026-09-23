const express = require('express');
const { supabase } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// The tables use snake_case columns that match the API shape the frontend
// expects, so rows map 1:1.

router.get('/my/dues', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('monthly_dues')
      .select('*')
      .eq('user_id', req.user.id)
      .order('due_year', { ascending: false })
      .order('due_month', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dues' });
  }
});

router.get('/my/pledges/program', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('program_pledges')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch program pledges' });
  }
});

router.get('/my/pledges/other', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('other_pledges')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch other pledges' });
  }
});

router.get('/my/summary', authenticate, async (req, res) => {
  try {
    const uid = req.user.id;
    const [duesRes, programRes, otherRes] = await Promise.all([
      supabase.from('monthly_dues').select('amount, status').eq('user_id', uid),
      supabase.from('program_pledges').select('pledge_amount, status').eq('user_id', uid),
      supabase.from('other_pledges').select('pledge_amount, status').eq('user_id', uid),
    ]);
    if (duesRes.error || programRes.error || otherRes.error) {
      throw duesRes.error || programRes.error || otherRes.error;
    }

    let duesPaid = 0, duesPending = 0, duesArrears = 0, duesTotal = 0;
    for (const due of duesRes.data || []) {
      duesTotal++;
      if (due.status === 'paid') duesPaid += Number(due.amount);
      else if (due.status === 'pending') duesPending += Number(due.amount);
      else if (due.status === 'arrears') duesArrears += Number(due.amount);
    }

    let progPaid = 0, progPending = 0, progArrears = 0;
    for (const pledge of programRes.data || []) {
      if (pledge.status === 'paid') progPaid += Number(pledge.pledge_amount);
      else if (pledge.status === 'pending') progPending += Number(pledge.pledge_amount);
      else if (pledge.status === 'arrears') progArrears += Number(pledge.pledge_amount);
    }

    let otherPaid = 0, otherPending = 0, otherArrears = 0;
    for (const pledge of otherRes.data || []) {
      if (pledge.status === 'paid') otherPaid += Number(pledge.pledge_amount);
      else if (pledge.status === 'pending') otherPending += Number(pledge.pledge_amount);
      else if (pledge.status === 'arrears') otherArrears += Number(pledge.pledge_amount);
    }

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
