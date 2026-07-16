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

module.exports = { initDatabase, db, auth, generateUserId };
