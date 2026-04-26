// ==================== セッションフック ====================
// useEffectでlocalStorageを読み込む。
// SSR時はnullを返し、マウント後に実際のセッションをセットする。
// → Hydrationエラーを防ぐ正しいパターン

import { useState, useEffect } from "react";
import type { UserSession } from "@/types";

export function useSession(): UserSession | null {
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("gg_session");
      if (!raw) return;
      const parsed = JSON.parse(raw) as UserSession & { expires_at?: number };
      // セッション期限チェック
      if (parsed.expires_at && Date.now() > parsed.expires_at) {
        localStorage.removeItem("gg_session");
        return;
      }
      setSession(parsed);
    } catch {
      // 破損データは無視
    }
  }, []);

  return session;
}
