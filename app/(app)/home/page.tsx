// ============================================================
// app/(app)/home/page.tsx — Today's medicines hero screen
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  subscribeTodaysMedicines,
  ensureTodaysStatusRecords,
  subscribeTodaysStatus,
} from "@/lib/firestore";
import { initializeFCM, listenToForegroundMessages } from "@/lib/fcm";
import MedicineCard from "@/components/MedicineCard";
import type { Medicine, MedicineStatusRecord } from "@/lib/types";

const DAY_NAMES = ["Ravivaar", "Somvaar", "Mangalvaar", "Budhvaar", "Guruvaar", "Shukravaar", "Shanivaar"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getTodayHeader(): string {
  const now = new Date();
  return `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

export default function HomePage() {
  const { user, profile, family, loading: authLoading } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [statusMap, setStatusMap] = useState<Map<string, MedicineStatusRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [notifBanner, setNotifBanner] = useState<string | null>(null);

  // Subscribe to real-time medicines updates
  useEffect(() => {
    if (authLoading) return;
    if (!profile?.familyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribeMedicines = subscribeTodaysMedicines(
      profile.familyId,
      async (meds) => {
        setMedicines(meds);
        setLoading(false);
        try {
          await ensureTodaysStatusRecords(meds, profile.familyId);
        } catch (err) {
          console.error("Error creating today's status records:", err);
        }
      }
    );

    return unsubscribeMedicines;
  }, [profile?.familyId, authLoading]);

  // Subscribe to real-time status updates
  useEffect(() => {
    if (authLoading || !profile?.familyId) return;
    const unsubscribe = subscribeTodaysStatus(profile.familyId, (records) => {
      const map = new Map<string, MedicineStatusRecord>();
      records.forEach((r) => map.set(r.medicineId, r));
      setStatusMap(map);
    });
    return unsubscribe;
  }, [profile?.familyId, authLoading]);

  // Initialize FCM push notifications
  useEffect(() => {
    if (!user?.uid) return;
    let foregroundUnsub: (() => void) | null = null;

    initializeFCM(user.uid).catch(console.error);

    listenToForegroundMessages(({ title, body }) => {
      setNotifBanner(`${title}: ${body}`);
      setTimeout(() => setNotifBanner(null), 5000);
    }).then((unsub) => {
      foregroundUnsub = unsub;
    });

    return () => {
      if (foregroundUnsub) foregroundUnsub();
    };
  }, [user?.uid]);

  const pending = medicines.filter(
    (m) => (statusMap.get(m.id)?.status ?? "pending") === "pending"
  );
  const done = medicines.filter(
    (m) => (statusMap.get(m.id)?.status ?? "pending") !== "pending"
  );

  const nickname = profile?.nickname || profile?.displayName || "Family";

  return (
    <div className="px-4 pt-5 pb-24 max-w-lg mx-auto">
      {/* ─── Hero Header & Greeting ─── */}
      <div className="mb-5 bg-white border border-[#E5DFD5] rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#6E675F] tracking-wide uppercase">
              {getTodayHeader()}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F4B4C] mt-0.5 tracking-tight">
              Namaste, {nickname} 👋
            </h1>
          </div>
          {family && (
            <div className="bg-[#EBF3F3] text-[#1F4B4C] border border-[#CFE0E0] rounded-xl px-3 py-1.5 text-xs font-bold text-center">
              <span className="block text-sm">👨‍👩‍👧‍👦</span>
              <span className="truncate max-w-[80px] block">{family.name}</span>
            </div>
          )}
        </div>

        {/* Quick Progress Indicator */}
        {!loading && medicines.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-[#E5DFD5] flex items-center justify-between text-xs sm:text-sm font-semibold">
            <span className="text-[#6E675F]">
              Aaj ki dawai progress:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[#4A7C59] font-bold">
                {done.length} le li
              </span>
              <span className="text-[#E5DFD5]">•</span>
              <span className="text-[#C27D26] font-bold">
                {pending.length} baaki
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Foreground notification banner */}
      {notifBanner && (
        <div className="mb-4 bg-[#1F4B4C] text-white rounded-xl p-3.5 text-sm font-semibold shadow-md flex items-center gap-2 border border-[#163738]">
          <span>🔔</span>
          <span>{notifBanner}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-4xl mb-3 animate-spin">⏳</div>
          <p className="text-[#6E675F] text-base font-medium">Dawaiyaan load ho rahi hain...</p>
        </div>
      ) : medicines.length === 0 ? (
        <div className="bg-white border border-[#E5DFD5] rounded-2xl p-8 text-center my-4">
          <div className="text-5xl mb-3">✨</div>
          <h2 className="text-xl font-bold text-[#2A2622] mb-1.5">
            Aaj koi dawai nahi!
          </h2>
          <p className="text-[#6E675F] text-sm">
            Nayi dawai add karne ke liye neeche Dawai + tab chunein ya voice assistant use karein.
          </p>
        </div>
      ) : (
        <>
          {/* ─── 1. Pending Medicines (Hero Focus) ─── */}
          {pending.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#E8A33D]" />
                  <h2 className="text-lg sm:text-xl font-bold text-[#2A2622]">
                    Baaki Dawaiyaan ({pending.length})
                  </h2>
                </div>
                <span className="text-xs font-semibold text-[#6E675F]">
                  Samay par lena yaad rakhein
                </span>
              </div>
              {pending.map((med) => (
                <MedicineCard
                  key={med.id}
                  medicine={med}
                  statusRecord={statusMap.get(med.id) ?? null}
                />
              ))}
            </div>
          )}

          {/* ─── 2. Done Medicines ─── */}
          {done.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-2.5 h-2.5 rounded-full bg-[#4A7C59]" />
                <h2 className="text-lg sm:text-xl font-bold text-[#2A2622]">
                  Ho Gayi ({done.length})
                </h2>
              </div>
              {done.map((med) => (
                <MedicineCard
                  key={med.id}
                  medicine={med}
                  statusRecord={statusMap.get(med.id) ?? null}
                />
              ))}
            </div>
          )}

          {/* ─── 3. Celebration banner when all completed ─── */}
          {pending.length === 0 && done.length > 0 && (
            <div className="bg-[#E8F0EA] border border-[#C4DCCB] rounded-2xl p-5 text-center mb-6">
              <p className="text-3xl mb-1.5">🎉</p>
              <h3 className="text-lg font-bold text-[#346141]">
                Bahut badhiya! Aaj ki saari dawaiyaan poori ho gayi.
              </h3>
              <p className="text-xs font-medium text-[#4A7C59] mt-1">
                Aapne aur aapke parivaar ne aaj ka routine pura kiya.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
