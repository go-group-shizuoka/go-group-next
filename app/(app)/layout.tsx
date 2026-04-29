"use client";
// ==================== 認証済みエリアのレイアウト ====================
// Supabase Authのトークンで認証チェック。未ログインはログインへリダイレクト。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 初回: 現在のSupabase Authセッションを確認
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
      } else {
        setReady(true);
      }
    });

    // 以降: 認証状態の変化を監視（トークン期限切れ・別タブでのログアウトに対応）
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (!ready) return null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <Sidebar />
      <main
        style={{ padding: "20px 16px", minHeight: "100vh", paddingBottom: "80px" }}
        className="main-content"
      >
        {children}
      </main>
    </div>
  );
}
