import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// If no project id is supplied we run in DEMO MODE on local dummy data.
export const isFirebaseConfigured = Boolean(cfg.projectId && cfg.apiKey);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Enable offline persistence - app works even without internet
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      // Multiple tabs open, persistence can only be enabled in one tab.
      console.warn("Firestore persistence: Multiple tabs detected");
    } else if (err.code === "unimplemented") {
      // Browser doesn't support persistence.
      console.warn("Firestore persistence: Not supported in this browser");
    }
  });
}

export { app, auth, db, storage };
