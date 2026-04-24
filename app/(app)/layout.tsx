"use client";
// ==================== 認証済みエリアのレイアウト ====================
// セッションを同期的にチェック → スピナーなしで即座に表示。
// 未ログイン・期限切れはuseEffectでログインへリダイレクト。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { authSignOut } from "@/lib/supabase";
import type { UserSession } from "@/types";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // 同期的にセッションを確認 → 初回レンダリングから即座にコンテンツ表示
  const [ready] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem("gg_session");
      if (!raw) return false;
      const session = JSON.parse(raw) as UserSession & { expires_at?: number };
      if (session.expires_at && Date.now() > session.expires_at) return false;
      return true;
    } catch {
      return false;
    }
  });

  // 非ログイン・期限切れはリダイレクト（副作用なのでuseEffectで）
  useEffect(() => {
    if (ready) return;
    const raw = localStorage.getItem("gg_session");
    if (!raw) { router.replace("/login"); return; }
    try {
      const session = JSON.parse(raw) as UserSession & { expires_at?: number };
      if (session.expires_at && Date.now() > session.expires_at) {
        localStorage.removeItem("gg_session");
        authSignOut();
        router.replace("/login");
      } else {
        // readyがfalseでもセッションありの場合はリロード
        router.replace("/login");
      }
    } catch {
      router.replace("/login");
    }
  }, [ready, router]);

  // 未認証の場合は何も表示しない（リダイレクト待ち）
  if (!ready) return null;

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* サイドバー（PC固定） */}
      <Sidebar />

      {/* メインコンテンツ：PCはmargin-left:240px、スマホは0（globals.cssで制御） */}
      <main
        style={{
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
