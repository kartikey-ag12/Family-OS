// ============================================================
// components/MedicineCard.tsx — Individual medicine card
// Large tap targets, Hinglish labels, status-aware display
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
      await markMedicineStatus(sid, action, user.uid, profile.displayName);
    } catch (err) {
      console.error("Error marking medicine:", err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className="card mb-4 border-l-4 transition-all"
      style={{
        borderLeftColor:
          status === "taken"
            ? "#16a34a"
            : status === "skipped"
            ? "#d97706"
            : "#f97316",
        opacity: isMarked ? 0.85 : 1,
      }}
    >
      {/* Header row: name + time */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <h3 className="text-2xl font-extrabold text-[#1c1917] leading-tight">
            {medicine.name}
          </h3>
          <p className="text-[#78716c] font-semibold text-lg mt-0.5">
            🕐 {formatTime(medicine.time)}
          </p>
        </div>

        {/* Status badge */}
        {isMarked && (
          <div>
            {status === "taken" ? (
              <span className="badge-taken text-base">✓ Le li</span>
            ) : (
              <span className="badge-skipped text-base">✗ Chhod di</span>
            )}
          </div>
        )}
      </div>

      {/* Tags row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span
          className="px-3 py-1 rounded-full text-sm font-semibold"
          style={{
            background: medicine.takenAfterFood ? "#fef3c7" : "#dbeafe",
            color: medicine.takenAfterFood ? "#92400e" : "#1e40af",
          }}
        >
          {medicine.takenAfterFood ? "🍽️ Khane ke baad" : "🌅 Khane se pehle"}
        </span>

        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#f3f4f6] text-[#374151]">
          👤 {medicine.assignedTo}
        </span>
      </div>

      {/* Action buttons — only show if pending */}
      {!isMarked && (
        <div className="flex gap-3">
          <button
            id={`take-${medicine.id}`}
            onClick={() => handleMark("taken")}
            disabled={!!loading}
            className="btn-primary flex-1"
            style={{
              background: loading === "taken" ? "#e7e5e4" : "#16a34a",
              color: loading === "taken" ? "#78716c" : "white",
              fontSize: "1.25rem",
            }}
          >
            {loading === "taken" ? "⏳..." : "✅ Le li"}
          </button>

          <button
            id={`skip-${medicine.id}`}
            onClick={() => handleMark("skipped")}
            disabled={!!loading}
            className="btn-primary flex-1"
            style={{
              background: loading === "skipped" ? "#e7e5e4" : "#d97706",
              color: loading === "skipped" ? "#78716c" : "white",
              fontSize: "1.1rem",
            }}
          >
            {loading === "skipped" ? "⏳..." : "⏭️ Chhod di"}
          </button>
        </div>
      )}

      {/* Show who marked it and when */}
      {isMarked && statusRecord?.markedAt && (
        <p className="text-[#78716c] text-base mt-2">
          {statusRecord.markedByName ?? "Kisi ne"} ne{" "}
          {status === "taken" ? "li" : "chhhodi"} —{" "}
          {formatTimestamp(statusRecord.markedAt)}
        </p>
      )}
    </div>
  );
}
