// ==================== セッションフック（Supabase Auth版） ====================
// localStorageの偽造セッションではなく、Supabase Authの正規トークンで認証する。
// ng_staffに登録されていないユーザーは自動サインアウト。

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { UserSession } from "@/types";

const CACHE_KEY = "gg_staff_cache";

export function useSession(): UserSession | null {
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    const loadFromAuth = async () => {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) { setSession(null); return; }

      // sessionStorageキャッシュを確認（ブラウザを閉じると自動削除）
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { auth_id, staff_session } = JSON.parse(cached);
          if (auth_id === authSession.user.id) {
            const savedFacility = localStorage.getItem("gg_facility_id");
            if (savedFacility) staff_session.selected_facility_id = savedFacility;
            setSession(staff_session);
            return;
          }
        }
      } catch {}

      // ng_staffからスタッフ情報を取得
      const username = authSession.user.email?.split("@")[0] ?? "";
      const { data: rows } = await supabase
        .from("ng_staff")
        .select("*")
        .eq("login_id", username)
        .limit(1);

      if (!rows || rows.length === 0) {
        // ng_staffに未登録のユーザーは強制サインアウト
        await supabase.auth.signOut();
        setSession(null);
        return;
      }

      const staff = rows[0];
      const savedFacility = localStorage.getItem("gg_facility_id");
      const userSession: UserSession = {
        id: authSession.user.id,
        org_id: staff.org_id ?? "org_1",
        facility_id: staff.facility_id,
        staff_id: staff.id,
        name: staff.name,
        role: staff.role as "admin" | "manager" | "staff",
        selected_facility_id: savedFacility ?? staff.facility_id,
      };

      // sessionStorageにキャッシュ（ブラウザを閉じると消える）
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        auth_id: authSession.user.id,
        staff_session: userSession,
      }));
      setSession(userSession);
    };

    loadFromAuth();

    // 認証状態の変化を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        sessionStorage.removeItem(CACHE_KEY);
        setSession(null);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadFromAuth();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return session;
}
