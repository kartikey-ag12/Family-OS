// ============================================================
// lib/firebase.ts — Firebase client-side initialization
// ============================================================
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

// Singleton pattern — prevents re-initialization in Next.js dev mode
// Guard against missing config (e.g., during static build without .env.local)
const isConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

const app = isConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : undefined;

export const auth = app ? getAuth(app) : null!;
export const db = app ? getFirestore(app) : null!;


// Messaging is only available in browser contexts
export const getMessagingInstance = async () => {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};

export default app;
