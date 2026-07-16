import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA-q-0062IHsJc9fg0Zs3Pnkp9y-JJ6Asg",
  authDomain: "yid-due-ledger.firebaseapp.com",
  projectId: "yid-due-ledger",
  storageBucket: "yid-due-ledger.firebasestorage.app",
  messagingSenderId: "1053678365407",
  appId: "1:1053678365407:web:e04502e592c1b6b65c976a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage, app };
