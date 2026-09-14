// ============================================================
// components/BottomNav.tsx — Bottom navigation bar
// ============================================================
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/home", label: "Aaj", icon: "🏠", id: "nav-home" },
  { href: "/shopping", label: "Samaan", icon: "🛒", id: "nav-shopping" },
  { href: "/expenses", label: "Hisab", icon: "💰", id: "nav-expenses" },
  { href: "/add", label: "Dawai +", icon: "💊", id: "nav-add" },
  { href: "/family", label: "Parivaar", icon: "👨‍👩‍👧‍👦", id: "nav-family" },
  { href: "/settings", label: "Settings", icon: "⚙️", id: "nav-settings" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#FAF7F2]/95 backdrop-blur-md border-t border-[#E5DFD5] safe-bottom z-40"
      style={{ boxShadow: "0 -2px 12px rgba(42, 38, 34, 0.04)" }}
    >
      <div className="flex items-stretch max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              id={tab.id}
              href={tab.href}
              className={`flex-1 relative flex flex-col items-center justify-center py-2.5 min-h-[60px] transition-colors ${
                isActive
                  ? "text-[#1F4B4C] font-bold"
                  : "text-[#6E675F] hover:text-[#2A2622]"
              }`}
            >
              <span className="text-xl leading-none mb-0.5">{tab.icon}</span>
              <span
                className="text-[12px] tracking-tight"
                style={{
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute top-0 h-0.5 w-8 rounded-full bg-[#1F4B4C]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
