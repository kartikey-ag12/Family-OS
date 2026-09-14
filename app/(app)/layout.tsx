// ============================================================
// app/(app)/layout.tsx — Protected app shell with bottom nav
// ============================================================
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import BottomNav from "@/components/BottomNav";
import VoiceInputModal from "@/components/VoiceInputModal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-[#fff7ed]">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">💊</div>
          <p className="text-[#78716c] text-lg">Khul raha hai...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-col min-h-dvh bg-[#fff7ed]">
      {/* Main content area — scrollable, above bottom nav */}
      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>
      <VoiceInputModal />
      <BottomNav />
    </div>
  );
}
