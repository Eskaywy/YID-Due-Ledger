const express = require('express');
const { getDb } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function rows2obj(rows) {
  if (!rows[0]?.values?.length) return [];
  const cols = rows[0].columns;
  return rows[0].values.map(vals => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    return obj;
  });
}

router.get('/my/dues', authenticate, (req, res) => {
  try {
    const db = getDb();
    res.json(rows2obj(db.exec(
      `SELECT * FROM monthly_dues WHERE user_id=? ORDER BY due_year DESC, due_month DESC`, [req.user.id]
    )));
  } catch { res.status(500).json({ error: 'Failed to fetch dues' }); }
});

router.get('/my/pledges/program', authenticate, (req, res) => {
  try {
    const db = getDb();
    res.json(rows2obj(db.exec(
      `SELECT * FROM program_pledges WHERE user_id=? ORDER BY created_at DESC`, [req.user.id]
    )));
  } catch { res.status(500).json({ error: 'Failed to fetch program pledges' }); }
});

router.get('/my/pledges/other', authenticate, (req, res) => {
  try {
    const db = getDb();
    res.json(rows2obj(db.exec(
      `SELECT * FROM other_pledges WHERE user_id=? ORDER BY created_at DESC`, [req.user.id]
    )));
  } catch { res.status(500).json({ error: 'Failed to fetch other pledges' }); }
});

router.get('/my/summary', authenticate, (req, res) => {
  try {
    const db = getDb();
    const uid = req.user.id;
    const d = db.exec(`SELECT
      SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),
      SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),
      SUM(CASE WHEN status='arrears' THEN amount ELSE 0 END),
      COUNT(*) FROM monthly_dues WHERE user_id=?`, [uid])[0]?.values[0] || [0,0,0,0];
    const p = db.exec(`SELECT
      SUM(CASE WHEN status='paid' THEN pledge_amount ELSE 0 END),
      SUM(CASE WHEN status='pending' THEN pledge_amount ELSE 0 END),
      SUM(CASE WHEN status='arrears' THEN pledge_amount ELSE 0 END)
      FROM program_pledges WHERE user_id=?`, [uid])[0]?.values[0] || [0,0,0];
    const o = db.exec(`SELECT
      SUM(CASE WHEN status='paid' THEN pledge_amount ELSE 0 END),
      SUM(CASE WHEN status='pending' THEN pledge_amount ELSE 0 END),
      SUM(CASE WHEN status='arrears' THEN pledge_amount ELSE 0 END)
      FROM other_pledges WHERE user_id=?`, [uid])[0]?.values[0] || [0,0,0];

    res.json({
      dues:             { paid: d[0]||0, pending: d[1]||0, arrears: d[2]||0, total: d[3]||0 },
      program_pledges:  { paid: p[0]||0, pending: p[1]||0, arrears: p[2]||0 },
      other_pledges:    { paid: o[0]||0, pending: o[1]||0, arrears: o[2]||0 },
      total_outstanding: ((d[1]||0)+(d[2]||0)+(p[1]||0)+(p[2]||0)+(o[1]||0)+(o[2]||0))
    });
  } catch { res.status(500).json({ error: 'Failed to fetch summary' }); }
});

module.exports = router;
