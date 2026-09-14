// ============================================================
// app/(app)/family/page.tsx — Family view (all members' status)
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { subscribeTodaysStatus } from "@/lib/firestore";
import type { MedicineStatusRecord } from "@/lib/types";

const DAY_NAMES = ["Ravi", "Som", "Mang", "Budh", "Guru", "Shukr", "Shan"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function StatusBadge({ status }: { status: string }) {
  if (status === "taken") return <span className="badge-taken text-xs">✓ Le li</span>;
  if (status === "skipped") return <span className="badge-skipped text-xs">⏭️ Chhod di</span>;
  return <span className="badge-pending text-xs">⏳ Baaki</span>;
}

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function formatMarkedAt(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("hi-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function FamilyViewPage() {
  const { profile, family } = useAuth();
  const [records, setRecords] = useState<MedicineStatusRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.familyId) return;
    const unsub = subscribeTodaysStatus(profile.familyId, (recs) => {
      setRecords(recs.sort((a, b) => a.medicineTime.localeCompare(b.medicineTime)));
      setLoading(false);
    });
    return unsub;
  }, [profile?.familyId]);

  // Group records by assigned person
  const grouped = records.reduce<Record<string, MedicineStatusRecord[]>>((acc, r) => {
    if (!acc[r.assignedTo]) acc[r.assignedTo] = [];
    acc[r.assignedTo].push(r);
    return acc;
  }, {});

  const totalMeds = records.length;
  const takenCount = records.filter((r) => r.status === "taken").length;
  const skippedCount = records.filter((r) => r.status === "skipped").length;
  const pendingCount = records.filter((r) => r.status === "pending").length;

  const today = new Date();
  const dateStr = `${DAY_NAMES[today.getDay()]}, ${today.getDate()} ${MONTHS[today.getMonth()]}`;

  return (
    <div className="px-4 pt-5 max-w-lg mx-auto pb-24">
      {/* ─── Header ─── */}
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F4B4C] flex items-center gap-2">
          <span>👨‍👩‍👧‍👦</span>
          <span>Parivaar ka Haal</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#6E675F] font-semibold mt-0.5">
          {dateStr} {family ? `• ${family.name}` : ""}
        </p>
      </div>

      {/* ─── Summary Strip ─── */}
      {!loading && totalMeds > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <div className="card bg-white border border-[#E5DFD5] text-center p-3 rounded-xl shadow-xs">
            <div className="text-2xl font-extrabold text-[#4A7C59]">{takenCount}</div>
            <div className="text-xs font-bold text-[#6E675F] mt-0.5">Le li ✓</div>
          </div>
          <div className="card bg-white border border-[#E5DFD5] text-center p-3 rounded-xl shadow-xs">
            <div className="text-2xl font-extrabold text-[#C27D26]">{skippedCount}</div>
            <div className="text-xs font-bold text-[#6E675F] mt-0.5">Chhod di ⏭️</div>
          </div>
          <div className="card bg-white border border-[#E5DFD5] text-center p-3 rounded-xl shadow-xs">
            <div className="text-2xl font-extrabold text-[#1F4B4C]">{pendingCount}</div>
            <div className="text-xs font-bold text-[#6E675F] mt-0.5">Baaki ⏳</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-3xl mb-2 animate-spin">⏳</div>
          <p className="text-[#6E675F] text-sm">Parivaar ka status load ho raha hai...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white border border-[#E5DFD5] rounded-2xl p-6 text-center">
          <div className="text-4xl mb-2">📋</div>
          <h2 className="text-base font-bold text-[#2A2622] mb-1">
            Aaj parivaar me koi dawai scheduled nahi hai
          </h2>
          <p className="text-xs text-[#6E675F]">
            Dawai jodne ke liye Dawai + tab chunein.
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([person, personRecords]) => {
          const personTaken = personRecords.filter((r) => r.status === "taken").length;
          const isComplete = personTaken === personRecords.length;

          return (
            <div key={person} className="mb-5 bg-white border border-[#E5DFD5] rounded-2xl p-4 shadow-xs">
              {/* Person header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E5DFD5]/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#EBF3F3] border border-[#CFE0E0] text-[#1F4B4C] flex items-center justify-center text-base font-extrabold shrink-0">
                    {person[0]?.toUpperCase() || "👤"}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#2A2622]">{person}</h2>
                    <p className="text-xs text-[#6E675F] font-semibold">
                      {personTaken}/{personRecords.length} dawaiyaan li
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    isComplete
                      ? "bg-[#E8F0EA] text-[#346141] border-[#C4DCCB]"
                      : "bg-[#FDF4E6] text-[#8A5415] border-[#F3DCC0]"
                  }`}
                >
                  {isComplete ? "✓ Done" : `${personRecords.length - personTaken} baaki`}
                </span>
              </div>

              {/* Medicine items */}
              <div className="space-y-2">
                {personRecords.map((record) => (
                  <div
                    key={record.id}
                    className="bg-[#FAF7F2] border border-[#E5DFD5] rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#2A2622] truncate">
                        {record.medicineName}
                      </p>
                      <p className="text-xs text-[#6E675F] mt-0.5">
                        🕐 {formatTime12(record.medicineTime)} • {record.takenAfterFood ? "Khane ke baad" : "Khane se pehle"}
                      </p>
                      {record.markedAt && (
                        <p className="text-[10px] text-[#4A7C59] font-semibold mt-0.5">
                          ✓ {record.markedByName} ne mark kiya ({formatMarkedAt(record.markedAt)})
                        </p>
                      )}
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
