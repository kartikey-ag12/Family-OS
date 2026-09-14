// ============================================================
// app/signup/page.tsx — Sign-up screen with family create/join
// ============================================================
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth";

type FamilyTab = "create" | "join";

export default function SignupPage() {
  const router = useRouter();
  const [tab, setTab] = useState<FamilyTab>("create");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password kam se kam 6 characters ka hona chahiye.");
      return;
    }
    setLoading(true);
    try {
      const familyOption =
        tab === "create"
          ? { type: "create" as const, familyName }
          : { type: "join" as const, inviteCode: inviteCode.trim().toUpperCase() };

      await signUp(email, password, displayName, familyOption);
      router.replace("/home");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("email-already-in-use")) {
        setError("Yeh email pehle se registered hai. Login karein.");
      } else if (msg.includes("Invalid family")) {
        setError("Invite code galat hai. Family code dobara check karein.");
      } else {
        setError("Kuch problem hui: " + msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#fff7ed] px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🏠</div>
          <h1 className="text-3xl font-extrabold text-[#1c1917]">Family OS</h1>
          <p className="text-[#78716c] mt-1">Naya account banayein</p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg p-7">
          <h2 className="text-2xl font-bold text-[#1c1917] mb-5">Sign Up Karein</h2>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-[#1c1917] font-semibold mb-2 text-lg">
                Aapka Naam
              </label>
              <input
                id="signup-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="jaise: Papa, Mummy, Rahul"
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-[#1c1917] font-semibold mb-2 text-lg">
                Email
              </label>
              <input
                id="signup-email"
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
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kam se kam 6 characters"
                required
                minLength={6}
                autoComplete="new-password"
                className="input-field"
              />
            </div>

            {/* Family tab */}
            <div>
              <p className="text-[#1c1917] font-semibold mb-2 text-lg">
                Family Group
              </p>
              <div className="flex rounded-xl overflow-hidden border-2 border-[#e7e5e4]">
                <button
                  id="tab-create"
                  type="button"
                  onClick={() => setTab("create")}
                  className="flex-1 py-3 text-base font-semibold transition-colors"
                  style={{
                    background: tab === "create" ? "#f97316" : "white",
                    color: tab === "create" ? "white" : "#78716c",
                  }}
                >
                  Naya Banayein
                </button>
                <button
                  id="tab-join"
                  type="button"
                  onClick={() => setTab("join")}
                  className="flex-1 py-3 text-base font-semibold transition-colors"
                  style={{
                    background: tab === "join" ? "#f97316" : "white",
                    color: tab === "join" ? "white" : "#78716c",
                  }}
                >
                  Join Karein
                </button>
              </div>

              <div className="mt-3">
                {tab === "create" ? (
                  <input
                    id="family-name"
                    type="text"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="jaise: Sharma Family"
                    required={tab === "create"}
                    className="input-field"
                  />
                ) : (
                  <input
                    id="invite-code"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="6-letter code (jaise: AB12CD)"
                    required={tab === "join"}
                    maxLength={6}
                    className="input-field uppercase tracking-widest text-center text-xl font-bold"
                  />
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-base font-medium">
                ⚠️ {error}
              </div>
            )}

            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className="btn-primary mt-2"
              style={{
                background: loading ? "#e7e5e4" : "#f97316",
                color: loading ? "#78716c" : "white",
              }}
            >
              {loading ? "⏳ Account ban raha hai..." : "Account Banayein →"}
            </button>
          </form>
        </div>

        <p className="text-center text-[#78716c] text-lg mt-6">
          Pehle se account hai?{" "}
          <Link
            href="/login"
            className="text-[#f97316] font-bold underline underline-offset-2"
          >
            Login Karein
          </Link>
        </p>
      </div>
    </div>
  );
}
