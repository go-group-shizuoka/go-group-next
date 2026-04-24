// ==================== セッションフック ====================
// localStorageから同期的にセッションを取得する。
// useEffectを使わないため、ページ表示時の余分な再レンダリングをなくし高速化。

import { useState } from "react";
import type { UserSession } from "@/types";

export function useSession(): UserSession | null {
  // useState の初期化関数でlocalStorageを同期的に読み込む
  // → 最初のレンダリング時点でsessionが確定するため、余分な再描画ゼロ
  const [session] = useState<UserSession | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("gg_session");
      if (!raw) return null;
      return JSON.parse(raw) as UserSession;
    } catch {
      return null;
    }
  });
  return session;
}
