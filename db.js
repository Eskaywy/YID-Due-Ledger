const { supabase } = require("./supabaseAdmin");
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const initDatabase = async () => {
  console.log('Checking Supabase for existing data...');
  const { count, error } = await supabase
    .from('regions')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  if (!count) {
    console.log('Seeding initial data...');
    await seedData();
  } else {
    console.log('Supabase already has data.');
  }
};

const seedData = async () => {
  const lgsId = uuidv4();
  const swrId = uuidv4();
  const now = new Date().toISOString();
  const { error: regionErr } = await supabase.from('regions').insert([
    { id: lgsId, name: 'Lagos', code: 'LGS', created_at: now },
    { id: swrId, name: 'South-West', code: 'SWR', created_at: now },
  ]);
  if (regionErr) throw regionErr;

  // FIX: users below all set dept_code: 'MED', but no departments row for
  // it was ever created. dept_code has no FK constraint, so this alone
  // wouldn't fail -- but leaving it out means the department name/id is
  // never resolvable later (e.g. anywhere the app looks up 'MED' by code).
  const { error: deptErr } = await supabase.from('departments').insert([
    { id: uuidv4(), name: 'Media', code: 'MED', created_at: now },
  ]);
  if (deptErr) throw deptErr;

  const superAdminId = uuidv4();
  const superAdminPasswordHash = await bcrypt.hash('Admin@2025', 10);
  const memberPasswordHash = await bcrypt.hash('Member@2025', 10);
  // FIX: seq numbers must restart per region (user_id_sequences is keyed
  // by region_code + dept_code + year_month, see next_user_sequence()).
  // SWR members were previously numbered 0005/0006, continuing LGS's
  // count, instead of starting their own region's count at 0001.
  const memberSeeds = [
    { name: 'Adewale Ogundimu', email: 'adewale@drdp.ng', position: 'Journalist', regionId: lgsId, rc: 'LGS', seq: '0002' },
    { name: 'Chidinma Okafor', email: 'chidinma@drdp.ng', position: 'Editor', regionId: lgsId, rc: 'LGS', seq: '0003' },
    { name: 'Babatunde Fashola', email: 'babs@drdp.ng', position: 'Correspondent', regionId: lgsId, rc: 'LGS', seq: '0004' },
    { name: 'Ngozi Adeyemi', email: 'ngozi@drdp.ng', position: 'Producer', regionId: swrId, rc: 'SWR', seq: '0001' },
    { name: 'Seun Abegunrin', email: 'seun@drdp.ng', position: 'Presenter', regionId: swrId, rc: 'SWR', seq: '0002' },
  ];
  const memberIds = memberSeeds.map(() => uuidv4());

  const userRows = [
    {
      id: superAdminId,
      user_id_code: 'LGS-MED-202506-0001',
      full_name: 'Super Administrator',
      email: 'superadmin@drdp.ng',
      password_hash: superAdminPasswordHash,
      position: 'Super Administrator',
      region_id: lgsId,
      dept_code: 'MED',
      role: 'super_admin',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    ...memberSeeds.map((m, i) => ({
      id: memberIds[i],
      user_id_code: `${m.rc}-MED-202506-${m.seq}`,
      full_name: m.name,
      email: m.email,
      password_hash: memberPasswordHash,
      position: m.position,
      region_id: m.regionId,
      dept_code: 'MED',
      role: 'member',
      is_active: true,
      created_at: now,
      updated_at: now,
    })),
  ];
  const { error: userErr } = await supabase.from('users').insert(userRows);
  if (userErr) throw userErr;

  const dueStatuses = ['paid','paid','paid','paid','arrears','pending'];
  const dueMonths   = [1, 2, 3, 4, 5, 6];
  const dueRows = [];
  for (const mid of memberIds.slice(0, 3)) {
    for (let i = 0; i < dueMonths.length; i++) {
      dueRows.push({
        id: uuidv4(),
        user_id: mid,
        due_month: dueMonths[i],
        due_year: 2025,
        amount: 2000,
        status: dueStatuses[i],
        updated_by: superAdminId,
        created_at: now,
        updated_at: now,
      });
    }
  }
  const { error: dueErr } = await supabase.from('monthly_dues').insert(dueRows);
  if (dueErr) throw dueErr;

  const programRows = [];
  for (const mid of memberIds) {
    programRows.push(
      {
        id: uuidv4(), user_id: mid, program_name: 'Annual Media Conference',
        pledge_amount: 50000, status: 'pending', pledge_date: '2025-06-15',
        updated_by: superAdminId, created_at: now, updated_at: now,
      },
      {
        id: uuidv4(), user_id: mid, program_name: 'Community Outreach',
        pledge_amount: 25000, status: 'paid', pledge_date: '2025-05-10',
        updated_by: superAdminId, created_at: now, updated_at: now,
      }
    );
  }
  const otherRows = memberIds.slice(0, 3).map((mid) => ({
    id: uuidv4(), user_id: mid, description: 'Building fund',
    pledge_amount: 10000, status: 'pending', pledge_date: '2025-04-01',
    updated_by: superAdminId, created_at: now, updated_at: now,
  }));

  const { error: pledgeErr } = await supabase.from('program_pledges').insert(programRows);
  if (pledgeErr) throw pledgeErr;
  const { error: otherErr } = await supabase.from('other_pledges').insert(otherRows);
  if (otherErr) throw otherErr;

  // FIX: last_seq must reflect how many codes were actually used in each
  // region's own (region, dept, month) bucket. LGS used 0001-0004 (4
  // users: super admin + 3 members), not 6 -- the old value of 6 would
  // cause the next real LGS signup to skip straight to 0007. SWR's value
  // of 2 was already correct once SWR's own codes restart at 0001.
  const { error: seqErr } = await supabase.from('user_id_sequences').insert([
    { region_code: 'LGS', dept_code: 'MED', year_month: '202506', last_seq: 4 },
    { region_code: 'SWR', dept_code: 'MED', year_month: '202506', last_seq: 2 },
  ]);
  if (seqErr) throw seqErr;

  console.log('Supabase seed data inserted!');
};

// ---- Smart Ledger ID minting (ported from the prototype's js/app.js) ----
// Format: [REGION]-[DEPT]-[serial], e.g. LA1-MED-1001
const REGION_PREFIX_OVERRIDES = {
  'Lagos 1': 'LA1',
  'Lagos 2': 'LA2',
};

// First 3 letters of a name, uppercase (Media -> MED, Information -> INF)
const prefixFromName = (name) =>
  (((name || '').replace(/[^A-Za-z]/g, '').toUpperCase()) + 'XXX').slice(0, 3);
// Region prefix: curated override, else the stored code, else derived from the name
const regionPrefixFor = (name, code) =>
  REGION_PREFIX_OVERRIDES[name] || (code ? String(code).toUpperCase() : null) || prefixFromName(name);

// Serial lives in counters/member_serial and is bumped atomically by the
// Postgres function next_member_serial() (supabase/schema.sql) so concurrent
// sign-ups can never mint the same serial (README requirement).
const generateSmartId = async ({ regionName, regionCode, deptName, deptCode }) => {
  const rPrefix = regionPrefixFor(regionName, regionCode);
  const dPrefix = (deptCode || prefixFromName(deptName)).toUpperCase();
  const { data, error } = await supabase.rpc('next_member_serial');
  if (error) throw error;
  const serial = data;
  return `${rPrefix}-${dPrefix}-${serial}`;
};

const generateUserId = async (regionCode, deptCode) => {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  // Atomic per (region, dept, month) sequence via the next_user_sequence RPC.
  const { data, error } = await supabase.rpc('next_user_sequence', {
    p_region_code: regionCode,
    p_dept_code: deptCode,
    p_year_month: ym,
  });
  if (error) throw error;
  return `${regionCode}-${deptCode}-${ym}-${String(data).padStart(4, '0')}`;
};

// Upsert-by-name helpers backing the prototype's "Other" dropdowns (signup.html):
// if the signup form names a department/region that doesn't exist yet, it is
// created and becomes a standard option for everyone afterwards.
const findOrCreateNamed = async (tableName, rawName, buildCode) => {
  const name = String(rawName || '').trim();
  if (!name) return null;
  const lower = name.toLowerCase();
  const { data: existing, error: selErr } = await supabase
    .from(tableName)
    .select('*')
    .ilike('name', name)
    .limit(1);
  if (selErr) throw selErr;
  if (existing && existing.length && String(existing[0].name || '').trim().toLowerCase() === lower) {
    const row = existing[0];
    return { id: row.id, name: row.name, code: row.code ?? null };
  }
  const doc = { id: uuidv4(), name, code: buildCode(name), created_at: new Date().toISOString() };
  const { error: insErr } = await supabase.from(tableName).insert(doc);
  if (insErr && insErr.code !== '23505') throw insErr; // tolerate a concurrent insert race
  if (insErr) {
    // Lost the race — re-select the winner.
    const { data: winner } = await supabase.from(tableName).select('*').ilike('name', name).limit(1);
    if (winner && winner.length) {
      return { id: winner[0].id, name: winner[0].name, code: winner[0].code ?? null };
    }
    throw insErr;
  }
  return doc;
};

// Resolve a department by code first (existing dropdown pick), else by name
// (the "Other" path — new entries get a 3-letter code like INF/MED).
const findOrCreateDepartment = async (deptCode, deptName) => {
  const code = String(deptCode || '').trim().toUpperCase();
  if (code) {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('code', code)
      .limit(1);
    if (error) throw error;
    if (data && data.length) {
      const row = data[0];
      return { id: row.id, name: row.name, code: row.code ?? null };
    }
  }
  return findOrCreateNamed('departments', deptName, prefixFromName);
};

// Resolve a region by id first, else upsert by name ("Other" path — the code
// honours the prototype's prefix overrides, e.g. "Lagos 2" -> LA2).
const findOrCreateRegion = async (regionId, regionName) => {
  if (regionId) {
    const { data, error } = await supabase
      .from('regions')
      .select('*')
      .eq('id', String(regionId))
      .limit(1);
    if (error) throw error;
    if (data && data.length) {
      const row = data[0];
      return { id: row.id, name: row.name, code: row.code ?? null };
    }
  }
  return findOrCreateNamed('regions', regionName, (n) => regionPrefixFor(n, null));
};

module.exports = { initDatabase, supabase, generateUserId, generateSmartId, prefixFromName, regionPrefixFor, findOrCreateDepartment, findOrCreateRegion };