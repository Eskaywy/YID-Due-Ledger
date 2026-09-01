const { db, auth } = require("./firebaseAdmin");
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const initDatabase = async () => {
  console.log('Checking Firestore for existing data...');
  const regionsSnapshot = await db.collection('regions').limit(1).get();
  if (regionsSnapshot.empty) {
    console.log('Seeding initial data...');
    await seedData();
  } else {
    console.log('Firestore already has data.');
  }
};

const seedData = async () => {
  const lgsId = uuidv4();
  const swrId = uuidv4();
  await db.collection('regions').doc(lgsId).set({
    id: lgsId,
    name: 'Lagos',
    code: 'LGS',
    createdAt: new Date().toISOString(),
  });
  await db.collection('regions').doc(swrId).set({
    id: swrId,
    name: 'South-West',
    code: 'SWR',
    createdAt: new Date().toISOString(),
  });

  const superAdminId = uuidv4();
  const superAdminPasswordHash = await bcrypt.hash('Admin@2025', 10);
  await db.collection('users').doc(superAdminId).set({
    id: superAdminId,
    userIdCode: 'LGS-MED-202506-0001',
    fullName: 'Super Administrator',
    email: 'superadmin@drdp.ng',
    passwordHash: superAdminPasswordHash,
    position: 'Super Administrator',
    regionId: lgsId,
    deptCode: 'MED',
    role: 'super_admin',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const memberPasswordHash = await bcrypt.hash('Member@2025', 10);
  const members = [
    { name: 'Adewale Ogundimu', email: 'adewale@drdp.ng', position: 'Journalist', regionId: lgsId, seq: '0002' },
    { name: 'Chidinma Okafor', email: 'chidinma@drdp.ng', position: 'Editor', regionId: lgsId, seq: '0003' },
    { name: 'Babatunde Fashola', email: 'babs@drdp.ng', position: 'Correspondent', regionId: lgsId, seq: '0004' },
    { name: 'Ngozi Adeyemi', email: 'ngozi@drdp.ng', position: 'Producer', regionId: swrId, seq: '0005' },
    { name: 'Seun Abegunrin', email: 'seun@drdp.ng', position: 'Presenter', regionId: swrId, seq: '0006' },
  ];
  const memberIds = [];
  for (const m of members) {
    const mid = uuidv4();
    memberIds.push(mid);
    const rc = m.regionId === lgsId ? 'LGS' : 'SWR';
    await db.collection('users').doc(mid).set({
      id: mid,
      userIdCode: `${rc}-MED-202506-${m.seq}`,
      fullName: m.name,
      email: m.email,
      passwordHash: memberPasswordHash,
      position: m.position,
      regionId: m.regionId,
      deptCode: 'MED',
      role: 'member',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const dueStatuses = ['paid','paid','paid','paid','arrears','pending'];
  const dueMonths   = [1, 2, 3, 4, 5, 6];
  for (const mid of memberIds.slice(0, 3)) {
    for (let i = 0; i < dueMonths.length; i++) {
      const dueId = uuidv4();
      await db.collection('monthlyDues').doc(dueId).set({
        id: dueId,
        userId: mid,
        dueMonth: dueMonths[i],
        dueYear: 2025,
        amount: 2000,
        status: dueStatuses[i],
        updatedBy: superAdminId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  for (const mid of memberIds) {
    const pledge1Id = uuidv4();
    await db.collection('programPledges').doc(pledge1Id).set({
      id: pledge1Id,
      userId: mid,
      programName: 'Annual Dinner 2025',
      pledgeAmount: 5000,
      status: mid === memberIds[0] ? 'paid' : 'pending',
      pledgeDate: '2025-03-15',
      updatedBy: superAdminId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const pledge2Id = uuidv4();
    await db.collection('programPledges').doc(pledge2Id).set({
      id: pledge2Id,
      userId: mid,
      programName: 'Media Week 2025',
      pledgeAmount: 3000,
      status: 'pending',
      pledgeDate: '2025-06-20',
      updatedBy: superAdminId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  for (const mid of memberIds.slice(0, 3)) {
    const pledgeId = uuidv4();
    await db.collection('otherPledges').doc(pledgeId).set({
      id: pledgeId,
      userId: mid,
      description: 'Building Fund Contribution',
      pledgeAmount: 10000,
      status: 'pending',
      pledgeDate: '2025-01-10',
      updatedBy: superAdminId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  await db.collection('userIdSequences').doc('LGS-MED-202506').set({ regionCode: 'LGS', deptCode: 'MED', yearMonth: '202506', lastSeq: 6 });
  await db.collection('userIdSequences').doc('SWR-MED-202506').set({ regionCode: 'SWR', deptCode: 'MED', yearMonth: '202506', lastSeq: 2 });

  console.log('Firestore seed data inserted!');
};

// ---- Smart Ledger ID minting (ported from the prototype's js/app.js) ----
// Format: [REGION]-[DEPT]-[serial], e.g. LA1-MED-1001
const REGION_PREFIX_OVERRIDES = {
  'Lagos 1': 'LA1',
  'Lagos 2': 'LA2',
  'Southwest 3': 'SW3',
  'North 1': 'NT1',
  'Southeast': 'SET',
};

// First 3 letters of a name, uppercase (Media -> MED, Information -> INF)
const prefixFromName = (name) =>
  (((name || '').replace(/[^A-Za-z]/g, '').toUpperCase()) + 'XXX').slice(0, 3);

// Region prefix: curated override, else the stored code, else derived from the name
const regionPrefixFor = (name, code) =>
  REGION_PREFIX_OVERRIDES[name] || (code ? String(code).toUpperCase() : null) || prefixFromName(name);

// Serial lives in counters/member_serial and is bumped inside a transaction so
// concurrent sign-ups can never mint the same serial (README requirement).
const generateSmartId = async ({ regionName, regionCode, deptName, deptCode }) => {
  const rPrefix = regionPrefixFor(regionName, regionCode);
  const dPrefix = (deptCode || prefixFromName(deptName)).toUpperCase();
  const counterRef = db.collection('counters').doc('member_serial');
  const serial = await db.runTransaction(async (txn) => {
    const snap = await txn.get(counterRef);
    const next = (snap.exists ? (snap.data().value || 1000) : 1000) + 1;
    txn.set(counterRef, { value: next }, { merge: true });
    return next;
  });
  return `${rPrefix}-${dPrefix}-${serial}`;
};

const generateUserId = async (regionCode, deptCode) => {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const docId = `${regionCode}-${deptCode}-${ym}`;
  const docRef = db.collection('userIdSequences').doc(docId);
  const doc = await docRef.get();
  let lastSeq = 1;
  if (doc.exists) {
    lastSeq = doc.data().lastSeq + 1;
    await docRef.update({ lastSeq });
  } else {
    await docRef.set({ regionCode, deptCode, yearMonth: ym, lastSeq });
  }
  return `${regionCode}-${deptCode}-${ym}-${String(lastSeq).padStart(4,'0')}`;
};

// Upsert-by-name helpers backing the prototype's "Other" dropdowns (signup.html):
// if the signup form names a department/region that doesn't exist yet, it is
// created and becomes a standard option for everyone afterwards.
const findOrCreateNamed = async (collectionName, rawName, buildCode) => {
  const name = String(rawName || '').trim();
  if (!name) return null;
  const snapshot = await db.collection(collectionName).get();
  const lower = name.toLowerCase();
  const existing = snapshot.docs.find(
    d => String(d.data().name || '').trim().toLowerCase() === lower
  );
  if (existing) {
    const data = existing.data();
    return { id: data.id ?? existing.id, name: data.name, code: data.code ?? null };
  }
  const ref = db.collection(collectionName).doc();
  const doc = { id: ref.id, name, code: buildCode(name), createdAt: new Date().toISOString() };
  await ref.set(doc);
  return doc;
};

// Resolve a department by code first (existing dropdown pick), else by name
// (the "Other" path — new entries get a 3-letter code like INF/MED).
const findOrCreateDepartment = async (deptCode, deptName) => {
  const code = String(deptCode || '').trim().toUpperCase();
  if (code) {
    const snap = await db.collection('departments').where('code', '==', code).limit(1).get();
    if (!snap.empty) return snap.docs[0].data();
  }
  return findOrCreateNamed('departments', deptName, prefixFromName);
};

// Resolve a region by id first, else upsert by name ("Other" path — the code
// honours the prototype's prefix overrides, e.g. "Lagos 2" -> LA2).
const findOrCreateRegion = async (regionId, regionName) => {
  if (regionId) {
    const doc = await db.collection('regions').doc(String(regionId)).get();
    if (doc.exists) {
      const data = doc.data();
      return { id: data.id ?? doc.id, name: data.name, code: data.code ?? null };
    }
  }
  return findOrCreateNamed('regions', regionName, (n) => regionPrefixFor(n, null));
};

module.exports = { initDatabase, db, auth, generateUserId, generateSmartId, prefixFromName, regionPrefixFor, findOrCreateDepartment, findOrCreateRegion };
