const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { getDb, saveDatabase, generateUserId } = require('../db');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 } });

function rows2obj(rows) {
  if (!rows[0]?.values?.length) return [];
  const cols = rows[0].columns;
  return rows[0].values.map(vals => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    return obj;
  });
}

// Dashboard stats
router.get('/stats', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const totalMembers   = db.exec(`SELECT COUNT(*) FROM users WHERE role='member' AND is_active=1`)[0]?.values[0][0] || 0;
    const paidMembers    = db.exec(`SELECT COUNT(DISTINCT user_id) FROM monthly_dues WHERE status='paid'`)[0]?.values[0][0] || 0;
    const arrearsMembers = db.exec(`SELECT COUNT(DISTINCT user_id) FROM monthly_dues WHERE status='arrears'`)[0]?.values[0][0] || 0;
    const totalCollected = db.exec(`SELECT COALESCE(SUM(amount),0) FROM monthly_dues WHERE status='paid'`)[0]?.values[0][0] || 0;
    const recentActivity = rows2obj(db.exec(`
      SELECT al.action, al.created_at, al.target_table, u.full_name as actor_name
      FROM audit_logs al LEFT JOIN users u ON al.actor_id=u.id
      ORDER BY al.created_at DESC LIMIT 10`));

    // Per-region breakdown
    const regionStats = rows2obj(db.exec(`
      SELECT r.name, r.code,
        COUNT(DISTINCT u.id) as member_count,
        COALESCE(SUM(CASE WHEN d.status='paid' THEN d.amount ELSE 0 END),0) as collected
      FROM regions r
      LEFT JOIN users u ON u.region_id=r.id AND u.role='member' AND u.is_active=1
      LEFT JOIN monthly_dues d ON d.user_id=u.id
      GROUP BY r.id ORDER BY r.name`));

    res.json({ total_members: totalMembers, paid_members: paidMembers, arrears_members: arrearsMembers, total_collected: totalCollected, recent_activity: recentActivity, region_stats: regionStats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// List members
router.get('/members', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const { search, region_id, page = 1, limit = 15 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = ["u.role='member'", "u.is_active=1"];
    const params = [];

    if (region_id) { conditions.push("u.region_id=?"); params.push(region_id); }
    if (search)    { conditions.push("(u.full_name LIKE ? OR u.user_id_code LIKE ? OR u.email LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const where = 'WHERE ' + conditions.join(' AND ');
    const query = `SELECT u.id, u.user_id_code, u.full_name, u.email, u.position, u.dept_code, u.created_at,
                          r.name as region_name, r.id as region_id
                   FROM users u LEFT JOIN regions r ON u.region_id=r.id
                   ${where} ORDER BY u.full_name ASC LIMIT ? OFFSET ?`;
    const rows   = db.exec(query, [...params, parseInt(limit), offset]);
    const countR = db.exec(`SELECT COUNT(*) FROM users u LEFT JOIN regions r ON u.region_id=r.id ${where}`, params);

    res.json({ members: rows2obj(rows), total: countR[0]?.values[0][0] || 0, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Single member with full ledger
router.get('/members/:id', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const rows = db.exec(`SELECT u.*, r.name as region_name, r.code as region_code
      FROM users u LEFT JOIN regions r ON u.region_id=r.id WHERE u.id=? AND u.is_active=1`, [req.params.id]);
    if (!rows[0]?.values?.length) return res.status(404).json({ error: 'Member not found' });

    const cols = rows[0].columns;
    const member = {};
    cols.forEach((c, i) => member[c] = rows[0].values[0][i]);
    delete member.password_hash;

    res.json({
      member,
      dues:             rows2obj(db.exec(`SELECT * FROM monthly_dues   WHERE user_id=? ORDER BY due_year DESC, due_month DESC`, [req.params.id])),
      program_pledges:  rows2obj(db.exec(`SELECT * FROM program_pledges WHERE user_id=? ORDER BY created_at DESC`,               [req.params.id])),
      other_pledges:    rows2obj(db.exec(`SELECT * FROM other_pledges   WHERE user_id=? ORDER BY created_at DESC`,               [req.params.id])),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// Create member
router.post('/members', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { full_name, email, position, region_id, dept_code } = req.body;
    if (!full_name || !email || !region_id) return res.status(400).json({ error: 'Name, email, and region are required' });

    const db = getDb();
    if (db.exec('SELECT id FROM users WHERE email=?', [email.toLowerCase()])[0]?.values?.length)
      return res.status(409).json({ error: 'Email already exists' });

    const regionRows = db.exec('SELECT code FROM regions WHERE id=?', [region_id]);
    if (!regionRows[0]?.values?.length) return res.status(400).json({ error: 'Invalid region' });

    const regionCode  = regionRows[0].values[0][0];
    const dCode       = (dept_code || 'MED').toUpperCase();
    const userId      = uuidv4();
    const userIdCode  = generateUserId(regionCode, dCode);
    const tempPass    = 'Member@2025';
    const hash        = await bcrypt.hash(tempPass, 10);

    db.run(`INSERT INTO users (id, user_id_code, full_name, email, password_hash, position, region_id, dept_code, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'member')`,
      [userId, userIdCode, full_name.trim(), email.toLowerCase().trim(), hash, position || '', region_id, dCode]);
    saveDatabase();
    auditLog(req.user.id, 'CREATE_MEMBER', 'users', userId, null, { full_name, email, userIdCode });

    res.status(201).json({ message: 'Member created', id: userId, user_id_code: userIdCode, temp_password: tempPass });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// Update member
router.put('/members/:id', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const rows = db.exec('SELECT * FROM users WHERE id=?', [req.params.id]);
    if (!rows[0]?.values?.length) return res.status(404).json({ error: 'Member not found' });

    const cols = rows[0].columns;
    const before = {};
    cols.forEach((c, i) => before[c] = rows[0].values[0][i]);
    delete before.password_hash;

    const { full_name, email, position, region_id, dept_code, is_active } = req.body;
    db.run(`UPDATE users SET full_name=?, email=?, position=?, region_id=?, dept_code=?, is_active=?, updated_at=datetime('now') WHERE id=?`,
      [full_name || before.full_name, email || before.email, position ?? before.position,
       region_id || before.region_id, dept_code || before.dept_code,
       is_active !== undefined ? (is_active ? 1 : 0) : before.is_active, req.params.id]);
    saveDatabase();
    auditLog(req.user.id, 'UPDATE_MEMBER', 'users', req.params.id, before, req.body);
    res.json({ message: 'Member updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Soft-delete member
router.delete('/members/:id', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const rows = db.exec('SELECT full_name FROM users WHERE id=?', [req.params.id]);
    if (!rows[0]?.values?.length) return res.status(404).json({ error: 'Member not found' });
    db.run("UPDATE users SET is_active=0, updated_at=datetime('now') WHERE id=?", [req.params.id]);
    saveDatabase();
    auditLog(req.user.id, 'DELETE_MEMBER', 'users', req.params.id, { full_name: rows[0].values[0][0] }, null);
    res.json({ message: 'Member archived' });
  } catch {
    res.status(500).json({ error: 'Failed to archive member' });
  }
});

// Get regions
router.get('/regions', authenticate, requireSuperAdmin, (req, res) => {
  try {
    res.json(rows2obj(getDb().exec('SELECT * FROM regions ORDER BY name')));
  } catch {
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

    const db = getDb();
    const errors = [], successes = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2;

      const userRows = db.exec('SELECT id FROM users WHERE user_id_code=? OR email=?',
        [row.user_id || '', row.email || '']);
      if (!userRows[0]?.values?.length) {
        errors.push({ row: rowNum, error: `User not found: ${row.user_id || row.email}` }); continue;
      }
      const userId = userRows[0].values[0][0];

      if (row.due_month && row.due_year) {
        const month = parseInt(row.due_month), year = parseInt(row.due_year);
        const status = ['paid','pending','arrears'].includes(row.due_status) ? row.due_status : 'pending';
        if (month < 1 || month > 12 || year < 2000) {
          errors.push({ row: rowNum, error: `Invalid month/year: ${month}/${year}` });
        } else {
          db.run(`INSERT INTO monthly_dues (id, user_id, due_month, due_year, amount, status, updated_by)
            VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(user_id, due_month, due_year) DO UPDATE SET amount=excluded.amount, status=excluded.status, updated_by=excluded.updated_by, updated_at=datetime('now')`,
            [uuidv4(), userId, month, year, parseFloat(row.due_amount)||0, status, req.user.id]);
          successes.push(rowNum);
        }
      }

      if (row.pledge_program) {
        db.run(`INSERT INTO program_pledges (id, user_id, program_name, pledge_amount, status, pledge_date, updated_by)
          VALUES (?,?,?,?,?,?,?)`,
          [uuidv4(), userId, row.pledge_program, parseFloat(row.pledge_amount)||0,
           ['paid','pending','arrears'].includes(row.pledge_status) ? row.pledge_status : 'pending',
           row.pledge_date || null, req.user.id]);
        successes.push(`${rowNum}(pledge)`);
      }
    }

    saveDatabase();
    auditLog(req.user.id, 'BATCH_UPLOAD', 'multiple', null, null, { successes: successes.length, errors: errors.length });
    res.json({ processed: records.length, successes: successes.length, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Batch upload failed: ' + err.message });
  }
});

// Export members to Excel
router.get('/export', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const { region_id } = req.query;
    const conditions = ["u.role='member'", "u.is_active=1"];
    const params = [];
    if (region_id) { conditions.push("u.region_id=?"); params.push(region_id); }

    const members = rows2obj(db.exec(`
      SELECT u.user_id_code, u.full_name, u.email, u.position, r.name as region, u.created_at
      FROM users u LEFT JOIN regions r ON u.region_id=r.id
      WHERE ${conditions.join(' AND ')} ORDER BY r.name, u.full_name`, params));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(members), 'Members');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="members-export.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Audit logs
router.get('/audit-logs', authenticate, requireSuperAdmin, (req, res) => {
  try {
    res.json(rows2obj(getDb().exec(`
      SELECT al.*, u.full_name as actor_name FROM audit_logs al
      LEFT JOIN users u ON al.actor_id=u.id ORDER BY al.created_at DESC LIMIT 100`)));
  } catch {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
