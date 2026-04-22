"use client";
// ==================== 児童詳細 ====================
// 基本情報・保護者情報・注意事項・支援内容タブ + 編集機能

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { saveRecord } from "@/lib/supabase";
import type { Child } from "@/types";

type TabKey = "basic" | "parent" | "notes" | "support";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "basic",   label: "基本情報",   icon: "👤" },
  { key: "parent",  label: "保護者情報", icon: "👨‍👩‍👧" },
  { key: "notes",   label: "注意事項",   icon: "⚠️" },
  { key: "support", label: "支援内容",   icon: "💡" },
];

const GRADES = ["未就学（0歳）","未就学（1歳）","未就学（2歳）","未就学（3歳）","未就学（4歳）","未就学（5歳）","小1","小2","小3","小4","小5","小6","中1","中2","中3","高1","高2","高3"];
const DOW_OPTIONS = ["月","火","水","木","金","土","日"];

export default function ChildDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [tab, setTab] = useState<TabKey>("basic");
  const [isEditing, setIsEditing] = useState(false);
  const [savingMsg, setSavingMsg] = useState("");

  // ローカル編集用state（ダミーデータから初期値）
  const id = params.id as string;
  const originalChild = DUMMY_CHILDREN.find((c) => c.id === id);
  const [editChild, setEditChild] = useState<Child | null>(null);

  useEffect(() => {
    if (originalChild) setEditChild({ ...originalChild });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const child = editChild ?? originalChild;
  const fac = child ? DUMMY_FACILITIES.find((f) => f.id === child.facility_id) : undefined;

  if (!child || !editChild) {
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
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) a--;
    return a;
  })();

  // 保存処理
  const handleSave = async () => {
    setSavingMsg("保存中...");
    await saveRecord("ng_children", editChild as unknown as Record<string, unknown>);
    setSavingMsg("✓ 保存しました");
    setIsEditing(false);
    setTimeout(() => setSavingMsg(""), 3000);
  };

  // 編集キャンセル
  const handleCancel = () => {
    setEditChild({ ...originalChild! });
    setIsEditing(false);
  };

  // 利用曜日のトグル
  const toggleDay = (day: string) => {
    const days = editChild.use_days ?? [];
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    setEditChild({ ...editChild, use_days: next });
  };

  return (
    <div>
      {/* 戻るボタン */}
      <button
        onClick={() => router.back()}
        style={{ display: "flex", alignItems: "center", gap: 6, color: "#0077b6", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 16, fontFamily: "inherit" }}
      >
        ← 児童一覧に戻る
      </button>

      {/* プロフィールバナー */}
      <div style={{ background: "linear-gradient(135deg, #0a2540, #0077b6)", borderRadius: 14, padding: "20px 24px", color: "white", display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, flexShrink: 0 }}>
          {child.name.slice(0, 1)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{child.name}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{child.name_kana}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>{child.grade}</span>
            <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>{age}歳</span>
            <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>{fac?.name}</span>
            {child.has_transport && <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>🚌 送迎あり</span>}
          </div>
        </div>
        {/* 編集ボタン */}
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, color: "white", padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            ✏️ 編集
          </button>
        ) : (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={handleSave} style={{ background: "#22c55e", border: "none", borderRadius: 8, color: "white", padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              💾 保存
            </button>
            <button onClick={handleCancel} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, color: "white", padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              キャンセル
            </button>
          </div>
        )}
      </div>

      {/* 保存メッセージ */}
      {savingMsg && (
        <div style={{ background: savingMsg.includes("✓") ? "#dcfce7" : "#dbeafe", color: savingMsg.includes("✓") ? "#166534" : "#1d4ed8", borderRadius: 8, padding: "10px 16px", marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
          {savingMsg}
        </div>
      )}

      {/* タブ */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ padding: "8px 16px", borderRadius: 20, border: tab === t.key ? "none" : "1.5px solid #e2e8f0", background: tab === t.key ? "#0077b6" : "white", color: tab === t.key ? "white" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", transition: "all 0.15s" }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      <div className="card" style={{ padding: "20px" }}>
        {tab === "basic" && (
          <BasicInfoTab child={editChild} age={age} fac={fac} isEditing={isEditing}
            onChange={(field, val) => setEditChild({ ...editChild, [field]: val })}
            toggleDay={toggleDay}
          />
        )}
        {tab === "parent" && (
          <ParentInfoTab child={editChild} isEditing={isEditing}
            onChange={(field, val) => setEditChild({ ...editChild, [field]: val })}
          />
        )}
        {tab === "notes" && (
          <NotesTab child={editChild} isEditing={isEditing}
            onChange={(val) => setEditChild({ ...editChild, notes: val })}
          />
        )}
        {tab === "support" && (
          <SupportTab child={editChild} isEditing={isEditing}
            onChange={(val) => setEditChild({ ...editChild, support_content: val })}
          />
        )}
      </div>
    </div>
  );
}

// 基本情報タブ
function BasicInfoTab({
  child, age, fac, isEditing, onChange, toggleDay
}: {
  child: Child;
  age: number;
  fac: ReturnType<typeof DUMMY_FACILITIES.find>;
  isEditing: boolean;
  onChange: (field: keyof Child, val: string | boolean | string[]) => void;
  toggleDay: (day: string) => void;
}) {
  if (!isEditing) {
    const items = [
      { label: "氏名",         value: child.name },
      { label: "ふりがな",     value: child.name_kana ?? "—" },
      { label: "生年月日",     value: `${child.dob}（${age}歳）` },
      { label: "性別",         value: child.gender ?? "—" },
      { label: "学年",         value: child.grade ?? "—" },
      { label: "診断名",       value: child.diagnosis ?? "—" },
      { label: "障害支援区分", value: child.disability_level ?? "—" },
      { label: "所属施設",     value: fac?.name ?? "—" },
      { label: "利用曜日",     value: child.use_days ? child.use_days.join("・") + "曜" : "—" },
      { label: "送迎",         value: child.has_transport ? "あり" : "なし" },
    ];
    return (
      <table className="data-table">
        <tbody>
          {items.map((item) => (
            <tr key={item.label}>
              <td style={{ width: "30%", fontWeight: 600, color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>{item.label}</td>
              <td style={{ fontSize: 14, color: "#0a2540" }}>{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <EditRow label="氏名 *">
        <input className="form-input" value={child.name} onChange={(e) => onChange("name", e.target.value)} />
      </EditRow>
      <EditRow label="ふりがな">
        <input className="form-input" value={child.name_kana ?? ""} placeholder="例: やまだたろう" onChange={(e) => onChange("name_kana", e.target.value)} />
      </EditRow>
      <EditRow label="生年月日">
        <input className="form-input" type="date" value={child.dob} onChange={(e) => onChange("dob", e.target.value)} />
      </EditRow>
      <EditRow label="性別">
        <select className="form-input" value={child.gender ?? ""} onChange={(e) => onChange("gender", e.target.value)}>
          <option value="">未選択</option>
          <option value="男">男</option>
          <option value="女">女</option>
        </select>
      </EditRow>
      <EditRow label="学年">
        <select className="form-input" value={child.grade ?? ""} onChange={(e) => onChange("grade", e.target.value)}>
          <option value="">未選択</option>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </EditRow>
      <EditRow label="診断名">
        <input className="form-input" value={child.diagnosis ?? ""} placeholder="例: 自閉スペクトラム症" onChange={(e) => onChange("diagnosis", e.target.value)} />
      </EditRow>
      <EditRow label="障害支援区分">
        <input className="form-input" value={child.disability_level ?? ""} placeholder="例: 区分3" onChange={(e) => onChange("disability_level", e.target.value)} />
      </EditRow>
      <EditRow label="利用曜日">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {DOW_OPTIONS.map((day) => {
            const active = (child.use_days ?? []).includes(day);
            return (
              <button key={day} type="button" onClick={() => toggleDay(day)}
                style={{ padding: "6px 14px", borderRadius: 20, border: active ? "none" : "1.5px solid #e2e8f0", background: active ? "#0077b6" : "white", color: active ? "white" : "#64748b", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {day}
              </button>
            );
          })}
        </div>
      </EditRow>
      <EditRow label="送迎">
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
          <input type="checkbox" checked={child.has_transport ?? false} onChange={(e) => onChange("has_transport", e.target.checked)} style={{ width: 16, height: 16 }} />
          送迎あり
        </label>
      </EditRow>
    </div>
  );
}

// 保護者情報タブ
function ParentInfoTab({ child, isEditing, onChange }: { child: Child; isEditing: boolean; onChange: (field: keyof Child, val: string) => void }) {
  if (!isEditing) {
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
                <a href={`tel:${child.parent_phone}`} style={{ color: "#0077b6" }}>{child.parent_phone}</a>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <EditRow label="保護者名">
        <input className="form-input" value={child.parent_name ?? ""} placeholder="例: 山田花子" onChange={(e) => onChange("parent_name", e.target.value)} />
      </EditRow>
      <EditRow label="連絡先（電話）">
        <input className="form-input" type="tel" value={child.parent_phone ?? ""} placeholder="例: 090-0000-0000" onChange={(e) => onChange("parent_phone", e.target.value)} />
      </EditRow>
      <EditRow label="緊急連絡先">
        <input className="form-input" value={child.emergency_contact ?? ""} placeholder="例: 父: 090-0000-0001" onChange={(e) => onChange("emergency_contact", e.target.value)} />
      </EditRow>
    </div>
  );
}

// 注意事項タブ
function NotesTab({ child, isEditing, onChange }: { child: Child; isEditing: boolean; onChange: (val: string) => void }) {
  if (!isEditing) {
    return child.notes ? (
      <div style={{ background: "#fff8f0", border: "1.5px solid #fed7aa", borderRadius: 10, padding: "14px 16px", fontSize: 14, lineHeight: 1.8, color: "#7c2d12" }}>
        ⚠️ {child.notes}
      </div>
    ) : (
      <div style={{ color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>注意事項の登録はありません</div>
    );
  }

  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>
        ⚠️ 注意事項・アレルギー・禁忌事項など
      </label>
      <textarea
        className="form-input"
        style={{ minHeight: 120, resize: "vertical" }}
        placeholder="アレルギー・服薬・行動上の注意点などを記録"
        value={child.notes ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// 支援内容タブ
function SupportTab({ child, isEditing, onChange }: { child: Child; isEditing: boolean; onChange: (val: string) => void }) {
  if (!isEditing) {
    return child.support_content ? (
      <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 10, padding: "14px 16px", fontSize: 14, lineHeight: 1.8, color: "#14532d" }}>
        💡 {child.support_content}
      </div>
    ) : (
      <div style={{ color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>支援内容の登録はありません</div>
    );
  }

  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>
        💡 支援内容・配慮事項
      </label>
      <textarea
        className="form-input"
        style={{ minHeight: 120, resize: "vertical" }}
        placeholder="個別の支援内容・配慮が必要な事項を記録"
        value={child.support_content ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// 編集行の共通レイアウト
function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
