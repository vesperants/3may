// src/services/firebase/config.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore"; // Keep if using Firestore client-side

console.log("Firebase Client Config: Loading configuration...");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Basic validation
let configValid = true;
for (const [key, value] of Object.entries(firebaseConfig)) {
    const envVarName = `NEXT_PUBLIC_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    if (!value) {
        console.error(`❌ Firebase Client Config: Missing environment variable: ${envVarName}`);
        configValid = false;
    }
}

if (!configValid) {
    console.error("❌ Firebase Client configuration is incomplete. Check environment variables starting with NEXT_PUBLIC_FIREBASE_");
    // Optional: Throw an error to prevent app initialization with bad config
    // throw new Error("Firebase client configuration is incomplete.");
} else {
    console.log("✅ Firebase Client configuration loaded successfully.");
}


let app: FirebaseApp;
if (!getApps().length) {
  console.log("Firebase Client Config: Initializing Firebase Client App...");
  app = initializeApp(firebaseConfig);
  console.log("✅ Firebase Client App initialized.");
} else {
  console.log("Firebase Client Config: Using existing Firebase Client App.");
  app = getApp();
}

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app); // Keep if using Firestore client-side

console.log("✅ Firebase Client Auth instance obtained.");

export { app, auth, db }; // Export db if needed