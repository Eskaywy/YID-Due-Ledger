const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data', 'drdp.sqlite');
let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys=ON;');
  createTables();
  seedData();
  saveDatabase();
  console.log('Database initialized');
}

function createTables() {
  db.run(`CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Only two roles: member, super_admin
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    user_id_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    position TEXT,
    region_id TEXT REFERENCES regions(id),
    dept_code TEXT DEFAULT 'MED',
    role TEXT DEFAULT 'member' CHECK(role IN ('member','super_admin')),
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS monthly_dues (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    due_month INTEGER NOT NULL CHECK(due_month BETWEEN 1 AND 12),
    due_year INTEGER NOT NULL,
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('paid','pending','arrears')),
    updated_by TEXT REFERENCES users(id),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, due_month, due_year)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS program_pledges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_name TEXT NOT NULL,
    pledge_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('paid','pending','arrears')),
    pledge_date TEXT,
    updated_by TEXT REFERENCES users(id),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS other_pledges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    pledge_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('paid','pending','arrears')),
    pledge_date TEXT,
    updated_by TEXT REFERENCES users(id),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    target_table TEXT,
    target_id TEXT,
    before_value TEXT,
    after_value TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS user_id_sequences (
    region_code TEXT NOT NULL,
    dept_code TEXT NOT NULL,
    year_month TEXT NOT NULL,
    last_seq INTEGER DEFAULT 0,
    PRIMARY KEY (region_code, dept_code, year_month)
  )`);
}

function seedData() {
  const existing = db.exec("SELECT COUNT(*) as cnt FROM regions");
  if (existing[0]?.values[0][0] > 0) return;

  const lgsId = uuidv4();
  const swrId = uuidv4();
  db.run('INSERT INTO regions (id, name, code) VALUES (?, ?, ?)', [lgsId, 'Lagos', 'LGS']);
  db.run('INSERT INTO regions (id, name, code) VALUES (?, ?, ?)', [swrId, 'South-West', 'SWR']);

  // Super Admin (only admin role)
  const superAdminId = uuidv4();
  db.run(`INSERT INTO users (id, user_id_code, full_name, email, password_hash, position, region_id, dept_code, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [superAdminId, 'LGS-MED-202506-0001', 'Super Administrator', 'superadmin@drdp.ng',
     bcrypt.hashSync('Admin@2025', 10), 'Super Administrator', lgsId, 'MED', 'super_admin']
  );

  // Demo members
  const members = [
    { name: 'Adewale Ogundimu',  email: 'adewale@drdp.ng',  position: 'Journalist',   region_id: lgsId, seq: '0002' },
    { name: 'Chidinma Okafor',   email: 'chidinma@drdp.ng', position: 'Editor',        region_id: lgsId, seq: '0003' },
    { name: 'Babatunde Fashola', email: 'babs@drdp.ng',     position: 'Correspondent', region_id: lgsId, seq: '0004' },
    { name: 'Ngozi Adeyemi',     email: 'ngozi@drdp.ng',    position: 'Producer',      region_id: swrId, seq: '0005' },
    { name: 'Seun Abegunrin',    email: 'seun@drdp.ng',     position: 'Presenter',     region_id: swrId, seq: '0006' },
  ];

  const memberHash = bcrypt.hashSync('Member@2025', 10);
  const memberIds = [];
  for (const m of members) {
    const mid = uuidv4();
    memberIds.push(mid);
    const rc = m.region_id === lgsId ? 'LGS' : 'SWR';
    db.run(`INSERT INTO users (id, user_id_code, full_name, email, password_hash, position, region_id, dept_code, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'member')`,
      [mid, `${rc}-MED-202506-${m.seq}`, m.name, m.email, memberHash, m.position, m.region_id, 'MED']
    );
  }

  // Seed monthly dues
  const dueStatuses = ['paid','paid','paid','paid','arrears','pending'];
  const dueMonths   = [1, 2, 3, 4, 5, 6];
  for (const mid of memberIds.slice(0, 3)) {
    dueMonths.forEach((month, i) => {
      db.run(`INSERT INTO monthly_dues (id, user_id, due_month, due_year, amount, status, updated_by)
        VALUES (?, ?, ?, 2025, 2000, ?, ?)`,
        [uuidv4(), mid, month, dueStatuses[i], superAdminId]
      );
    });
  }

  // Seed program pledges
  for (const mid of memberIds) {
    db.run(`INSERT INTO program_pledges (id, user_id, program_name, pledge_amount, status, pledge_date, updated_by)
      VALUES (?, ?, 'Annual Dinner 2025', 5000, ?, '2025-03-15', ?)`,
      [uuidv4(), mid, mid === memberIds[0] ? 'paid' : 'pending', superAdminId]
    );
    db.run(`INSERT INTO program_pledges (id, user_id, program_name, pledge_amount, status, pledge_date, updated_by)
      VALUES (?, ?, 'Media Week 2025', 3000, 'pending', '2025-06-20', ?)`,
      [uuidv4(), mid, superAdminId]
    );
  }

  // Seed other pledges
  for (const mid of memberIds.slice(0, 3)) {
    db.run(`INSERT INTO other_pledges (id, user_id, description, pledge_amount, status, pledge_date, updated_by)
      VALUES (?, ?, 'Building Fund Contribution', 10000, 'pending', '2025-01-10', ?)`,
      [uuidv4(), mid, superAdminId]
    );
  }

  db.run(`INSERT OR IGNORE INTO user_id_sequences VALUES ('LGS','MED','202506',6)`);
  db.run(`INSERT OR IGNORE INTO user_id_sequences VALUES ('SWR','MED','202506',2)`);

  console.log('Seed data inserted');
}

function saveDatabase() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function getDb() { return db; }

setInterval(saveDatabase, 30000);

function generateUserId(regionCode, deptCode) {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  db.run(`INSERT INTO user_id_sequences (region_code, dept_code, year_month, last_seq) VALUES (?,?,?,1)
    ON CONFLICT(region_code,dept_code,year_month) DO UPDATE SET last_seq=last_seq+1`,
    [regionCode, deptCode, ym]);
  saveDatabase();
  const r = db.exec(`SELECT last_seq FROM user_id_sequences WHERE region_code=? AND dept_code=? AND year_month=?`,
    [regionCode, deptCode, ym]);
  const seq = r[0]?.values[0][0] || 1;
  return `${regionCode}-${deptCode}-${ym}-${String(seq).padStart(4,'0')}`;
}

module.exports = { initDatabase, getDb, saveDatabase, generateUserId };
