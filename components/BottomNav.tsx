// ============================================================
// components/BottomNav.tsx — Bottom navigation bar
// ============================================================
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/home", label: "Aaj", icon: "🏠", id: "nav-home" },
  { href: "/shopping", label: "Samaan", icon: "🛒", id: "nav-shopping" },
  { href: "/add", label: "Jodo", icon: "➕", id: "nav-add" },
  { href: "/family", label: "Parivaar", icon: "👨‍👩‍👧‍👦", id: "nav-family" },
  { href: "/settings", label: "Settings", icon: "⚙️", id: "nav-settings" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[#e7e5e4] safe-bottom z-50"
      style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              id={tab.id}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center py-3 min-h-[64px] transition-colors"
              style={{ color: isActive ? "#f97316" : "#78716c" }}
            >
              <span className="text-2xl leading-none">{tab.icon}</span>
              <span
                className="text-xs font-semibold mt-1"
                style={{
                  fontWeight: isActive ? "800" : "600",
                  fontSize: "13px",
                }}
              >
                {tab.label}
              </span>
              {isActive && (
                <div
                  className="absolute bottom-0 h-1 w-12 rounded-full"
                  style={{ background: "#f97316" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
