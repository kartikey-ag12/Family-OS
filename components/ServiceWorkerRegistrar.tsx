"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Register unified FCM + PWA Service Worker
    navigator.serviceWorker
      .register("/firebase-messaging-sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[ServiceWorker] Registered successfully:", reg.scope);
      })
      .catch((err) => {
        console.error("[ServiceWorker] Registration failed:", err);
      });
  }, []);

  return null;
}
