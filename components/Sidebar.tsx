"use client";
// ==================== サイドバー ====================
// 施設切替 + ナビゲーション。スマホではボトムナビに切り替え。

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { DUMMY_FACILITIES } from "@/lib/dummy-data";
import { supabase } from "@/lib/supabase";
import { useSession, useSetSelectedFacility } from "@/contexts/session-context";

// ナビゲーションメニュー定義
const NAV_ITEMS = [
  { href: "/dashboard",    icon: "🏠", label: "ダッシュボード", roles: ["admin","manager","staff"] },
  { href: "/children",     icon: "👦", label: "児童一覧",       roles: ["admin","manager","staff"] },
  { href: "/reservations", icon: "📅", label: "予約管理",       roles: ["admin","manager","staff"] },
  { href: "/attendance",   icon: "📋", label: "入退室記録",     roles: ["admin","manager","staff"] },
  { href: "/activities",   icon: "📸", label: "活動記録",       roles: ["admin","manager","staff"] },
  { href: "/messages",     icon: "💬", label: "保護者連絡",     roles: ["admin","manager","staff"] },
  { href: "/daily-report",  icon: "📓", label: "業務日報",       roles: ["admin","manager"] },
  { href: "/support-plan", icon: "📋", label: "個別支援計画",   roles: ["admin","manager"] },
  { href: "/billing",      icon: "💴", label: "請求管理",       roles: ["admin","manager"] },
  { href: "/schedule",     icon: "📅", label: "生徒予定表",     roles: ["admin","manager","staff"] },
  { href: "/shift",        icon: "📆", label: "シフト管理",     roles: ["admin","manager"] },
  { href: "/transport",    icon: "🚌", label: "送迎管理",       roles: ["admin","manager"] },
  { href: "/admin",        icon: "⚙️", label: "管理画面",       roles: ["admin"] },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const setSelectedFacility = useSetSelectedFacility();
  const [mobileOpen, setMobileOpen] = useState(false);

  // 施設切替（Contextを更新→リロード不要）
  const handleFacilityChange = (facilityId: string) => {
    if (!session) return;
    setSelectedFacility(facilityId);
    window.location.reload();
  };

  // ログアウト（Supabase Authから正式にサインアウト）
  const handleLogout = async () => {
    sessionStorage.removeItem("gg_staff_cache");
    localStorage.removeItem("gg_facility_id");
    await supabase.auth.signOut();
    router.push("/login");
  };

  // ロールでフィルタ
  const visibleNav = NAV_ITEMS.filter(
    (item) => !session || item.roles.includes(session.role)
  );

  // 施設一覧（admin・manager・facility_id未設定は全施設、staffは自施設のみ）
  const facilities = (session?.role === "admin" || session?.role === "manager" || !session?.facility_id)
    ? DUMMY_FACILITIES
    : DUMMY_FACILITIES.filter((f) => f.id === session?.facility_id);

  const selectedFacility = DUMMY_FACILITIES.find(
    (f) => f.id === session?.selected_facility_id
  );

  return (
    <>
      {/* ===================== PC用サイドバー ===================== */}
      <aside
        style={{
          width: "240px",
          height: "100vh",
          background: "var(--sb-bg)",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 50,
          overflowY: "hidden",
        }}
        className="hidden md:flex"
      >
        {/* ロゴ */}
        <div
          style={{
            padding: "20px 16px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: "linear-gradient(135deg,#0077b6,#00b4d8)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              🏠
            </div>
            <div>
              <div style={{ color: "white", fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em" }}>
                GO GROUP
              </div>
              <div style={{ color: "#64748b", fontSize: 10, marginTop: 1 }}>
                管理システム
              </div>
            </div>
          </div>
        </div>

        {/* 施設切替 */}
        <div style={{ padding: "12px 12px 8px" }}>
          <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>
            現在の施設
          </div>
          <select
            value={session?.selected_facility_id ?? ""}
            onChange={(e) => handleFacilityChange(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: "8px 10px",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {session?.role === "admin" && (
              <option value="" style={{ background: "#0a2540" }}>全施設</option>
            )}
            {facilities.map((f) => (
              <option key={f.id} value={f.id} style={{ background: "#0a2540" }}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* ナビゲーション（スクロール可能） */}
        <nav style={{ flex: 1, padding: "4px 8px", overflowY: "auto" }}>
          {visibleNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 8,
                  marginBottom: 2,
                  color: isActive ? "white" : "var(--sb-text)",
                  background: isActive ? "var(--sb-active)" : "transparent",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 400,
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ユーザー情報・ログアウト */}
        <div
          style={{
            padding: "12px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, paddingLeft: 4 }}>
            👤 {session?.name ?? "ゲスト"}
            <span
              style={{
                display: "inline-block",
                marginLeft: 6,
                fontSize: 10,
                background: "rgba(0,150,199,0.3)",
                color: "#7dd3fc",
                borderRadius: 4,
                padding: "1px 5px",
              }}
            >
              {session?.role === "admin" ? "管理者" : session?.role === "manager" ? "施設長" : "職員"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "8px",
              background: "rgba(239,68,68,0.12)",
              color: "#fca5a5",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ログアウト
          </button>
        </div>
      </aside>

      {/* ===================== スマホ用ボトムナビ ===================== */}
      <div
        className="flex md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: "var(--sb-bg)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          justifyContent: "space-around",
          padding: "6px 0 env(safe-area-inset-bottom)",
        }}
      >
        {visibleNav.slice(0, 5).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: "4px 8px",
                color: isActive ? "#00b4d8" : "#64748b",
                textDecoration: "none",
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
              }}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        {/* ハンバーガー（残りメニュー） */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            padding: "4px 8px",
            color: "#64748b",
            background: "transparent",
            border: "none",
            fontSize: 10,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 20 }}>☰</span>
          メニュー
        </button>
      </div>

      {/* スマホ用ドロワー */}
      {mobileOpen && (
        <div
          className="md:hidden"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,0.5)",
          }}
          onClick={() => setMobileOpen(false)}
        >
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: "260px",
              background: "var(--sb-bg)",
              padding: "20px 12px",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ color: "white", fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
              GO GROUP
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
              {session?.name}
            </div>
            {/* 施設切替（スマホ用） */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>
                現在の施設
              </div>
              <select
                value={session?.selected_facility_id ?? ""}
                onChange={(e) => { setMobileOpen(false); handleFacilityChange(e.target.value); }}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {session?.role === "admin" && (
                  <option value="" style={{ background: "#0a2540" }}>全施設</option>
                )}
                {facilities.map((f) => (
                  <option key={f.id} value={f.id} style={{ background: "#0a2540" }}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 8px",
                  borderRadius: 8,
                  color: "var(--sb-text)",
                  textDecoration: "none",
                  fontSize: 14,
                  marginBottom: 2,
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "10px",
                background: "rgba(239,68,68,0.12)",
                color: "#fca5a5",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ログアウト
            </button>
          </div>
        </div>
      )}
    </>
  );
}
