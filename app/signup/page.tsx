// ============================================================
// app/signup/page.tsx — Sign-up screen with nickname & family join
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
  const [nickname, setNickname] = useState("");
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
          ? { type: "create" as const, familyName: familyName.trim() }
          : { type: "join" as const, inviteCode: inviteCode.trim().toUpperCase() };

      const chosenNickname = nickname.trim() || displayName.trim();
      await signUp(email, password, displayName.trim(), familyOption, chosenNickname);
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
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#FAF7F2] px-5 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🏠</div>
          <h1 className="text-3xl font-extrabold text-[#1F4B4C]">Family OS</h1>
          <p className="text-[#6E675F] text-sm mt-1">Naya account banayein</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E5DFD5] rounded-2xl shadow-xs p-6">
          <h2 className="text-xl font-bold text-[#2A2622] mb-4">Sign Up Karein</h2>

          <form onSubmit={handleSignup} className="space-y-3.5">
            {/* Nickname / Ghar ka naam */}
            <div>
              <label htmlFor="signup-nickname" className="block text-xs font-bold text-[#6E675F] mb-1">
                Aapka Nickname (Ghar ka Naam) *
              </label>
              <input
                id="signup-nickname"
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (!displayName) setDisplayName(e.target.value);
                }}
                placeholder="jaise: Papa, Mummy, Anuj, Didi"
                required
                className="input-field text-sm font-semibold"
              />
              <p className="text-[11px] text-[#9E978E] mt-1">
                Yeh naam parivaar ke sabhi members ko dikhega.
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="signup-name" className="block text-xs font-bold text-[#6E675F] mb-1">
                Poora Naam (Full Name)
              </label>
              <input
                id="signup-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="jaise: Rajesh Sharma"
                required
                className="input-field text-sm"
              />
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-xs font-bold text-[#6E675F] mb-1">
                Email *
              </label>
              <input
                id="signup-email"
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
              <label htmlFor="signup-password" className="block text-xs font-bold text-[#6E675F] mb-1">
                Password (Kam se kam 6 characters) *
              </label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="new-password"
                className="input-field text-sm"
              />
            </div>

            {/* Family tab */}
            <div className="pt-1">
              <p className="text-xs font-bold text-[#6E675F] mb-1.5">
                Family Group *
              </p>
              <div className="flex rounded-xl overflow-hidden border border-[#E5DFD5] bg-[#FAF7F2] p-0.5">
                <button
                  id="tab-create"
                  type="button"
                  onClick={() => setTab("create")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    tab === "create"
                      ? "bg-[#1F4B4C] text-white shadow-xs"
                      : "text-[#6E675F] hover:text-[#2A2622]"
                  }`}
                >
                  Naya Banayein
                </button>
                <button
                  id="tab-join"
                  type="button"
                  onClick={() => setTab("join")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    tab === "join"
                      ? "bg-[#1F4B4C] text-white shadow-xs"
                      : "text-[#6E675F] hover:text-[#2A2622]"
                  }`}
                >
                  Join Karein
                </button>
              </div>

              <div className="mt-2.5">
                {tab === "create" ? (
                  <input
                    id="family-name"
                    type="text"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="jaise: Sharma Parivaar"
                    required={tab === "create"}
                    className="input-field text-sm"
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
                    className="input-field uppercase tracking-widest text-center text-lg font-bold font-mono"
                  />
                )}
              </div>
            </div>

            {error && (
              <div className="bg-[#FBECE9] border border-[#F3D3CB] rounded-xl p-3 text-[#8F3324] text-xs font-bold">
                ⚠️ {error}
              </div>
            )}

            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className="btn-primary min-h-[48px] bg-[#1F4B4C] hover:bg-[#163738] text-white font-bold text-base shadow-xs mt-2 disabled:opacity-50"
            >
              {loading ? "⏳ Account ban raha hai..." : "Account Banayein →"}
            </button>
          </form>
        </div>

        <p className="text-center text-[#6E675F] text-sm mt-5">
          Pehle se account hai?{" "}
          <Link
            href="/login"
            className="text-[#1F4B4C] font-bold underline-offset-2 underline hover:text-[#163738]"
          >
            Login Karein
          </Link>
        </p>
      </div>
    </div>
  );
}
