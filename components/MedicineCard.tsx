// ============================================================
// components/MedicineCard.tsx — Individual medicine card
// Large tap targets, clean typography, status-aware display
// ============================================================
"use client";

import { useState } from "react";
import type { Medicine, MedicineStatusRecord } from "@/lib/types";
import { markMedicineStatus, statusDocId, todayDateString } from "@/lib/firestore";
import { useAuth } from "@/lib/AuthContext";

interface MedicineCardProps {
  medicine: Medicine;
  statusRecord: MedicineStatusRecord | null;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function formatTimestamp(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("hi-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function MedicineCard({ medicine, statusRecord }: MedicineCardProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState<"taken" | "skipped" | null>(null);

  const status = statusRecord?.status ?? "pending";
  const isMarked = status === "taken" || status === "skipped";

  async function handleMark(action: "taken" | "skipped") {
    if (!user || !profile || isMarked) return;
    setLoading(action);
    try {
      const today = todayDateString();
      const sid = statusDocId(today, medicine.id);
      const userNickname = profile.nickname || profile.displayName || "Family Member";
      await markMedicineStatus(sid, action, user.uid, userNickname);
    } catch (err) {
      console.error("Error marking medicine:", err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className={`card mb-3.5 border-l-4 transition-all duration-150 ${
        status === "taken"
          ? "bg-[#F4F9F5] border-l-[#4A7C59]"
          : status === "skipped"
          ? "bg-[#FCF9F3] border-l-[#C27D26]"
          : "bg-white border-l-[#1F4B4C]"
      }`}
    >
      {/* Header row: name + time */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex-1">
          <h3 className="text-xl sm:text-2xl font-bold text-[#2A2622] leading-snug">
            {medicine.name}
          </h3>
          <p className="text-[#6E675F] font-semibold text-base mt-0.5 flex items-center gap-1.5">
            <span>🕐</span>
            <span>{formatTime(medicine.time)}</span>
          </p>
        </div>

        {/* Status badge */}
        {isMarked && (
          <div className="shrink-0">
            {status === "taken" ? (
              <span className="badge-taken flex items-center gap-1 text-sm sm:text-base">
                <span>✓</span> Le li
              </span>
            ) : (
              <span className="badge-skipped flex items-center gap-1 text-sm sm:text-base">
                <span>✗</span> Chhod di
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tags row */}
      <div className="flex flex-wrap gap-2 mb-3.5">
        <span
          className="px-2.5 py-1 rounded-md text-xs sm:text-sm font-semibold border"
          style={{
            background: medicine.takenAfterFood ? "#FDF4E6" : "#EBF3F3",
            color: medicine.takenAfterFood ? "#8A5415" : "#1F4B4C",
            borderColor: medicine.takenAfterFood ? "#F3DCC0" : "#CFE0E0",
          }}
        >
          {medicine.takenAfterFood ? "🍽️ Khane ke baad" : "🌅 Khane se pehle"}
        </span>

        <span className="px-2.5 py-1 rounded-md text-xs sm:text-sm font-semibold bg-[#FAF7F2] text-[#423C36] border border-[#E5DFD5]">
          👤 {medicine.assignedTo}
        </span>
      </div>

      {/* Action buttons — only show if pending */}
      {!isMarked && (
        <div className="flex gap-2.5 pt-1">
          <button
            id={`take-${medicine.id}`}
            onClick={() => handleMark("taken")}
            disabled={!!loading}
            className="btn-primary flex-1 min-h-[48px] text-base sm:text-lg bg-[#4A7C59] hover:bg-[#3E6A4B] text-white font-bold"
          >
            {loading === "taken" ? "⏳..." : "✓ Le li"}
          </button>

          <button
            id={`skip-${medicine.id}`}
            onClick={() => handleMark("skipped")}
            disabled={!!loading}
            className="btn-secondary flex-1 min-h-[48px] text-sm sm:text-base font-semibold text-[#6E675F] bg-[#FAF7F2] hover:bg-[#F3EFEA]"
          >
            {loading === "skipped" ? "⏳..." : "Chhod di"}
          </button>
        </div>
      )}

      {/* Show who marked it and when */}
      {isMarked && statusRecord?.markedAt && (
        <p className="text-[#6E675F] text-xs sm:text-sm mt-2 border-t border-[#E5DFD5]/60 pt-2">
          {statusRecord.markedByName ?? "Kisi"} ne {status === "taken" ? "li" : "chhodi"} —{" "}
          {formatTimestamp(statusRecord.markedAt)}
        </p>
      )}
    </div>
  );
}
