"use client";
// ==================== 認証済みエリアのレイアウト ====================
// サイドバー + メインコンテンツ領域。未ログイン・セッション期限切れ時はログインへ。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { authSignOut } from "@/lib/supabase";
import type { UserSession } from "@/types";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // セッションチェック（未ログイン・期限切れ→ログインへ）
  useEffect(() => {
    const raw = localStorage.getItem("gg_session");
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      const session = JSON.parse(raw) as UserSession & { expires_at?: number };
      // 有効期限チェック
      if (session.expires_at && Date.now() > session.expires_at) {
        localStorage.removeItem("gg_session");
        authSignOut(); // Supabase Authもサインアウト
        router.replace("/login");
        return;
      }
      setReady(true);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* サイドバー（PC固定） */}
      <Sidebar />

      {/* メインコンテンツ */}
      <main
        style={{
          flex: 1,
          padding: "20px 16px",
          minHeight: "100vh",
          paddingBottom: "80px",
        }}
        className="main-content"
      >
        {children}
      </main>
    </div>
  );
}
