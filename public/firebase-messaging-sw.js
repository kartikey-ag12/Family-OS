// ============================================================
// public/firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker
// MUST be at root /firebase-messaging-sw.js for FCM to work
// ============================================================

// Import the Firebase scripts
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Firebase config — hardcoded here because service workers cannot read process.env
// These values are safe to expose (they're already in your browser JS bundle)
firebase.initializeApp({
  apiKey: "AIzaSyDvbdgzDtLI5IqhQZykhoBgfIvAoa2nwAg",
  authDomain: "family-os-eeb88.firebaseapp.com",
  projectId: "family-os-eeb88",
  storageBucket: "family-os-eeb88.firebasestorage.app",
  messagingSenderId: "932543909208",
  appId: "1:932543909208:web:f15730d1ab52840253692d",
});

const messaging = firebase.messaging();

// ─── Background message handler ─────────────────────────────
messaging.onBackgroundMessage(async (payload) => {
  const title = payload.notification?.title ?? "Family OS";
  const body = payload.notification?.body ?? "Nayi reminder";

  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.data?.medicineName ?? "family-os",
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: "/home",
      ...payload.data,
    },
    actions: [
      { action: "taken", title: "✅ Le li" },
      { action: "dismiss", title: "Baad mein" },
    ],
  };

  await self.registration.showNotification(title, options);

  // ─── Schedule 30-min follow-up check ────────────────────────
  // If medicine is not marked within 30 min, we'll send a follow-up
  // via the API route (called from the notification click handler)
  if (payload.data?.medicineTime) {
    const time = payload.data.medicineTime; // "HH:MM"
    const [hours, minutes] = time.split(":").map(Number);
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);
    const followUpMs = scheduledTime.getTime() + 30 * 60 * 1000 - now.getTime();

    if (followUpMs > 0) {
      setTimeout(async () => {
        // Check if medicine was marked by posting to our API
        // (This is approximate — client-side SW can't reliably query Firestore)
        // The server-side cron on Vercel handles the authoritative follow-up
        const notifOptions = {
          body: `${payload.data.medicineName} abhi tak mark nahi hui! Kya ${payload.data.assignedTo} ne li?`,
          icon: "/icons/icon-192.png",
          requireInteraction: true,
          vibrate: [300, 100, 300, 100, 300],
          tag: `followup-${payload.data.medicineName}`,
          data: { url: "/home" },
        };
        await self.registration.showNotification(
          `⚠️ Dawai yaad dilaa rahe hain — ${payload.data.assignedTo}`,
          notifOptions
        );
      }, Math.max(followUpMs, 0));
    }
  }
});

// ─── Notification click handler ─────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? "/home";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
