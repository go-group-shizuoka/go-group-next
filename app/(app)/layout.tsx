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

  // SSR時はfalse固定にしてHydrationエラーを防ぐ
  // useEffectでマウント後にlocalStorageを確認する
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("gg_session");
      if (!raw) { router.replace("/login"); return; }
      const session = JSON.parse(raw) as UserSession & { expires_at?: number };
      if (session.expires_at && Date.now() > session.expires_at) {
        localStorage.removeItem("gg_session");
        authSignOut();
        router.replace("/login");
        return;
      }
      setReady(true);
    } catch {
      router.replace("/login");
    }
  }, [router]);

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
