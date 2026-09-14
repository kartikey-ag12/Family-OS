// ============================================================
// app/login/page.tsx — Login screen
// ============================================================
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/home");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      if (msg.includes("invalid-credential") || msg.includes("wrong-password")) {
        setError("Email ya password galat hai. Dobara try karein.");
      } else if (msg.includes("user-not-found")) {
        setError("Yeh email registered nahi hai.");
      } else {
        setError("Kuch problem hui. Dobara try karein.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#FAF7F2] px-5 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🏠</div>
          <h1 className="text-3xl font-extrabold text-[#1F4B4C]">Family OS</h1>
          <p className="text-[#6E675F] text-sm mt-1">Apne ghar aur parivaar ka app</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E5DFD5] rounded-2xl shadow-xs p-6">
          <h2 className="text-xl font-bold text-[#2A2622] mb-4">Login Karein</h2>

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label htmlFor="login-email" className="block text-xs font-bold text-[#6E675F] mb-1">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aapka@email.com"
                required
                autoComplete="email"
                className="input-field text-sm"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-bold text-[#6E675F] mb-1">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="input-field text-sm"
              />
            </div>

            {error && (
              <div className="bg-[#FBECE9] border border-[#F3D3CB] rounded-xl p-3 text-[#8F3324] text-xs font-bold">
                ⚠️ {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary min-h-[48px] bg-[#1F4B4C] hover:bg-[#163738] text-white font-bold text-base shadow-xs mt-2 disabled:opacity-50"
            >
              {loading ? "⏳ Login ho raha hai..." : "Login Karein →"}
            </button>
          </form>
        </div>

        <p className="text-center text-[#6E675F] text-sm mt-5">
          Naya account banana hai?{" "}
          <Link
            href="/signup"
            className="text-[#1F4B4C] font-bold underline-offset-2 underline hover:text-[#163738]"
          >
            Sign Up Karein
          </Link>
        </p>
      </div>
    </div>
  );
}
