"use client";
// ==================== ログイン画面 ====================
// Supabase Auth を優先し、未登録の場合はダミー認証にフォールバック。

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DUMMY_ACCOUNTS, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { authSignIn } from "@/lib/supabase";
import type { UserSession } from "@/types";

// セッション有効時間: 8時間
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

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

    // ① Supabase Auth でのログインを試みる
    let authOk = false;
    const { error: authError } = await authSignIn(username, password);
    if (!authError) authOk = true;

    // ② ダミーアカウント照合（Supabase未登録ユーザー or 開発環境用）
    const account = DUMMY_ACCOUNTS.find(
      (a) => a.username === username && a.password === password
    );

    if (!authOk && !account) {
      setError("ユーザーIDまたはパスワードが正しくありません");
      setLoading(false);
      return;
    }

    // ダミーアカウントが見つからなかった場合（Supabase Authのみ）はusername="admin"扱い
    const matched = account ?? DUMMY_ACCOUNTS[0];

    // セッション情報をlocalStorageに保存（有効期限付き）
    const session: UserSession & { expires_at: number } = {
      id: crypto.randomUUID(),
      org_id: "org_1",
      facility_id: matched.facility_id ?? "",
      staff_id: matched.staff_id ?? "",
      name: matched.name,
      role: matched.role,
      selected_facility_id: matched.facility_id ?? DUMMY_FACILITIES[0].id,
      expires_at: Date.now() + SESSION_TTL_MS,
    };
    localStorage.setItem("gg_session", JSON.stringify(session));

    router.push("/dashboard");
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

        {/* 開発用：テストアカウント一覧 */}
        <div
          style={{
            marginTop: "28px",
            padding: "14px",
            background: "#f8fafc",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "8px" }}>
            🔧 開発用テストアカウント（パスワード: pass）
          </p>
          {DUMMY_ACCOUNTS.map((a) => (
            <button
              key={a.username}
              onClick={() => { setUsername(a.username); setPassword("pass"); }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "5px 8px",
                fontSize: "12px",
                color: "#0077b6",
                background: "transparent",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#dbeafe")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {a.username} — {a.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
