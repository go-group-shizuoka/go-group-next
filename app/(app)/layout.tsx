"use client";
// ==================== 認証済みエリアのレイアウト ====================

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { SessionProvider, useSession, useSessionLoading } from "@/contexts/session-context";

function AppContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const loading = useSessionLoading();

  useEffect(() => {
    // ローディング完了後、未ログインならloginへ
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  // 読み込み中
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f6fa",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48,
            border: "4px solid #e2e8f0",
            borderTop: "4px solid #0077b6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto",
          }} />
          <div style={{ marginTop: 16, fontSize: 14, color: "#64748b" }}>読み込み中...</div>
        </div>
      </div>
    );
  }

  // 未ログイン（useEffectでリダイレクト中）
  if (!session) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f6fa",
      }}>
        <div style={{ fontSize: 14, color: "#64748b" }}>ログイン画面に移動中...</div>
      </div>
    );
  }

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppContent>{children}</AppContent>
    </SessionProvider>
  );
}
