"use client";
// ==================== ダッシュボード ====================
// 今日の状況サマリーを表示するホーム画面

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DUMMY_FACILITIES, DUMMY_CHILDREN } from "@/lib/dummy-data";
import type { UserSession } from "@/types";

// 今日の曜日（日本語）
function getTodayDow(): string {
  return ["日","月","火","水","木","金","土"][new Date().getDay()];
}
function getTodayDisplay(): string {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${getTodayDow()}）`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("gg_session");
    if (raw) setSession(JSON.parse(raw));
  }, []);

  if (!session) return null;

  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);
  const todayDow = getTodayDow();

  // 今日の利用予定児童（曜日で絞り込み）
  const todayChildren = DUMMY_CHILDREN.filter(
    (c) =>
      c.facility_id === session.selected_facility_id &&
      c.active &&
      c.use_days?.includes(todayDow)
  );

  // ショートカットメニュー
  const shortcuts = [
    { icon: "📋", label: "入退室記録",  href: "/attendance",   color: "#0077b6", desc: "来所・退所・体温" },
    { icon: "👦", label: "児童一覧",    href: "/children",     color: "#0096c7", desc: "利用者情報" },
    { icon: "📸", label: "活動記録",    href: "/activities",   color: "#00b4d8", desc: "活動・写真" },
    { icon: "💬", label: "保護者連絡",  href: "/messages",     color: "#7c3aed", desc: "メッセージ" },
    { icon: "📓", label: "業務日報",    href: "/daily-report", color: "#059669", desc: "日報作成" },
    { icon: "📅", label: "生徒予定表",  href: "/schedule",     color: "#d97706", desc: "月間予定" },
  ];

  return (
    <div>
      {/* ページヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0a2540", letterSpacing: "-0.02em" }}>
          {fac?.name ?? "GO GROUP"}
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
          {getTodayDisplay()} ｜ ようこそ、{session.name}さん
        </div>
      </div>

      {/* 今日のサマリーカード */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {/* 来所予定 */}
        <SummaryCard
          icon="👦"
          label="本日の来所予定"
          value={`${todayChildren.length}名`}
          color="#0077b6"
          sub={`${todayDow}曜来所`}
        />
        {/* 送迎あり */}
        <SummaryCard
          icon="🚌"
          label="送迎あり"
          value={`${todayChildren.filter((c) => c.has_transport).length}名`}
          color="#0096c7"
          sub="本日送迎対象"
        />
        {/* 施設定員 */}
        <SummaryCard
          icon="🏠"
          label="施設定員"
          value={`${fac?.capacity ?? 10}名`}
          color="#059669"
          sub={fac?.service_type ?? ""}
        />
      </div>

      {/* ショートカット */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "#94a3b8",
            marginBottom: 12,
          }}
        >
          QUICK ACCESS
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {shortcuts.map((s) => (
            <button
              key={s.href}
              onClick={() => router.push(s.href)}
              style={{
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "16px 12px",
                textAlign: "center",
                cursor: "pointer",
                transition: "box-shadow 0.15s, transform 0.1s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 今日の来所予定リスト */}
      {todayChildren.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#0a2540",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            📋 本日の来所予定 ({todayDow}曜)
            <span className="badge badge-blue">{todayChildren.length}名</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {todayChildren.map((child) => (
              <div
                key={child.id}
                onClick={() => router.push(`/children/${child.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* アバター */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,#0077b6,#00b4d8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {child.name.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{child.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                    {child.grade} ／ {child.diagnosis}
                  </div>
                </div>
                {child.has_transport && (
                  <span className="badge badge-blue">🚌 送迎</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// サマリーカードコンポーネント
function SummaryCard({
  icon, label, value, color, sub,
}: {
  icon: string; label: string; value: string; color: string; sub: string;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "16px",
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>
    </div>
  );
}
