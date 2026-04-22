"use client";
// ==================== 児童詳細 ====================
// 基本情報・保護者情報・注意事項・支援内容・利用履歴タブ

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import type { Child } from "@/types";

type TabKey = "basic" | "parent" | "notes" | "support";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "basic",   label: "基本情報",   icon: "👤" },
  { key: "parent",  label: "保護者情報", icon: "👨‍👩‍👧" },
  { key: "notes",   label: "注意事項",   icon: "⚠️" },
  { key: "support", label: "支援内容",   icon: "💡" },
];

export default function ChildDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [tab, setTab] = useState<TabKey>("basic");

  const id = params.id as string;
  const child = DUMMY_CHILDREN.find((c) => c.id === id);
  const fac = child ? DUMMY_FACILITIES.find((f) => f.id === child.facility_id) : undefined;

  if (!child) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>😔</div>
        <p style={{ color: "#64748b" }}>児童が見つかりません</p>
        <button className="btn-secondary" onClick={() => router.back()} style={{ marginTop: 16 }}>
          ← 戻る
        </button>
      </div>
    );
  }

  const age = (() => {
    const dob = new Date(child.dob);
    const today = new Date();
    let a = today.getFullYear() - dob.getFullYear();
    if (
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
    ) a--;
    return a;
  })();

  return (
    <div>
      {/* 戻るボタン */}
      <button
        onClick={() => router.back()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "#0077b6",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 16,
          fontFamily: "inherit",
        }}
      >
        ← 児童一覧に戻る
      </button>

      {/* プロフィールバナー */}
      <div
        style={{
          background: "linear-gradient(135deg, #0a2540, #0077b6)",
          borderRadius: 14,
          padding: "20px 24px",
          color: "white",
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* アバター */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {child.name.slice(0, 1)}
        </div>

        {/* 名前・情報 */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {child.name}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
            {child.name_kana}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
              {child.grade}
            </span>
            <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
              {age}歳
            </span>
            <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
              {fac?.name}
            </span>
            {child.has_transport && (
              <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
                🚌 送迎あり
              </span>
            )}
          </div>
        </div>

        {/* 編集ボタン */}
        <button
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 8,
            color: "white",
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        >
          ✏️ 編集
        </button>
      </div>

      {/* タブ */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 16,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              border: tab === t.key ? "none" : "1.5px solid #e2e8f0",
              background: tab === t.key ? "#0077b6" : "white",
              color: tab === t.key ? "white" : "#64748b",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      <div className="card" style={{ padding: "20px" }}>
        {tab === "basic" && <BasicInfoTab child={child} age={age} fac={fac} />}
        {tab === "parent" && <ParentInfoTab child={child} />}
        {tab === "notes" && <NotesTab child={child} />}
        {tab === "support" && <SupportTab child={child} />}
      </div>
    </div>
  );
}

// 基本情報タブ
function BasicInfoTab({ child, age, fac }: { child: Child; age: number; fac: ReturnType<typeof DUMMY_FACILITIES.find> }) {
  const items = [
    { label: "氏名",       value: child.name },
    { label: "ふりがな",   value: child.name_kana ?? "—" },
    { label: "生年月日",   value: `${child.dob}（${age}歳）` },
    { label: "性別",       value: child.gender ?? "—" },
    { label: "学年",       value: child.grade ?? "—" },
    { label: "診断名",     value: child.diagnosis ?? "—" },
    { label: "障害支援区分", value: child.disability_level ?? "—" },
    { label: "所属施設",   value: fac?.name ?? "—" },
    { label: "利用曜日",   value: child.use_days ? child.use_days.join("・") + "曜" : "—" },
    { label: "送迎",       value: child.has_transport ? "あり" : "なし" },
  ];

  return (
    <table className="data-table">
      <tbody>
        {items.map((item) => (
          <tr key={item.label}>
            <td
              style={{
                width: "30%",
                fontWeight: 600,
                color: "#64748b",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </td>
            <td style={{ fontSize: 14, color: "#0a2540" }}>{item.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// 保護者情報タブ
function ParentInfoTab({ child }: { child: Child }) {
  return (
    <table className="data-table">
      <tbody>
        <tr>
          <td style={{ width: "30%", fontWeight: 600, color: "#64748b", fontSize: 12 }}>保護者名</td>
          <td>{child.parent_name ?? "—"}</td>
        </tr>
        <tr>
          <td style={{ fontWeight: 600, color: "#64748b", fontSize: 12 }}>連絡先</td>
          <td>
            {child.parent_phone ? (
              <a href={`tel:${child.parent_phone}`} style={{ color: "#0077b6" }}>
                {child.parent_phone}
              </a>
            ) : "—"}
          </td>
        </tr>
        <tr>
          <td style={{ fontWeight: 600, color: "#64748b", fontSize: 12 }}>緊急連絡先</td>
          <td>{child.emergency_contact ?? "—"}</td>
        </tr>
      </tbody>
    </table>
  );
}

// 注意事項タブ
function NotesTab({ child }: { child: Child }) {
  return (
    <div>
      {child.notes ? (
        <div
          style={{
            background: "#fff8f0",
            border: "1.5px solid #fed7aa",
            borderRadius: 10,
            padding: "14px 16px",
            fontSize: 14,
            lineHeight: 1.8,
            color: "#7c2d12",
          }}
        >
          ⚠️ {child.notes}
        </div>
      ) : (
        <div style={{ color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>
          注意事項の登録はありません
        </div>
      )}
    </div>
  );
}

// 支援内容タブ
function SupportTab({ child }: { child: Child }) {
  return (
    <div>
      {child.support_content ? (
        <div
          style={{
            background: "#f0fdf4",
            border: "1.5px solid #86efac",
            borderRadius: 10,
            padding: "14px 16px",
            fontSize: 14,
            lineHeight: 1.8,
            color: "#14532d",
          }}
        >
          💡 {child.support_content}
        </div>
      ) : (
        <div style={{ color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>
          支援内容の登録はありません
        </div>
      )}
    </div>
  );
}
