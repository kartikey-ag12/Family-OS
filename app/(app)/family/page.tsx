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
  if (status === "taken") return <span className="badge-taken">✅ Le li</span>;
  if (status === "skipped") return <span className="badge-skipped">⏭️ Chhod di</span>;
  return <span className="badge-pending">⏳ Baaki</span>;
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
  const { profile } = useAuth();
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
    <div className="px-4 pt-6">
      <h1 className="text-3xl font-extrabold text-[#1c1917] mb-1">
        👨‍👩‍👧‍👦 Parivaar ka Haal
      </h1>
      <p className="text-[#78716c] text-base mb-5">{dateStr}</p>

      {/* Summary strip */}
      {!loading && totalMeds > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card text-center py-4">
            <div className="text-3xl font-extrabold text-[#16a34a]">{takenCount}</div>
            <div className="text-sm font-semibold text-[#78716c] mt-1">Le li ✅</div>
          </div>
          <div className="card text-center py-4">
            <div className="text-3xl font-extrabold text-[#d97706]">{skippedCount}</div>
            <div className="text-sm font-semibold text-[#78716c] mt-1">Chhod di ⏭️</div>
          </div>
          <div className="card text-center py-4">
            <div className="text-3xl font-extrabold text-[#f97316]">{pendingCount}</div>
            <div className="text-sm font-semibold text-[#78716c] mt-1">Baaki ⏳</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-5xl mb-4 animate-spin">⏳</div>
          <p className="text-[#78716c] text-lg">Load ho raha hai...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-2xl font-bold text-[#1c1917] mb-2">
            Aaj koi dawai nahi
          </h2>
          <p className="text-[#78716c] text-lg">
            Dawai add karne ke liye + dabayein
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([person, personRecords]) => {
          const personTaken = personRecords.filter((r) => r.status === "taken").length;
          return (
            <div key={person} className="mb-6">
              {/* Person header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold"
                    style={{ background: "#f97316" }}
                  >
                    {person[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#1c1917]">{person}</h2>
                    <p className="text-sm text-[#78716c]">
                      {personTaken}/{personRecords.length} li
                    </p>
                  </div>
                </div>
                <div
                  className="px-3 py-1 rounded-full text-sm font-bold"
                  style={{
                    background:
                      personTaken === personRecords.length
                        ? "#dcfce7"
                        : "#fef3c7",
                    color:
                      personTaken === personRecords.length
                        ? "#15803d"
                        : "#92400e",
                  }}
                >
                  {personTaken === personRecords.length ? "✓ Done!" : `${personRecords.length - personTaken} baaki`}
                </div>
              </div>

              {/* Medicine rows */}
              <div className="space-y-3">
                {personRecords.map((record) => (
                  <div key={record.id} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-lg font-bold text-[#1c1917]">
                          {record.medicineName}
                        </p>
                        <p className="text-[#78716c] text-base mt-0.5">
                          🕐 {formatTime12(record.medicineTime)}
                          {" · "}
                          {record.takenAfterFood ? "Khane ke baad" : "Khane se pehle"}
                        </p>
                        {record.markedAt && (
                          <p className="text-sm text-[#78716c] mt-1">
                            {record.markedByName} ne mark kiya — {formatMarkedAt(record.markedAt)}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={record.status} />
                    </div>
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
