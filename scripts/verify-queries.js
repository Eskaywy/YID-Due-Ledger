/**
 * Verifies the composite indexes by running the exact query shapes used in
 * routes/members.js and routes/admin.js. A missing index makes these queries
 * throw FAILED_PRECONDITION — so PASS here means the index works end-to-end.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { db } = require(path.join(ROOT, 'firebaseAdmin.js'));

(async () => {
  const out = [];
  try {
    const uSnap = await db.collection('users').limit(1).get();
    if (uSnap.empty) throw new Error('no users found to test with');
    const u = uSnap.docs[0].data();
    const uid = u.userId || u.uid || uSnap.docs[0].id;
    out.push(`testing with seeded user: ${uid} (empty result is still a PASS — index validity is checked before matching)`);

    const tests = [
      ['monthlyDues    : userId== -> dueYear desc, dueMonth desc', () =>
        db.collection('monthlyDues').where('userId', '==', uid).orderBy('dueYear', 'desc').orderBy('dueMonth', 'desc').limit(5).get()],
      ['programPledges : userId== -> createdAt desc', () =>
        db.collection('programPledges').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(5).get()],
      ['otherPledges   : userId== -> createdAt desc', () =>
        db.collection('otherPledges').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(5).get()],
    ];
    for (const [label, run] of tests) {
      try {
        const s = await run();
        out.push(`PASS (${s.size} doc(s)) : ${label}`);
      } catch (e) {
        out.push(`FAIL : ${label} -> ${e.code || ''} ${e.message}`);
      }
    }
    out.push('RESULT: DONE');
  } catch (e) {
    out.push('RESULT: ERROR - ' + e.message);
  }
    fs.writeFileSync(path.join(ROOT, 'verify-queries-result.txt'), out.join('\n'));
  console.log(out.join('\n'));
})();