// ==================== 共通フック ====================

import { useState, useEffect } from "react";
import type { UserSession } from "@/types";

// セッション取得フック
export function useSession() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("gg_session");
    if (raw) {
      try { setSession(JSON.parse(raw)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const updateSession = (updates: Partial<UserSession>) => {
    if (!session) return;
    const updated = { ...session, ...updates };
    setSession(updated);
    localStorage.setItem("gg_session", JSON.stringify(updated));
  };

  return { session, loading, updateSession };
}

// ローカルストレージ保存フック（Supabase保存前の一時データ）
export function useLocalData<T>(key: string, initial: T) {
  const [data, setData] = useState<T>(initial);

  useEffect(() => {
    const raw = localStorage.getItem(key);
    if (raw) {
      try { setData(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, [key]);

  const save = (val: T) => {
    setData(val);
    localStorage.setItem(key, JSON.stringify(val));
  };

  return { data, save };
}
