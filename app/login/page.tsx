"use client";
// ==================== ログイン画面 ====================
// Supabase Auth でログイン → ダッシュボードへリダイレクト
// ng_staffの確認はSessionProvider側で行う

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authSignIn } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Supabase Auth でログイン
      const { error: authError } = await authSignIn(username, password);

      if (authError) {
        setError("ユーザーIDまたはパスワードが正しくありません");
        setLoading(false);
        return;
      }

      // 認証成功 → ダッシュボードへ（replaceでログイン画面を履歴から除去）
      window.location.replace("/dashboard");
    } catch {
      setError("ログイン中にエラーが発生しました。再度お試しください。");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a2540 0%, #0077b6 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "40px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* ロゴ・タイトル */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              background: "linear-gradient(135deg, #0077b6, #00b4d8)",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              margin: "0 auto 16px",
            }}
          >
            🏠
          </div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 800,
              color: "#0a2540",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            GO GROUP
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
            放課後等デイサービス 管理システム
          </p>
        </div>

        {/* ログインフォーム */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">ユーザーID</label>
            <input
              className="form-input"
              type="text"
              placeholder="例: home_mgr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label className="form-label">パスワード</label>
            <input
              className="form-input"
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {/* エラーメッセージ */}
          {error && (
            <div
              style={{
                background: "#fee2e2",
                border: "1px solid #fca5a5",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#991b1b",
                marginBottom: "16px",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <button
            className="btn-primary"
            type="submit"
            disabled={loading || !username || !password}
            style={{ width: "100%", justifyContent: "center", padding: "13px" }}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                ログイン中...
              </>
            ) : (
              "ログイン"
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
