// ============================================================
// lib/AuthContext.tsx — React context for Firebase Auth state
// ============================================================
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./firebase";
import { getUserProfile } from "./firestore";
import { getFamily } from "./firestore";
import type { FamilyMember, Family } from "./types";

interface AuthContextType {
  user: User | null;
  profile: FamilyMember | null;
  family: Family | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  family: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FamilyMember | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (u: User) => {
    try {
      const p = await getUserProfile(u.uid);
      setProfile(p);
      if (p?.familyId) {
        const f = await getFamily(p.familyId);
        setFamily(f);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user);
  }, [user, loadProfile]);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const unsub = onAuthStateChanged(
      auth,
      async (u) => {
        if (!isMounted) return;
        setUser(u);
        if (u) {
          try {
            await loadProfile(u);
          } catch (err) {
            console.error("Auth profile load error:", err);
          }
        } else {
          setProfile(null);
          setFamily(null);
        }
        if (isMounted) {
          setLoading(false);
        }
      },
      (error) => {
        console.error("Auth state error:", error);
        if (isMounted) setLoading(false);
      }
    );

    // Fallback safety timeout (5 seconds for slower mobile networks)
    const timer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 5000);

    return () => {
      isMounted = false;
      unsub();
      clearTimeout(timer);
    };
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, family, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
