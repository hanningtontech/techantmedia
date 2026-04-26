/**
 * Browser Firebase client (Auth, Firestore, Analytics).
 * Do not use `firebase-admin` or service account JSON here — Admin SDK is Node-only and will not run in Vite/React.
 */
import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

function readConfig(): FirebaseOptions | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  const cfg: FirebaseOptions = {
    apiKey,
    authDomain,
    projectId,
    storageBucket: storageBucket ?? "",
    messagingSenderId: messagingSenderId ?? "",
    appId,
  };
  if (measurementId) {
    cfg.measurementId = measurementId;
  }
  return cfg;
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let analytics: Analytics | null = null;
let storage: FirebaseStorage | null = null;
let analyticsBootStarted = false;

export function isFirebaseConfigured(): boolean {
  return readConfig() !== null;
}

export function getFirebaseApp(): FirebaseApp {
  const cfg = readConfig();
  if (!cfg) {
    throw new Error("Missing VITE_FIREBASE_* environment variables.");
  }
  if (!app) {
    const existing = getApps()[0];
    app = existing ?? initializeApp(cfg);
  }
  if (!analyticsBootStarted) {
    analyticsBootStarted = true;
    void initAnalyticsWhenReady(app);
  }
  return app;
}

async function initAnalyticsWhenReady(fa: FirebaseApp) {
  if (typeof window === "undefined") return;
  if (analytics) return;
  if (!import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) return;
  try {
    if (await isSupported()) {
      analytics = getAnalytics(fa);
    }
  } catch {
    /* Analytics optional */
  }
}

/** Google Analytics (web) when supported and measurementId is set. */
export function getFirebaseAnalytics(): Analytics | null {
  return analytics;
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
}

/** Safe for UI: returns null when env is incomplete (portfolio still works without NCLEX). */
export function tryGetFirestoreDb(): Firestore | null {
  try {
    if (!isFirebaseConfigured()) return null;
    return getFirestoreDb();
  } catch {
    return null;
  }
}

export function tryGetFirebaseAuth(): Auth | null {
  try {
    if (!isFirebaseConfigured()) return null;
    return getFirebaseAuth();
  } catch {
    return null;
  }
}

export function tryGetFirebaseStorage(): FirebaseStorage | null {
  try {
    if (!isFirebaseConfigured()) return null;
    return getFirebaseStorage();
  } catch {
    return null;
  }
}
