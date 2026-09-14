// ============================================================
// lib/firebaseAdmin.ts — Firebase Admin SDK (server-side only)
// Used for sending FCM push notifications from API routes
// ============================================================
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Only initialize if credentials are present (skips during build/CI)
const hasCredentials =
  Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );

let adminApp: App | null = null;

function parsePrivateKey(rawKey: string): string {
  let key = rawKey.trim();
  // Remove wrapping quotes if present
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // Convert escaped newlines
  key = key.replace(/\\n/g, "\n");

  // Ensure header and footer
  if (!key.includes("-----BEGIN PRIVATE KEY-----")) {
    key = `-----BEGIN PRIVATE KEY-----\n${key.trim()}\n-----END PRIVATE KEY-----\n`;
  }
  return key;
}

if (hasCredentials && !getApps().length) {
  try {
    const formattedKey = parsePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY!);

    adminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey: formattedKey,
      }),
    });
    console.log("[Firebase Admin] Initialized successfully for project:", process.env.FIREBASE_ADMIN_PROJECT_ID);
  } catch (err) {
    console.error("[Firebase Admin] ❌ Failed to initialize Firebase Admin SDK:", err);
  }
} else if (hasCredentials) {
  adminApp = getApps()[0];
} else {
  console.warn(
    "[Firebase Admin] ⚠️ Missing credentials. Check FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY."
  );
}

export const adminDB = adminApp ? getFirestore(adminApp) : null;
export const adminMessaging = adminApp ? getMessaging(adminApp) : null;
export default adminApp;
