// ============================================================
// app/(app)/home/page.tsx — Today's medicines home screen
// ============================================================
"use client";

import { useEffect, useState, useCallback } from "react";
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
    if (!profile?.familyId) {
      if (!authLoading) setLoading(false);
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
    if (!profile?.familyId) return;
    const unsubscribe = subscribeTodaysStatus(profile.familyId, (records) => {
      const map = new Map<string, MedicineStatusRecord>();
      records.forEach((r) => map.set(r.medicineId, r));
      setStatusMap(map);
    });
    return unsubscribe;
  }, [profile?.familyId]);

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

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-3xl font-extrabold text-[#1c1917]">
          🏠 Aaj ki Dawaiyaan
        </h1>
        <p className="text-[#78716c] text-base mt-1">{getTodayHeader()}</p>
        {family && (
          <p className="text-[#f97316] font-semibold text-base mt-1">
            👨‍👩‍👧‍👦 {family.name}
          </p>
        )}
      </div>

      {/* Foreground notification banner */}
      {notifBanner && (
        <div className="mb-4 bg-[#f97316] text-white rounded-2xl p-4 text-base font-semibold shadow-lg animate-pulse">
          🔔 {notifBanner}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-5xl mb-4 animate-spin">⏳</div>
          <p className="text-[#78716c] text-lg">Dawaiyaan load ho rahi hain...</p>
        </div>
      ) : medicines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-6xl mb-4">✨</div>
          <h2 className="text-2xl font-bold text-[#1c1917] mb-2">
            Aaj koi dawai nahi!
          </h2>
          <p className="text-[#78716c] text-lg">
            Dawai add karne ke liye neeche + button dabayein
          </p>
        </div>
      ) : (
        <>
          {/* Pending medicines */}
          {pending.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-[#f97316]" />
                <h2 className="text-xl font-bold text-[#1c1917]">
                  Baaki hai ({pending.length})
                </h2>
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

          {/* Done medicines */}
          {done.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-[#16a34a]" />
                <h2 className="text-xl font-bold text-[#1c1917]">
                  Ho gayi ({done.length})
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

          {/* Summary banner */}
          {pending.length === 0 && done.length > 0 && (
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 text-center mb-6">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-xl font-bold text-green-700">
                Aaj ki saari dawaiyaan ho gayi!
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
