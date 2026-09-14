// ============================================================
// app/page.tsx — Root redirect (auth guard)
// ============================================================
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace("/home");
    } else {
      router.replace("/login");
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-dvh bg-[#FAF7F2]">
      <div className="text-center">
        <div className="text-5xl mb-3">🏠</div>
        <p className="text-[#6E675F] text-base font-semibold">Khul raha hai Family OS...</p>
      </div>
    </div>
  );
}
