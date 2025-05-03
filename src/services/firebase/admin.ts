// src/services/firebase/admin.ts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore'; // Keep if you need Firestore admin later
import path from 'path';
import fs from 'fs';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore; // Keep if you need Firestore admin later

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

let credential;

console.log("Firebase Admin: Attempting to load credentials...");

if (serviceAccountJson) {
  try {
    console.log("Firebase Admin: Initializing with JSON from env var FIREBASE_SERVICE_ACCOUNT...");
    const serviceAccount = JSON.parse(serviceAccountJson);
    credential = cert(serviceAccount);
    console.log("Firebase Admin: Successfully parsed service account JSON from env var.");
  } catch (e) {
    console.error("❌ Firebase Admin: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", e);
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT JSON environment variable.");
  }
} else if (serviceAccountPath) {
  try {
    const absolutePath = path.resolve(process.cwd(), serviceAccountPath);
    console.log(`Firebase Admin: Initializing with path FIREBASE_SERVICE_ACCOUNT_PATH: ${absolutePath}`);
     if (!fs.existsSync(absolutePath)) {
        console.error(`❌ Firebase Admin: Service account file not found at specified path: ${absolutePath}`);
        throw new Error(`Service account file not found at: ${absolutePath}`);
     }
    credential = cert(absolutePath);
    console.log("Firebase Admin: Successfully loaded service account from file path.");
  } catch (e) {
     console.error("❌ Firebase Admin: Failed to initialize from path:", e);
     throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_PATH or file content.");
  }
} else {
   console.error("❌ Firebase Admin: Credentials missing. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH environment variable.");
   throw new Error("Firebase Admin credentials missing.");
}


if (!getApps().length) {
  console.log("Firebase Admin: Initializing Firebase Admin App...");
  adminApp = initializeApp({ credential });
  console.log("✅ Firebase Admin: App initialized.");
} else {
  console.log("Firebase Admin: Using existing Firebase Admin App.");
  adminApp = getApps()[0];
}

adminAuth = getAuth(adminApp);
adminDb = getFirestore(adminApp); // Keep if you need Firestore admin later

console.log("✅ Firebase Admin: Auth instance obtained.");

export { adminApp, adminAuth, adminDb }; // Export adminDb if needed elsewhere