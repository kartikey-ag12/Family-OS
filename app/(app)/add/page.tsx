// ============================================================
// app/(app)/add/page.tsx — Add Medicine form
// ============================================================
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { addMedicine, getFamilyMembers } from "@/lib/firestore";
import type { FamilyMember } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_HI = ["Ravi", "Som", "Mang", "Budh", "Guru", "Shukr", "Shan"];

export default function AddMedicinePage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [name, setName] = useState("");
  const [time, setTime] = useState("08:00");
  const [frequency, setFrequency] = useState<"daily" | "specific_days">("daily");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [takenAfterFood, setTakenAfterFood] = useState(true);
  const [assignedToUid, setAssignedToUid] = useState("");
  const [assignedToName, setAssignedToName] = useState("");
  const [durationDays, setDurationDays] = useState<string>("");
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!profile?.familyId) return;
    getFamilyMembers(profile.familyId).then((m) => {
      setMembers(m);
      if (m.length > 0) {
        setAssignedToUid(m[0].uid);
        setAssignedToName(m[0].nickname || m[0].displayName);
      }
    });
  }, [profile?.familyId]);

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Dawai ka naam daalna zaroori hai."); return; }
    if (!assignedToUid) { setError("Kisi ko assign karein."); return; }
    if (frequency === "specific_days" && selectedDays.length === 0) {
      setError("Kam se kam ek din select karein."); return;
    }

    setLoading(true);
    try {
      await addMedicine({
        familyId: profile!.familyId,
        name: name.trim(),
        time,
        frequency,
        days: frequency === "daily" ? [0, 1, 2, 3, 4, 5, 6] : selectedDays,
        takenAfterFood,
        assignedTo: assignedToName,
        assignedToUid,
        durationDays: durationDays ? parseInt(durationDays) : null,
        startDate: new Date(),
        createdBy: user!.uid,
        active: true,
      });
      setSuccess(true);
      setTimeout(() => router.push("/home"), 1500);
    } catch (err) {
      console.error(err);
      setError("Dawai save nahi hui. Dobara try karein.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
        <div className="text-5xl mb-3">✅</div>
        <h2 className="text-xl font-bold text-[#1F4B4C] mb-1">Dawai add ho gayi!</h2>
        <p className="text-[#6E675F] text-sm">Home screen par ja rahe hain...</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-5 max-w-lg mx-auto pb-24">
      {/* ─── Header ─── */}
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F4B4C] flex items-center gap-2">
          <span>➕</span>
          <span>Nayi Dawai Jodo</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#6E675F] font-semibold mt-0.5">
          Parivaar ke sadasya ke liye reminder schedule karein
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Medicine name */}
        <div className="card bg-white border border-[#E5DFD5] p-4 rounded-2xl shadow-xs">
          <label htmlFor="med-name" className="block text-xs font-bold text-[#6E675F] mb-1.5">
            💊 Dawai ka Naam *
          </label>
          <input
            id="med-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="jaise: Metformin, Amlodipine, BP Tablet..."
            required
            className="input-field text-base font-semibold"
          />
        </div>

        {/* Time */}
        <div className="card bg-white border border-[#E5DFD5] p-4 rounded-2xl shadow-xs">
          <label htmlFor="med-time" className="block text-xs font-bold text-[#6E675F] mb-1.5">
            🕐 Kab leni hai (Samay) *
          </label>
          <input
            id="med-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="input-field text-2xl font-bold text-center text-[#1F4B4C]"
          />
        </div>

        {/* Food timing */}
        <div className="card bg-white border border-[#E5DFD5] p-4 rounded-2xl shadow-xs">
          <label className="block text-xs font-bold text-[#6E675F] mb-2">
            🍽️ Khane ke sath niyam *
          </label>
          <div className="flex gap-2.5">
            <button
              id="food-after"
              type="button"
              onClick={() => setTakenAfterFood(true)}
              className={`flex-1 py-3 px-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                takenAfterFood
                  ? "bg-[#1F4B4C] text-white border-[#1F4B4C] shadow-xs"
                  : "bg-[#FAF7F2] text-[#423C36] border-[#E5DFD5] hover:bg-[#F3EFEA]"
              }`}
            >
              <span>🍽️</span>
              <span>Khane ke baad</span>
            </button>
            <button
              id="food-before"
              type="button"
              onClick={() => setTakenAfterFood(false)}
              className={`flex-1 py-3 px-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                !takenAfterFood
                  ? "bg-[#1F4B4C] text-white border-[#1F4B4C] shadow-xs"
                  : "bg-[#FAF7F2] text-[#423C36] border-[#E5DFD5] hover:bg-[#F3EFEA]"
              }`}
            >
              <span>🌅</span>
              <span>Khane se pehle</span>
            </button>
          </div>
        </div>

        {/* Frequency */}
        <div className="card bg-white border border-[#E5DFD5] p-4 rounded-2xl shadow-xs">
          <label className="block text-xs font-bold text-[#6E675F] mb-2">
            📅 Kitne din lena hai *
          </label>
          <div className="flex gap-2.5 mb-2.5">
            <button
              id="freq-daily"
              type="button"
              onClick={() => setFrequency("daily")}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl border transition-colors cursor-pointer ${
                frequency === "daily"
                  ? "bg-[#1F4B4C] text-white border-[#1F4B4C] shadow-xs"
                  : "bg-[#FAF7F2] text-[#423C36] border-[#E5DFD5] hover:bg-[#F3EFEA]"
              }`}
            >
              Roz (Daily)
            </button>
            <button
              id="freq-specific"
              type="button"
              onClick={() => setFrequency("specific_days")}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl border transition-colors cursor-pointer ${
                frequency === "specific_days"
                  ? "bg-[#1F4B4C] text-white border-[#1F4B4C] shadow-xs"
                  : "bg-[#FAF7F2] text-[#423C36] border-[#E5DFD5] hover:bg-[#F3EFEA]"
              }`}
            >
              Hafte ke kuch din
            </button>
          </div>

          {frequency === "specific_days" && (
            <div className="flex gap-1.5 justify-between mt-2 pt-2 border-t border-[#E5DFD5]">
              {DAYS.map((day, i) => {
                const isSelected = selectedDays.includes(i);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`w-10 h-10 rounded-xl text-xs font-bold transition-colors border cursor-pointer ${
                      isSelected
                        ? "bg-[#1F4B4C] text-white border-[#1F4B4C]"
                        : "bg-[#FAF7F2] text-[#6E675F] border-[#E5DFD5]"
                    }`}
                  >
                    {DAYS_HI[i]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Assign to */}
        <div className="card bg-white border border-[#E5DFD5] p-4 rounded-2xl shadow-xs">
          <label className="block text-xs font-bold text-[#6E675F] mb-2">
            👤 Kiski hai dawai (Assign to) *
          </label>
          {members.length === 0 ? (
            <p className="text-xs text-[#6E675F]">Members load ho rahe hain...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const isSelected = assignedToUid === m.uid;
                const memberNickname = m.nickname || m.displayName;
                return (
                  <button
                    key={m.uid}
                    type="button"
                    id={`member-${m.uid}`}
                    onClick={() => {
                      setAssignedToUid(m.uid);
                      setAssignedToName(memberNickname);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#1F4B4C] text-white border-[#1F4B4C] shadow-xs"
                        : "bg-[#FAF7F2] text-[#423C36] border-[#E5DFD5] hover:bg-[#F3EFEA]"
                    }`}
                  >
                    {memberNickname}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Duration (optional) */}
        <div className="card bg-white border border-[#E5DFD5] p-4 rounded-2xl shadow-xs">
          <label htmlFor="med-duration" className="block text-xs font-bold text-[#6E675F] mb-1">
            ⏳ Kitne din ka course hai? (Optional)
          </label>
          <input
            id="med-duration"
            type="number"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            placeholder="jaise: 7, 14 (khali = hamesha / ongoing)"
            min="1"
            max="365"
            className="input-field text-sm"
          />
          <p className="text-[#9E978E] text-[11px] mt-1.5">
            Khali chhorein agar regular dawai ho (BP, Diabetes, Thyroid, etc.)
          </p>
        </div>

        {error && (
          <div className="bg-[#FBECE9] border border-[#F3D3CB] rounded-xl p-3 text-[#8F3324] text-xs font-bold">
            ⚠️ {error}
          </div>
        )}

        <button
          id="add-medicine-submit"
          type="submit"
          disabled={loading}
          className="btn-primary min-h-[52px] bg-[#1F4B4C] hover:bg-[#163738] text-white font-bold text-base shadow-xs disabled:opacity-50"
        >
          {loading ? "⏳ Save ho raha hai..." : "💾 Dawai Save Karein →"}
        </button>
      </form>
    </div>
  );
}
