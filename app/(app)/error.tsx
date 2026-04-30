"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f0f6fa",
      padding: 24,
    }}>
      <div style={{
        background: "white",
        borderRadius: 12,
        padding: "32px 24px",
        maxWidth: 500,
        width: "100%",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
          エラーが発生しました
        </div>
        <div style={{
          background: "#fee2e2",
          borderRadius: 8,
          padding: "12px 16px",
          fontSize: 12,
          color: "#991b1b",
          marginBottom: 16,
          fontFamily: "monospace",
          wordBreak: "break-all",
        }}>
          {error.message || "不明なエラー"}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={reset}
            style={{
              flex: 1,
              padding: "10px",
              background: "#0077b6",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            再試行
          </button>
          <button
            onClick={() => { window.location.href = "/login"; }}
            style={{
              flex: 1,
              padding: "10px",
              background: "#f1f5f9",
              color: "#475569",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ログインに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
