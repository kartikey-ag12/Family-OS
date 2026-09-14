// ============================================================
// app/(app)/add/page.tsx — Add Medicine form
// ============================================================
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { addMedicine, getFamilyMembers } from "@/lib/firestore";
import { useEffect } from "react";
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
        setAssignedToName(m[0].displayName);
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
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-[#1c1917] mb-2">Dawai add ho gayi!</h2>
        <p className="text-[#78716c] text-lg">Home screen par ja raha hai...</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-3xl font-extrabold text-[#1c1917] mb-6">
        ➕ Nayi Dawai Jodo
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Medicine name */}
        <div className="card">
          <label className="block text-[#1c1917] font-bold mb-2 text-xl">
            💊 Dawai ka Naam
          </label>
          <input
            id="med-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="jaise: Metformin, Amlodipine"
            required
            className="input-field"
          />
        </div>

        {/* Time */}
        <div className="card">
          <label className="block text-[#1c1917] font-bold mb-2 text-xl">
            🕐 Kab leni hai?
          </label>
          <input
            id="med-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="input-field text-2xl font-bold text-center"
          />
        </div>

        {/* Food timing */}
        <div className="card">
          <label className="block text-[#1c1917] font-bold mb-3 text-xl">
            🍽️ Khane ke saath
          </label>
          <div className="flex gap-3">
            <button
              id="food-after"
              type="button"
              onClick={() => setTakenAfterFood(true)}
              className="btn-primary flex-1 text-base"
              style={{
                background: takenAfterFood ? "#f97316" : "#f3f4f6",
                color: takenAfterFood ? "white" : "#374151",
              }}
            >
              🍽️ Khane ke BAAD
            </button>
            <button
              id="food-before"
              type="button"
              onClick={() => setTakenAfterFood(false)}
              className="btn-primary flex-1 text-base"
              style={{
                background: !takenAfterFood ? "#f97316" : "#f3f4f6",
                color: !takenAfterFood ? "white" : "#374151",
              }}
            >
              🌅 Khane se PEHLE
            </button>
          </div>
        </div>

        {/* Frequency */}
        <div className="card">
          <label className="block text-[#1c1917] font-bold mb-3 text-xl">
            📅 Kitne din?
          </label>
          <div className="flex gap-3 mb-3">
            <button
              id="freq-daily"
              type="button"
              onClick={() => setFrequency("daily")}
              className="btn-primary flex-1 text-base"
              style={{
                background: frequency === "daily" ? "#f97316" : "#f3f4f6",
                color: frequency === "daily" ? "white" : "#374151",
              }}
            >
              Roz
            </button>
            <button
              id="freq-specific"
              type="button"
              onClick={() => setFrequency("specific_days")}
              className="btn-primary flex-1 text-base"
              style={{
                background: frequency === "specific_days" ? "#f97316" : "#f3f4f6",
                color: frequency === "specific_days" ? "white" : "#374151",
              }}
            >
              Kuch Din
            </button>
          </div>

          {frequency === "specific_days" && (
            <div className="flex gap-2 flex-wrap mt-2">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className="w-12 h-12 rounded-full text-sm font-bold transition-colors"
                  style={{
                    background: selectedDays.includes(i) ? "#f97316" : "#f3f4f6",
                    color: selectedDays.includes(i) ? "white" : "#374151",
                  }}
                >
                  {DAYS_HI[i]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assign to */}
        <div className="card">
          <label className="block text-[#1c1917] font-bold mb-2 text-xl">
            👤 Kiski hai dawai?
          </label>
          {members.length === 0 ? (
            <p className="text-[#78716c] text-lg">Members load ho rahe hain...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.uid}
                  type="button"
                  id={`member-${m.uid}`}
                  onClick={() => {
                    setAssignedToUid(m.uid);
                    setAssignedToName(m.displayName);
                  }}
                  className="px-5 py-3 rounded-2xl text-lg font-bold transition-colors"
                  style={{
                    background: assignedToUid === m.uid ? "#f97316" : "#f3f4f6",
                    color: assignedToUid === m.uid ? "white" : "#374151",
                    minHeight: "52px",
                  }}
                >
                  {m.displayName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Duration (optional) */}
        <div className="card">
          <label className="block text-[#1c1917] font-bold mb-2 text-xl">
            ⏳ Kitne Din tak? (Optional)
          </label>
          <input
            id="med-duration"
            type="number"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            placeholder="jaise: 7 (blank = hamesha)"
            min="1"
            max="365"
            className="input-field"
          />
          <p className="text-[#78716c] text-sm mt-2">
            Khali chhorein agar dawai ongoing ho (blood pressure, diabetes, etc.)
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-base font-medium">
            ⚠️ {error}
          </div>
        )}

        <button
          id="add-medicine-submit"
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{
            background: loading ? "#e7e5e4" : "#f97316",
            color: loading ? "#78716c" : "white",
            fontSize: "1.3rem",
          }}
        >
          {loading ? "⏳ Save ho raha hai..." : "💾 Dawai Save Karein"}
        </button>
      </form>
    </div>
  );
}
