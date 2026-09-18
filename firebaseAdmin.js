const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

// firebase-admin v13+ exposes cert() at the top level; older versions used admin.credential.cert().
const certFn = admin.credential?.cert ?? admin.cert;

// Detect Cloud Functions / Cloud Run environment: Application Default Credentials
// (ADC) are automatically provided. In local development, fall back to the
// service-account key file.
const isInCloud = !!(process.env.GCLOUD_PROJECT || process.env.FUNCTIONS_TARGET);

// Vercel also uses a cloud environment — credentials come from env vars, not a file.
const isOnVercel = !!process.env.VERCEL;

let credential;
if (isInCloud || isOnVercel) {
  // Cloud / Vercel: use ADC (no explicit credential needed) — firebase-admin
  // automatically picks up credentials from the runtime environment.
  credential = undefined;
} else {
  // Local development: load from serviceAccountKey.json (gitignored — keep it secure).
  try {
    credential = certFn(require("./serviceAccountKey.json"));
  } catch (err) {
    console.error("Failed to load serviceAccountKey.json — is it in the project root?");
    throw err;
  }
}

const app = admin.initializeApp(
  credential
    ? {
        credential,
        databaseURL: "https://yid-due-ledger-default-rtdb.firebaseio.com",
      }
    : {} // ADC — no explicit credential or databaseURL needed
);

// firebase-admin v13+ removed the top-level admin.firestore()/admin.auth() accessors;
// use the modular getFirestore()/getAuth() with the app instance instead.
const db = getFirestore(app);
const auth = getAuth(app);

module.exports = { db, auth, admin, app };
