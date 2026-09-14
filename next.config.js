/** @type {import('next').NextConfig} */
const nextConfig = {
  // ─── Firebase Admin: server-only, not bundled on client ──
  serverExternalPackages: ["firebase-admin"],

  // ─── Turbopack ────────────────────────────────────────────
  // Enable empty turbopack config to silence the warning
  turbopack: {},

  // ─── PWA Headers ─────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/firebase-messaging-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          // Allow FCM messaging via CSP
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com https://*.gstatic.com https://fonts.googleapis.com https://*.googleapis.com https://*.firebaseio.com https://*.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com data:",
              "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.google.com https://fcm.googleapis.com https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com wss://*.firebaseio.com ws: wss:",
              "img-src 'self' data: blob: https:",
              "worker-src 'self' blob: https://www.gstatic.com",
              "frame-src 'self'",
            ].join("; "),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
