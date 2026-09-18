const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

// firebase-admin v13+ exposes cert() at the top level; older versions used admin.credential.cert().
const certFn = admin.credential?.cert ?? admin.cert;

// Detect Cloud Functions / Cloud Run environment: Application Default Credentials
// (ADC) are automatically provided. In local development, fall back to the
// service-account key file.
const isInCloud = !!(process.env.GCLOUD_PROJECT || process.env.FUNCTIONS_TARGET);

const app = admin.initializeApp(
  isInCloud
    ? {} // ADC — no explicit credential or databaseURL needed
    : {
        credential: certFn(require("./serviceAccountKey.json")),
        databaseURL: "https://yid-due-ledger-default-rtdb.firebaseio.com",
      }
);

// firebase-admin v13+ removed the top-level admin.firestore()/admin.auth() accessors;
// use the modular getFirestore()/getAuth() with the app instance instead.
const db = getFirestore(app);
const auth = getAuth(app);

module.exports = { db, auth, admin, app };
