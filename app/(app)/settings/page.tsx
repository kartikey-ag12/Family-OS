// ============================================================
// app/(app)/settings/page.tsx — Settings & Nickname Editor
// ============================================================
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { logOut } from "@/lib/auth";
import { initializeFCM } from "@/lib/fcm";
import { updateUserNickname } from "@/lib/firestore";

export default function SettingsPage() {
  const { user, profile, family, refreshProfile } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  // Nickname editor state
  const [nicknameInput, setNicknameInput] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameFeedback, setNicknameFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setNicknameInput(profile.nickname || profile.displayName || "");
    }
  }, [profile]);

  async function handleSaveNickname(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.uid || !nicknameInput.trim() || savingNickname) return;

    setSavingNickname(true);
    setNicknameFeedback(null);
    try {
      await updateUserNickname(user.uid, nicknameInput.trim());
      await refreshProfile();
      setNicknameFeedback("✅ Nickname update ho gaya!");
      setTimeout(() => setNicknameFeedback(null), 3000);
    } catch (err) {
      console.error("Error updating nickname:", err);
      setNicknameFeedback("❌ Update karne me error aaya.");
    } finally {
      setSavingNickname(false);
    }
  }

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

  const currentNickname = profile?.nickname || profile?.displayName || "Family Member";

  return (
    <div className="px-4 pt-5 max-w-lg mx-auto pb-24">
      {/* ─── Header ─── */}
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F4B4C] flex items-center gap-2">
          <span>⚙️</span>
          <span>Settings</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#6E675F] font-semibold mt-0.5">
          Profile aur family preferences manage karein
        </p>
      </div>

      {/* ─── 1. Profile & Nickname Card ─── */}
      <div className="card mb-4 bg-white border border-[#E5DFD5] p-5 rounded-2xl shadow-xs">
        <h2 className="text-base sm:text-lg font-bold text-[#2A2622] mb-3.5 flex items-center gap-2">
          <span>👤</span>
          <span>Aapki Profile</span>
        </h2>

        <div className="flex items-center gap-3.5 pb-4 border-b border-[#E5DFD5]">
          <div className="w-14 h-14 rounded-2xl bg-[#1F4B4C] text-white flex items-center justify-center text-xl font-black shrink-0 shadow-xs">
            {currentNickname[0]?.toUpperCase() ?? "👤"}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-extrabold text-[#2A2622] truncate">
              {currentNickname}
            </h3>
            <p className="text-xs text-[#6E675F] truncate">{user?.email}</p>
            <span className="inline-block bg-[#EBF3F3] text-[#1F4B4C] border border-[#CFE0E0] text-[11px] font-bold px-2 py-0.5 rounded-md mt-1">
              {profile?.role === "admin" ? "👑 Admin" : "👤 Parivaar Member"}
            </span>
          </div>
        </div>

        {/* Edit Nickname Form */}
        <form onSubmit={handleSaveNickname} className="mt-4 space-y-2.5">
          <label htmlFor="settings-nickname" className="block text-xs font-bold text-[#6E675F]">
            Ghar ka Naam / Nickname badlein (jaise: Papa, Mummy, Anuj):
          </label>
          <div className="flex gap-2">
            <input
              id="settings-nickname"
              type="text"
              required
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="Aapka nickname"
              className="input-field text-sm font-semibold flex-1"
              style={{ minHeight: "44px" }}
            />
            <button
              type="submit"
              disabled={savingNickname || !nicknameInput.trim() || nicknameInput.trim() === profile?.nickname}
              className="btn-primary px-4 text-xs sm:text-sm font-bold bg-[#1F4B4C] hover:bg-[#163738] text-white shrink-0 rounded-xl disabled:opacity-40"
              style={{ minHeight: "44px", width: "auto" }}
            >
              {savingNickname ? "⏳..." : "Save"}
            </button>
          </div>
          {nicknameFeedback && (
            <p className="text-xs font-bold text-[#346141] mt-1">{nicknameFeedback}</p>
          )}
        </form>
      </div>

      {/* ─── 2. Family Group Card ─── */}
      {family && (
        <div className="card mb-4 bg-white border border-[#E5DFD5] p-5 rounded-2xl shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-[#2A2622] mb-3 flex items-center gap-2">
            <span>👨‍👩‍👧‍👦</span>
            <span>Family Group</span>
          </h2>
          <p className="text-lg font-extrabold text-[#1F4B4C] mb-2">{family.name}</p>
          
          <div className="bg-[#FAF7F2] border border-[#E5DFD5] rounded-xl p-3.5 text-center">
            <p className="text-[#6E675F] text-xs font-bold mb-1">
              Invite Code (parivaar ke dusre logo ko share karein):
            </p>
            <p className="text-2xl font-black tracking-widest text-[#1F4B4C] py-1 font-mono">
              {family.inviteCode}
            </p>
            <p className="text-[#9E978E] text-[11px]">
              Naye members sign up karte samay yeh code dalenge.
            </p>
          </div>

          <p className="text-[#6E675F] text-xs mt-2.5 font-semibold">
            👥 {family.memberUids.length} member(s) jude huye hain
          </p>
        </div>
      )}

      {/* ─── 3. Notifications Card ─── */}
      <div className="card mb-4 bg-white border border-[#E5DFD5] p-5 rounded-2xl shadow-xs">
        <h2 className="text-base sm:text-lg font-bold text-[#2A2622] mb-2 flex items-center gap-2">
          <span>🔔</span>
          <span>Notifications</span>
        </h2>
        <p className="text-xs text-[#6E675F] mb-3">
          Dawai lene ka sahi samay par reminder aane ke liye notification enable karein.
        </p>
        <button
          id="enable-notifications"
          onClick={handleEnableNotifications}
          className="btn-secondary w-full py-2.5 text-sm font-bold bg-[#FAF7F2] hover:bg-[#F3EFEA] text-[#1F4B4C] border border-[#E5DFD5] rounded-xl"
        >
          🔔 Notification Permission Dein
        </button>
        {notifStatus && (
          <p className="text-xs font-bold text-[#6E675F] mt-2.5 text-center">
            {notifStatus}
          </p>
        )}
      </div>

      {/* ─── 4. Logout Card ─── */}
      <div className="card mb-4 bg-white border border-[#E5DFD5] p-4 rounded-2xl shadow-xs">
        <button
          id="logout-btn"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full py-3 rounded-xl border border-[#F3D3CB] bg-[#FBECE9] hover:bg-[#F6DDD8] text-[#8F3324] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition"
        >
          <span>🚪</span>
          <span>{loggingOut ? "Logout ho raha hai..." : "Logout Karein"}</span>
        </button>
      </div>

      <p className="text-center text-[#9E978E] text-xs mt-6 font-semibold">
        Family OS — Parivaar ki dekhbhal ke liye ❤️
      </p>
    </div>
  );
}
