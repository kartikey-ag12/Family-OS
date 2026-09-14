// ============================================================
// app/(app)/settings/page.tsx — Settings & Family Info
// ============================================================
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { logOut } from "@/lib/auth";
import { initializeFCM } from "@/lib/fcm";

export default function SettingsPage() {
  const { user, profile, family } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logOut();
      router.replace("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  async function handleEnableNotifications() {
    if (!user?.uid) return;
    setNotifStatus("🔄 Enable ho raha hai...");
    const token = await initializeFCM(user.uid);
    if (token) {
      setNotifStatus("✅ Notifications enable ho gayi!");
    } else {
      setNotifStatus("❌ Permission nahi mili. Browser settings check karein.");
    }
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-3xl font-extrabold text-[#1c1917] mb-6">⚙️ Settings</h1>

      {/* Profile card */}
      <div className="card mb-4">
        <h2 className="text-xl font-bold text-[#1c1917] mb-3">👤 Aapki Profile</h2>
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
            style={{ background: "#f97316" }}
          >
            {profile?.displayName?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#1c1917]">
              {profile?.displayName ?? "Loading..."}
            </p>
            <p className="text-[#78716c] text-base">{user?.email}</p>
            <p className="text-[#f97316] text-sm font-semibold mt-0.5 capitalize">
              {profile?.role === "admin" ? "👑 Admin" : "👤 Member"}
            </p>
          </div>
        </div>
      </div>

      {/* Family card */}
      {family && (
        <div className="card mb-4">
          <h2 className="text-xl font-bold text-[#1c1917] mb-3">👨‍👩‍👧‍👦 Family Group</h2>
          <p className="text-2xl font-bold text-[#f97316] mb-2">{family.name}</p>
          <div className="bg-[#fff7ed] rounded-xl p-4">
            <p className="text-[#78716c] text-sm font-semibold mb-1">
              Invite Code (dusron ko share karein):
            </p>
            <p className="text-3xl font-extrabold tracking-widest text-[#1c1917] text-center py-2">
              {family.inviteCode}
            </p>
            <p className="text-[#78716c] text-xs text-center mt-1">
              Family join karne ke liye yeh code share karein
            </p>
          </div>
          <p className="text-[#78716c] text-sm mt-2">
            {family.memberUids.length} member(s) is family mein
          </p>
        </div>
      )}

      {/* Notifications */}
      <div className="card mb-4">
        <h2 className="text-xl font-bold text-[#1c1917] mb-3">🔔 Notifications</h2>
        <button
          id="enable-notifications"
          onClick={handleEnableNotifications}
          className="btn-primary"
          style={{ background: "#3b82f6", color: "white" }}
        >
          🔔 Notifications Enable Karein
        </button>
        {notifStatus && (
          <p className="text-base font-medium text-[#78716c] mt-3 text-center">
            {notifStatus}
          </p>
        )}
        <p className="text-[#78716c] text-sm mt-3">
          Push notifications ke liye permission dein taaki dawai ki yaad aayen.
        </p>
      </div>

      {/* Logout */}
      <div className="card">
        <button
          id="logout-btn"
          onClick={handleLogout}
          disabled={loggingOut}
          className="btn-primary"
          style={{
            background: loggingOut ? "#e7e5e4" : "#dc2626",
            color: loggingOut ? "#78716c" : "white",
          }}
        >
          {loggingOut ? "⏳ Logout ho raha hai..." : "🚪 Logout Karein"}
        </button>
      </div>

      <p className="text-center text-[#78716c] text-sm mt-6">
        Family OS — Free for your family 💙
      </p>
    </div>
  );
}
