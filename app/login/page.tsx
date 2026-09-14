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
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#fff7ed] px-5">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🏠</div>
          <h1 className="text-4xl font-extrabold text-[#1c1917]">Family OS</h1>
          <p className="text-[#78716c] text-lg mt-2">Apne ghar ka app</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-lg p-7">
          <h2 className="text-2xl font-bold text-[#1c1917] mb-6">Login Karein</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[#1c1917] font-semibold mb-2 text-lg">
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
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-[#1c1917] font-semibold mb-2 text-lg">
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
                className="input-field"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-base font-medium">
                ⚠️ {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary mt-2"
              style={{
                background: loading ? "#e7e5e4" : "#f97316",
                color: loading ? "#78716c" : "white",
              }}
            >
              {loading ? "⏳ Login ho raha hai..." : "Login Karein →"}
            </button>
          </form>
        </div>

        <p className="text-center text-[#78716c] text-lg mt-6">
          Naya account?{" "}
          <Link
            href="/signup"
            className="text-[#f97316] font-bold underline-offset-2 underline"
          >
            Sign Up Karein
          </Link>
        </p>
      </div>
    </div>
  );
}
