"use client";
// ==================== セッションContext ====================
// Supabase Auth セッション優先、なければ localStorage の gg_session を使用

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { UserSession } from "@/types";

type SessionCtx = {
  session: UserSession | null;
  loading: boolean;
  setSelectedFacility: (id: string) => void;
};

const SessionContext = createContext<SessionCtx>({
  session: null,
  loading: true,
  setSelectedFacility: () => {},
});

function readLocalSession(): UserSession | null {
  try {
    const raw = localStorage.getItem("gg_session");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserSession & { expires_at?: number };
    if (parsed.expires_at && Date.now() > parsed.expires_at) {
      localStorage.removeItem("gg_session");
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      let authSession = null;
      if (isSupabaseReady) {
        try {
          const { data } = await supabase.auth.getSession();
          authSession = data.session;
        } catch {
          // ネットワークエラー → localStorage にフォールバック
        }
      }

      if (!authSession) {
        // Supabase Auth セッションなし → localStorage の gg_session を確認
        const local = readLocalSession();
        setSession(local);
        setLoading(false);
        return;
      }

      // ng_staffからスタッフ情報を取得（email列で検索）
      const email = authSession.user.email ?? "";
      const username = email.split("@")[0];
      const { data: rows } = await supabase
        .from("ng_staff")
        .select("*")
        .eq("email", email)
        .limit(1);

      const staff = rows?.[0] ?? null;
      const savedFacility = (() => { try { return localStorage.getItem("gg_facility_id"); } catch { return null; } })();

      const userSession: UserSession = {
        id: authSession.user.id,
        org_id: staff?.org_id ?? "org_1",
        facility_id: staff?.facility_id ?? "f1",
        staff_id: staff?.id ?? authSession.user.id,
        name: staff?.name ?? username,
        role: (staff?.role ?? "staff") as "admin" | "manager" | "staff",
        selected_facility_id: savedFacility ?? staff?.facility_id ?? "f1",
      };

      // 旧 hooks/useSession（localStorage）を使うページのために書き込む
      try { localStorage.setItem("gg_session", JSON.stringify(userSession)); } catch {}

      setSession(userSession);
      setLoading(false);
    } catch (err) {
      console.error("[SessionProvider] error:", err);
      // エラー時も localStorage を確認
      const local = readLocalSession();
      setSession(local);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();

    if (!isSupabaseReady) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        localStorage.removeItem("gg_session");
        setSession(null);
        setLoading(false);
      } else if (event === "SIGNED_IN") {
        loadSession();
      }
    });

    return () => subscription.unsubscribe();
  }, [loadSession]);

  const setSelectedFacility = useCallback((facilityId: string) => {
    try { localStorage.setItem("gg_facility_id", facilityId); } catch {}
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, selected_facility_id: facilityId };
      try { localStorage.setItem("gg_session", JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  return (
    <SessionContext.Provider value={{ session, loading, setSelectedFacility }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): UserSession | null {
  return useContext(SessionContext).session;
}

export function useSessionLoading(): boolean {
  return useContext(SessionContext).loading;
}

export function useSessionError(): string | null {
  return null;
}

export function useSetSelectedFacility(): (id: string) => void {
  return useContext(SessionContext).setSelectedFacility;
}
