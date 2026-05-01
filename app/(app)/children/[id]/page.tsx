"use client";
// ==================== 児童詳細 ====================
// 基本情報・保護者情報・注意事項・支援内容タブ + 編集機能

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { saveRecord, supabase, normalizeChild, isSupabaseReady } from "@/lib/supabase";
import type { Child, AttendanceRecord } from "@/types";

type TabKey = "basic" | "parent" | "notes" | "support" | "history";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "basic",   label: "基本情報",   icon: "👤" },
  { key: "parent",  label: "保護者情報", icon: "👨‍👩‍👧" },
  { key: "notes",   label: "注意事項",   icon: "⚠️" },
  { key: "support", label: "支援内容",   icon: "💡" },
  { key: "history", label: "利用履歴",   icon: "📅" },
];

const GRADES = ["未就学（0歳）","未就学（1歳）","未就学（2歳）","未就学（3歳）","未就学（4歳）","未就学（5歳）","小1","小2","小3","小4","小5","小6","中1","中2","中3","高1","高2","高3"];
const DOW_OPTIONS = ["月","火","水","木","金","土","日"];

export default function ChildDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [tab, setTab] = useState<TabKey>("basic");
  const [isEditing, setIsEditing] = useState(false);
  const [savingMsg, setSavingMsg] = useState("");

  const id = params.id as string;
  const [editChild, setEditChild] = useState<Child | null>(null);
  const [childLoading, setChildLoading] = useState(true);

  // 利用履歴用state
  const [historyMonth, setHistoryMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    setChildLoading(true);
    const dummy = DUMMY_CHILDREN.find((c) => c.id === id);
    if (dummy) {
      setEditChild({ ...dummy });
      setChildLoading(false);
      return;
    }
    if (!isSupabaseReady) {
      setChildLoading(false);
      return;
    }
    supabase.from("ng_children").select("*").eq("id", id).single()
      .then(({ data }) => {
        if (data) setEditChild(normalizeChild(data as Child));
        setChildLoading(false);
      })
      .catch(() => setChildLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 利用履歴をSupabaseから取得
  useEffect(() => {
    if (!id || tab !== "history") return;
    setHistoryLoading(true);
    supabase
      .from("ng_attendance")
      .select("*")
      .eq("child_id", id)
      .gte("date", `${historyMonth}-01`)
      .lte("date", `${historyMonth}-31`)
      .order("date", { ascending: true })
      .then(({ data }) => {
        setAttendanceHistory((data as AttendanceRecord[]) ?? []);
        setHistoryLoading(false);
      });
  }, [id, tab, historyMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const child = editChild;
  const fac = child ? DUMMY_FACILITIES.find((f) => f.id === child.facility_id) : undefined;

  if (childLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <span className="spinner" />
      </div>
    );
  }

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
    if (child) setEditChild({ ...child });
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
      {/* ヘッダーボタン行 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button
          onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", gap: 6, color: "#0077b6", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}
        >
          ← 児童一覧に戻る
        </button>
        {/* 書類管理ボタン */}
        <Link
          href={`/children/${id}/docs`}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#0a2540", color: "white", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none" }}
        >
          📄 書類管理
        </Link>
      </div>

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
        {tab === "history" && (
          <HistoryTab
            records={attendanceHistory}
            loading={historyLoading}
            month={historyMonth}
            onMonthChange={setHistoryMonth}
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
      { label: "学校名",           value: child.school ?? "—" },
      { label: "受給者証番号",     value: child.recipient_number ?? "—" },
      { label: "負担上限月額",     value: child.payment_limit ? `¥${child.payment_limit.toLocaleString()}` : "—" },
      { label: "上限管理事業所",   value: child.limit_manager ?? "—" },
      { label: "障害支援区分",     value: child.disability_level ?? "—" },
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
      <EditRow label="学校名">
        <input className="form-input" value={child.school ?? ""} placeholder="例: ○○小学校" onChange={(e) => onChange("school", e.target.value)} />
      </EditRow>
      <EditRow label="受給者証番号">
        <input className="form-input" value={child.recipient_number ?? ""} placeholder="例: 0123456789" onChange={(e) => onChange("recipient_number", e.target.value)} />
      </EditRow>
      <EditRow label="負担上限月額（円）">
        <input className="form-input" type="number" value={child.payment_limit ?? ""} placeholder="例: 4600" onChange={(e) => onChange("payment_limit", e.target.value)} />
      </EditRow>
      <EditRow label="上限管理事業所">
        <input className="form-input" value={child.limit_manager ?? ""} placeholder="例: ○○事業所" onChange={(e) => onChange("limit_manager", e.target.value)} />
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

// 利用履歴タブ
function HistoryTab({
  records, loading, month, onMonthChange
}: {
  records: AttendanceRecord[];
  loading: boolean;
  month: string;
  onMonthChange: (m: string) => void;
}) {
  // 月選択肢（過去12ヶ月）
  const monthOptions: { value: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    monthOptions.push({ value: `${y}-${String(m).padStart(2, "0")}`, label: `${y}年${m}月` });
    d.setMonth(d.getMonth() - 1);
  }

  // 来所日数・欠席日数を集計
  const arriveCount = records.filter((r) => r.arrive_time).length;
  const absentCount = records.filter((r) => r.status === "欠席").length;

  return (
    <div>
      {/* 月選択 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <select
          className="form-input"
          style={{ width: "auto" }}
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>
            来所：{arriveCount}日
          </span>
          {absentCount > 0 && (
            <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
              欠席：{absentCount}日
            </span>
          )}
        </div>
      </div>

      {/* ローディング */}
      {loading && (
        <div style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
          <span className="spinner" />
        </div>
      )}

      {/* データなし */}
      {!loading && records.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 13 }}>
          この月の記録はありません
        </div>
      )}

      {/* 記録テーブル */}
      {!loading && records.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>日付</th>
              <th style={{ textAlign: "center" }}>入室</th>
              <th style={{ textAlign: "center" }}>退出</th>
              <th style={{ textAlign: "center" }}>体温</th>
              <th style={{ textAlign: "center" }}>状態</th>
              <th style={{ textAlign: "center" }}>送迎</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const date = new Date(r.date);
              const dow = ["日","月","火","水","木","金","土"][date.getDay()];
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              return (
                <tr key={r.id}>
                  <td style={{ fontSize: 13, fontWeight: 600, color: isWeekend ? "#dc2626" : "#0a2540" }}>
                    {r.date.slice(5).replace("-", "/")} ({dow})
                  </td>
                  <td style={{ textAlign: "center", fontSize: 13, fontWeight: r.arrive_time ? 700 : 400, color: r.arrive_time ? "#059669" : "#94a3b8" }}>
                    {r.arrive_time ?? "—"}
                  </td>
                  <td style={{ textAlign: "center", fontSize: 13, fontWeight: r.depart_time ? 700 : 400, color: r.depart_time ? "#0077b6" : "#94a3b8" }}>
                    {r.depart_time ?? "—"}
                  </td>
                  <td style={{ textAlign: "center", fontSize: 13 }}>
                    {r.temperature ? `${r.temperature}℃` : "—"}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{
                      fontSize: 11, padding: "2px 10px", borderRadius: 10, fontWeight: 700,
                      background: r.status === "来所" ? "#dcfce7" : r.status === "欠席" ? "#fee2e2" : "#f1f5f9",
                      color: r.status === "来所" ? "#166534" : r.status === "欠席" ? "#dc2626" : "#64748b",
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "center", fontSize: 12, color: "#64748b" }}>
                    {r.transport_to ? "🚌" : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
