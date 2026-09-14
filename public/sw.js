// ============================================================
// public/sw.js — App Shell Service Worker (offline support)
// Caches the app shell for offline use on Android
// ============================================================

const CACHE_NAME = "family-os-v2";

// Files to cache for offline app shell
const SHELL_FILES = [
  "/",
  "/home",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ─── Install: cache the app shell ────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_FILES).catch((err) => {
        console.warn("SW cache addAll partial failure:", err);
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ──────────────────────────────
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

// ─── Fetch: network-first for API, cache-first for assets ────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, chrome-extension, fonts, and firebase/google requests
  if (
    event.request.method !== "GET" ||
    url.protocol === "chrome-extension:" ||
    url.hostname.includes("firestore") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("gstatic") ||
    url.hostname.includes("firebase")
  ) {
    return;
  }

  // API routes: network-only (no caching)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request).catch(() => new Response("Offline", { status: 503 })));
    return;
  }

  // Navigation requests: network-first, fallback to cache
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match("/offline.html") ?? caches.match("/"))
    );
    return;
  }

  // Static assets: cache-first with error catch fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch((err) => {
          console.warn("SW asset fetch skipped/failed:", err);
          return cached ?? new Response("", { status: 408 });
        });
    })
  );
});
