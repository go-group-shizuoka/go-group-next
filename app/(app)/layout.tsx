"use client";
// ==================== 認証済みエリアのレイアウト ====================
// サイドバー + メインコンテンツ領域。未ログイン時はログインへリダイレクト。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import type { UserSession } from "@/types";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // セッションチェック（未ログイン→ログインへ）
  useEffect(() => {
    const raw = localStorage.getItem("gg_session");
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      JSON.parse(raw) as UserSession;
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
          marginLeft: "240px",          // サイドバー分オフセット
          padding: "24px",
          minHeight: "100vh",
          paddingBottom: "80px",        // スマホのボトムナビ分
        }}
        className="md:ml-[240px] ml-0"
      >
        {children}
      </main>
    </div>
  );
}
