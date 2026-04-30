"use client";
// ==================== セッションContext（シンプル版）====================
// getSession()一回だけ呼び出し。複雑な処理を排除。

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      // Supabase Authセッション取得
      const { data: { session: authSession } } = await supabase.auth.getSession();

      if (!authSession) {
        setSession(null);
        setLoading(false);
        return;
      }

      // ng_staffからスタッフ情報を取得
      const username = authSession.user.email?.split("@")[0] ?? "";
      const { data: rows } = await supabase
        .from("ng_staff")
        .select("*")
        .eq("login_id", username)
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

      setSession(userSession);
      setLoading(false);
    } catch (err) {
      console.error("[SessionProvider] error:", err);
      setSession(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();

    // ログアウト時のみ対応（SIGNED_INはloadSessionが処理済みのため不要）
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadSession]);

  const setSelectedFacility = useCallback((facilityId: string) => {
    try { localStorage.setItem("gg_facility_id", facilityId); } catch {}
    setSession((prev) => (prev ? { ...prev, selected_facility_id: facilityId } : prev));
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

// 後方互換性のため維持
export function useSessionError(): string | null {
  return null;
}

export function useSetSelectedFacility(): (id: string) => void {
  return useContext(SessionContext).setSelectedFacility;
}
