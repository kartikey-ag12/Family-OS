// ============================================================
// lib/fcm.ts — Firebase Cloud Messaging helpers (client-side)
// ============================================================
"use client";

import { getToken, onMessage, type Messaging } from "firebase/messaging";
import { getMessagingInstance } from "./firebase";
import { saveFcmToken } from "./firestore";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!;

/**
 * Requests notification permission and retrieves the FCM token.
 * Saves the token to the user's Firestore doc.
 * Returns the token or null if permission denied.
 */
export async function initializeFCM(uid: string): Promise<string | null> {
  try {
    if (typeof window === "undefined") return null;
    if (!("Notification" in window)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission denied");
      return null;
    }

    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    // Ensure service worker is registered and active
    await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    const registration = await navigator.serviceWorker.ready;

    if (!VAPID_KEY) {
      console.warn("FCM: NEXT_PUBLIC_FIREBASE_VAPID_KEY is not defined");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await saveFcmToken(uid, token);
      return token;
    }
    return null;
  } catch (err) {
    console.warn("FCM token subscription error (will retry on next session):", err);
    return null;
  }
}

/**
 * Listen to foreground FCM messages and show a browser notification.
 */
export async function listenToForegroundMessages(
  onNotification: (payload: { title: string; body: string }) => void
): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};

  const unsubscribe = onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "Family OS";
    const body = payload.notification?.body ?? "New reminder";
    onNotification({ title, body });
    // Also show native notification for foreground
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icons/icon-192.png" });
    }
  });

  return unsubscribe;
}

/**
 * Schedule a client-side follow-up notification if medicine
 * is not marked as taken within 30 minutes of scheduled time.
 * Uses setTimeout — reliable when app is backgrounded on Android Chrome.
 */
export function scheduleFollowUpCheck(
  medicineName: string,
  scheduledTime: string, // "HH:MM"
  statusId: string,
  onTrigger: (statusId: string) => void
): NodeJS.Timeout | null {
  const [hours, minutes] = scheduledTime.split(":").map(Number);
  const now = new Date();
  const scheduleDate = new Date();
  scheduleDate.setHours(hours, minutes, 0, 0);

  // 30 minutes after scheduled time
  const followUpDate = new Date(scheduleDate.getTime() + 30 * 60 * 1000);
  const msUntilFollowUp = followUpDate.getTime() - now.getTime();

  if (msUntilFollowUp <= 0) return null; // Already past

  return setTimeout(() => {
    onTrigger(statusId);
  }, msUntilFollowUp);
}
