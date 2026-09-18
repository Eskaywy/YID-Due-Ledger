/**
 * Creates the composite indexes from firestore.indexes.json via the Firestore
 * REST API, using the service account key (no firebase login needed).
 * Rerunnable: already-existing indexes are reported and skipped.
 */
const path = require('path');
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');
const ROOT = path.join(__dirname, '..');

const PROJECT = 'yid-due-ledger';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/collectionGroups`;

// Keep in sync with firestore.indexes.json
const INDEXES = [
  { collectionId: 'monthlyDues', fields: [
    { fieldPath: 'userId', order: 'ASCENDING' },
    { fieldPath: 'dueYear', order: 'DESCENDING' },
    { fieldPath: 'dueMonth', order: 'DESCENDING' },
  ] },
  { collectionId: 'programPledges', fields: [
    { fieldPath: 'userId', order: 'ASCENDING' },
    { fieldPath: 'createdAt', order: 'DESCENDING' },
  ] },
  { collectionId: 'otherPledges', fields: [
    { fieldPath: 'userId', order: 'ASCENDING' },
    { fieldPath: 'createdAt', order: 'DESCENDING' },
  ] },
];

(async () => {
  const out = [];
  try {
    const auth = new GoogleAuth({
            keyFile: path.join(ROOT, 'serviceAccountKey.json'),
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error('could not obtain access token from service account');
    out.push('access token obtained from serviceAccountKey.json: yes');

    for (const idx of INDEXES) {
      const url = `${BASE}/${idx.collectionId}/indexes`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryScope: 'COLLECTION', fields: idx.fields }),
      });
      const bodyText = await res.text();
      const fieldList = idx.fields.map(f => f.fieldPath).join(', ');
      if (res.status === 200) out.push(`CREATED        : ${idx.collectionId} (${fieldList})`);
      else if (res.status === 409) out.push(`ALREADY EXISTS : ${idx.collectionId} (${fieldList})`);
      else out.push(`FAILED (${res.status}): ${idx.collectionId} -> ${bodyText.slice(0, 500)}`);
    }

    const listRes = await fetch(`${BASE}/-/indexes`, { headers: { Authorization: `Bearer ${token}` } });
    const list = JSON.parse(await listRes.text());
    out.push('');
    out.push('---- composite indexes now on the (default) database ----');
    for (const ix of list.indexes || []) {
      const collId = decodeURIComponent(((ix.name || '').split('/collectionGroups/')[1] || '?').split('/indexes')[0]);
      const fields = (ix.fields || []).map(f => `${f.fieldPath} ${f.order || f.arrayConfig || ''}`).join(' | ');
      out.push(`${collId}: state=${ix.state || '?'} | ${fields}`);
    }
    out.push('RESULT: DONE');
  } catch (e) {
    out.push('RESULT: ERROR - ' + (e && e.message));
  }
    fs.writeFileSync(path.join(ROOT, 'indexes-rest-result.txt'), out.join('\n'));
  console.log(out.join('\n'));
})();