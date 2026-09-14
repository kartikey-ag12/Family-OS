# 🏠 Family OS

> Apne parivaar ke liye — medicine reminders, designed for elderly parents on Android

A Progressive Web App (PWA) built with **Next.js 14**, **Tailwind CSS**, and **Firebase** (free Spark plan).

---

## ✨ Features

- **💊 Medicine Reminders** — Daily/weekly medicine schedule per family member
- **✅ Le li / Chhod di** — Large, elderly-friendly "Taken/Skipped" buttons (56px+)
- **👨‍👩‍👧‍👦 Family View** — See who took what and when, in real-time
- **🔔 Push Notifications** — FCM reminders at scheduled time + 30-min follow-up
- **📱 PWA (Installable)** — Works like a native Android app, installs to home screen
- **🌐 Offline support** — App shell cached for use without internet
- **🔐 Family invite codes** — Each member has their own login, linked by a 6-char code

---

## 🚀 Setup Guide

### 1. Clone / Open the project

```bash
cd family-os
npm install
```

### 2. Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use an existing one)
3. Enable these services:
   - **Authentication** → Email/Password
   - **Firestore Database** → Start in **test mode** (then apply rules below)
   - **Cloud Messaging** → Already enabled by default

### 3. Configure environment variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in your Firebase config values from **Project Settings → General → Your apps**.

### 4. Configure the FCM Service Worker

Open `public/firebase-messaging-sw.js` and replace the placeholder values with your actual Firebase config:

```js
firebase.initializeApp({
  apiKey: "YOUR_ACTUAL_API_KEY",
  // ... etc
});
```

> **Why?** Service workers can't read `process.env` — the config must be hardcoded here. These values are safe to expose (they're already in your browser bundle).

### 5. Get FCM VAPID key

1. Firebase Console → Project Settings → **Cloud Messaging**
2. Under **Web Push certificates**, click **Generate key pair**
3. Copy the key pair to `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in `.env.local`

### 6. Get Firebase Admin SDK key (for server-side notifications)

1. Firebase Console → Project Settings → **Service accounts**
2. Click **Generate new private key** → download JSON
3. Copy `project_id`, `client_email`, and `private_key` to your `.env.local`

### 7. Deploy Firestore rules and indexes

Install Firebase CLI and deploy:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # Select your project
firebase deploy --only firestore:rules,firestore:indexes
```

Or manually copy `firestore.rules` content into the Firebase Console → Firestore → Rules tab.

### 8. Run locally

```bash
npm run dev
```

Open `http://localhost:3000` on your computer, or use your local network IP on Android.

---

## 📱 Install as Android PWA

1. Open Chrome on your Android phone
2. Navigate to your deployed URL (or local IP)
3. Chrome will show **"Add to Home Screen"** banner
4. Tap it → app installs like a native app

---

## 🌐 Deploy to Vercel (Recommended — Free)

```bash
npm install -g vercel
vercel
```

Add all your `.env.local` values as **Environment Variables** in the Vercel dashboard.

---

## 📁 Project Structure

```
family-os/
├── app/
│   ├── (app)/              ← Protected routes (require login)
│   │   ├── layout.tsx      ← App shell + bottom nav
│   │   ├── home/           ← Today's medicines
│   │   ├── add/            ← Add medicine form
│   │   ├── family/         ← Family status view
│   │   └── settings/       ← Profile, invite code, logout
│   ├── (auth)/
│   │   ├── login/          ← Login page
│   │   └── signup/         ← Sign up + family create/join
│   ├── api/
│   │   └── send-reminder/  ← FCM notification API
│   └── layout.tsx          ← Root layout
├── components/
│   ├── BottomNav.tsx
│   ├── MedicineCard.tsx
│   └── ServiceWorkerRegistrar.tsx
├── lib/
│   ├── firebase.ts         ← Firebase client init
│   ├── firebaseAdmin.ts    ← Firebase Admin (server-only)
│   ├── firestore.ts        ← All Firestore helpers
│   ├── auth.ts             ← Auth helpers
│   ├── fcm.ts              ← FCM helpers
│   ├── AuthContext.tsx     ← Auth React context
│   └── types.ts            ← TypeScript types
├── public/
│   ├── manifest.json       ← PWA manifest
│   ├── sw.js               ← App shell service worker
│   ├── firebase-messaging-sw.js ← FCM service worker
│   └── icons/              ← App icons
├── firestore.rules         ← Security rules
├── firestore.indexes.json  ← Index definitions
└── .env.local.example      ← Config template
```

---

## 🔔 Push Notifications — How It Works

| Trigger | Mechanism |
|---|---|
| Medicine reminder | Server sends FCM push via `/api/send-reminder` |
| 30-min follow-up | Service worker `setTimeout` (works when app is backgrounded on Android) |
| Foreground alerts | `onMessage` listener shows a browser notification |

> **Note**: The 30-min follow-up is client-side. For a 100% reliable server-driven follow-up (e.g., when phone is off), you'd need a paid cron service or Vercel Cron + a backend check.

---

## 📊 Firestore Free Tier Usage

| Operation | Per Day (Free) | Our Usage |
|---|---|---|
| Reads | 50,000 | ~50 (1 load/day/user) |
| Writes | 20,000 | ~10 (per medicine marked) |
| Real-time listeners | Counted as reads | 1 listener per active session |

Well within free limits for a typical family of 4-6 members.

---

## 🔮 Adding More Features

The codebase is modular. To add features like **Shopping List** or **Expenses**:

1. Add a new collection in `lib/types.ts`
2. Add Firestore helpers in `lib/firestore.ts`
3. Add a new route in `app/(app)/`
4. Add a tab in `components/BottomNav.tsx`
5. Update `firestore.rules` for the new collection

---

## 🛠️ Tech Stack

- **Next.js 14** (App Router)
- **Tailwind CSS** (v4)
- **Firebase**: Firestore, Auth, Cloud Messaging
- **TypeScript**
- **PWA**: Web App Manifest + Service Workers

---

Made with ❤️ for Indian families
