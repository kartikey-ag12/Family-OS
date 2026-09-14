// ============================================================
// public/firebase-messaging-sw.js
// Unified Service Worker: Firebase Cloud Messaging + PWA Offline Support
// ============================================================

// 1. Load Firebase compat libraries
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// 2. Initialize Firebase in Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyDvbdgzDtLI5IqhQZykhoBgfIvAoa2nwAg",
  authDomain: "family-os-eeb88.firebaseapp.com",
  projectId: "family-os-eeb88",
  storageBucket: "family-os-eeb88.firebasestorage.app",
  messagingSenderId: "932543909208",
  appId: "1:932543909208:web:f15730d1ab52840253692d",
});

const messaging = firebase.messaging();

// ─── PWA Offline Caching Configuration ───────────────────────
const CACHE_NAME = "family-os-v3";
const SHELL_FILES = [
  "/",
  "/home",
  "/shopping",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Install: cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_FILES).catch((err) => {
        console.warn("[SW] Cache addAll partial failure:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches & claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, chrome-extension, and Firebase / Google network calls
  if (
    event.request.method !== "GET" ||
    url.protocol === "chrome-extension:" ||
    url.hostname.includes("firestore") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("gstatic") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("fcm")
  ) {
    return;
  }

  // API & cron routes: network-only
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => new Response("Offline", { status: 503 }))
    );
    return;
  }

  // Navigation requests: network-first, fallback to offline shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match("/offline.html") ?? caches.match("/home") ?? caches.match("/"))
    );
    return;
  }

  // Static assets: cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch((err) => {
          return cached ?? new Response("", { status: 408 });
        });
    })
  );
});

// ─── Helper function to display custom notification ──────────
function displayCustomNotification(payload) {
  const title =
    payload.notification?.title ||
    payload.data?.title ||
    `💊 Dawai yaad hai! — ${payload.data?.assignedTo || "Family Member"}`;

  const body =
    payload.notification?.body ||
    payload.data?.body ||
    (payload.data?.medicineName
      ? `${payload.data.medicineName} leni hai — ${payload.data.time || "Abhi"}`
      : "Dawai lene ka samay ho gaya hai!");

  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.data?.medicineName ? `med-${payload.data.medicineName}` : `family-os-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    data: {
      url: payload.data?.url || "/home",
      medicineName: payload.data?.medicineName,
      time: payload.data?.time,
      assignedTo: payload.data?.assignedTo,
    },
    actions: [
      { action: "taken", title: "✅ Le li" },
      { action: "dismiss", title: "Baad mein" },
    ],
  };

  return self.registration.showNotification(title, options);
}

// ─── Firebase Messaging Background Handler ────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log("[FCM SW] Received background message:", payload);
  return displayCustomNotification(payload);
});

// ─── Native Push Event Fallback Handler ───────────────────────
// Guarantees showNotification is ALWAYS called even for raw/data push
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const rawData = event.data.json();
    console.log("[FCM SW] Raw push event data:", rawData);

    // If Firebase Messaging SDK already handles it, avoid double display
    // Check if notification payload is present
    if (rawData.notification || rawData.data) {
      event.waitUntil(displayCustomNotification(rawData));
    }
  } catch (err) {
    console.warn("[FCM SW] Could not parse push payload as JSON:", err);
    event.waitUntil(
      self.registration.showNotification("💊 Family OS Reminder", {
        body: event.data.text() || "Dawai lene ka samay ho gaya!",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: "/home" },
      })
    );
  }
});

// ─── Notification Click Handler ───────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/home";
  const action = event.action;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus and navigate it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
