const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const serviceAccount = require("./serviceAccountKey.json");

// firebase-admin v13+ exposes cert() at the top level; older versions used admin.credential.cert().
const certFn = admin.credential?.cert ?? admin.cert;

const app = admin.initializeApp({
  credential: certFn(serviceAccount),
  databaseURL: "https://yid-due-ledger-default-rtdb.firebaseio.com", // Optional if using Firestore
});

// firebase-admin v13+ removed the top-level admin.firestore()/admin.auth() accessors;
// use the modular getFirestore()/getAuth() with the app instance instead.
const db = getFirestore(app);
const auth = getAuth(app);

module.exports = { db, auth, admin, app };
