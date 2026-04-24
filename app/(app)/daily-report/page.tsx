"use client";
// ==================== 業務日報 ====================
// 入退室・活動記録を自動集計。Supabase保存・読み込み対応。印刷対応。

import { useState, useEffect } from "react";
import { DUMMY_CHILDREN, DUMMY_FACILITIES, DUMMY_STAFF } from "@/lib/dummy-data";
import { saveRecord, fetchByFacility } from "@/lib/supabase";
import type { UserSession, DailyReport } from "@/types";
import { useSession } from "@/hooks/useSession";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function getTodayDow() { return ["日","月","火","水","木","金","土"][new Date().getDay()]; }
function genId() { return crypto.randomUUID(); }

// JSON.parse のラッパー（破損データでもクラッシュしない）
function safeParseActivities(s?: string): ReportActivity[] {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}

type ReportActivity = { time: string; title: string; detail: string; staff: string };
type ReportStatus = "下書き" | "確認中" | "承認済";

// ローカルで扱う詳細型（Supabaseと変換する）
type DailyReportData = {
  id: string;
  date: string;
  facility_id: string;
  weather: string;
  author: string;
  child_count: number;
  staff_count: number;
  activities: ReportActivity[];
  incident: string;
  parent_note: string;
  tomorrow_note: string;
  manager_note: string;
  status: ReportStatus;
};

const WEATHER_OPTIONS = ["晴れ","曇り","雨","雪","晴れ時々曇り","曇り時々雨"];

// Supabase行 → ローカル型に変換
function toLocal(r: DailyReport): DailyReportData {
  return {
    id: r.id,
    date: r.date,
    facility_id: r.facility_id,
    weather: r.weather ?? "晴れ",
    author: r.author,
    child_count: r.child_count ?? 0,
    staff_count: r.staff_count ?? 0,
    activities: safeParseActivities(r.activities),
    incident: r.incident ?? "",
    parent_note: r.parent_note ?? "",
    tomorrow_note: r.tomorrow_note ?? "",
    manager_note: r.manager_note ?? "",
    status: r.status,
  };
}

export default function DailyReportPage() {
  const session = useSession();
  const [selDate, setSelDate] = useState(todayISO());
  const [report, setReport] = useState<DailyReportData | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDB, setLoadingDB] = useState(false);
  const [reports, setReports] = useState<DailyReportData[]>([]);
  const [view, setView] = useState<"list" | "edit" | "view">("list");

  // Supabaseから日報一覧を読み込む
  useEffect(() => {
    if (!session) return;
    setLoadingDB(true);
    fetchByFacility<DailyReport>(
      "ng_daily_reports",
      session.org_id,
      session.selected_facility_id
    ).then((rows) => {
      setReports(rows.map(toLocal));
      setLoadingDB(false);
    });
  }, [session]);

  if (!session) return null;
  if (loadingDB) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <span className="spinner" />
    </div>
  );

  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);
  const todayDow = getTodayDow();

  // 今日の来所予定児童
  const todayChildren = DUMMY_CHILDREN.filter(
    (c) => c.active && c.facility_id === session.selected_facility_id && (c.use_days ?? []).includes(todayDow)
  );
  const facilityStaff = DUMMY_STAFF.filter((s) => s.facility_id === session.selected_facility_id);

  // 新規日報作成
  const createReport = () => {
    const existing = reports.find((r) => r.date === selDate && r.facility_id === session.selected_facility_id);
    if (existing) { setReport(existing); setView("edit"); return; }
    const newReport: DailyReportData = {
      id: genId(),
      date: selDate,
      facility_id: session.selected_facility_id,
      weather: "晴れ",
      author: session.name,
      child_count: todayChildren.length,
      staff_count: facilityStaff.length,
      activities: [
        { time: "14:00", title: "来所・健康チェック", detail: "体温測定・健康観察を実施", staff: session.name },
        { time: "14:30", title: "", detail: "", staff: "" },
        { time: "15:30", title: "", detail: "", staff: "" },
        { time: "17:00", title: "退所準備・送迎", detail: "", staff: "" },
      ],
      incident: "",
      parent_note: "",
      tomorrow_note: "",
      manager_note: "",
      status: "下書き",
    };
    setReport(newReport);
    setView("edit");
  };

  const handleSave = async (status: ReportStatus) => {
    if (!report) return;
    setSaving(true);
    const updated = { ...report, status };

    // Supabaseに保存
    await saveRecord("ng_daily_reports", {
      id: updated.id,
      org_id: session.org_id,
      facility_id: session.selected_facility_id,
      date: updated.date,
      weather: updated.weather,
      author: updated.author,
      child_count: updated.child_count,
      staff_count: updated.staff_count,
      activities: JSON.stringify(updated.activities),
      incident: updated.incident,
      parent_note: updated.parent_note,
      tomorrow_note: updated.tomorrow_note,
      manager_note: updated.manager_note,
      status: updated.status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setReports((p) => [
      updated,
      ...p.filter((r) => !(r.date === updated.date && r.facility_id === updated.facility_id)),
    ]);
    setReport(updated);
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const handlePrint = () => window.print();

  const updActivity = (i: number, key: keyof ReportActivity, val: string) => {
    if (!report) return;
    const acts = [...report.activities];
    acts[i] = { ...acts[i], [key]: val };
    setReport({ ...report, activities: acts });
  };

  const addActivity = () => {
    if (!report) return;
    setReport({ ...report, activities: [...report.activities, { time: "", title: "", detail: "", staff: "" }] });
  };

  const removeActivity = (i: number) => {
    if (!report) return;
    setReport({ ...report, activities: report.activities.filter((_, idx) => idx !== i) });
  };

  // ===== 編集・閲覧画面 =====
  if ((view === "edit" || view === "view") && report) {
    const isEdit = view === "edit";
    const statusColor: Record<ReportStatus, string> = { "下書き": "#f59e0b", "確認中": "#3b82f6", "承認済": "#22c55e" };

    return (
      <div>
        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <button onClick={() => setView("list")} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0077b6", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
            ← 一覧に戻る
          </button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge" style={{ background: statusColor[report.status] + "22", color: statusColor[report.status], fontSize: 12, padding: "4px 10px" }}>
              {report.status}
            </span>
            {saved && <span className="badge badge-green">✓ 保存済み</span>}
            <button className="btn-secondary" onClick={handlePrint} style={{ padding: "7px 14px", fontSize: 12 }}>🖨️ 印刷</button>
            {isEdit && (
              <>
                <button className="btn-secondary" onClick={() => handleSave("下書き")} disabled={saving} style={{ padding: "7px 14px", fontSize: 12 }}>
                  {saving ? "保存中..." : "一時保存"}
                </button>
                <button className="btn-primary" onClick={() => handleSave("確認中")} disabled={saving} style={{ padding: "7px 14px", fontSize: 12 }}>
                  提出する
                </button>
              </>
            )}
            {!isEdit && session.role === "manager" && report.status === "確認中" && (
              <button className="btn-primary" onClick={() => handleSave("承認済")} disabled={saving} style={{ padding: "7px 14px", fontSize: 12, background: "#059669" }}>
                ✓ 承認
              </button>
            )}
          </div>
        </div>

        {/* 日報本体 */}
        <div className="card" style={{ padding: 24 }} id="print-area">
          {/* タイトル */}
          <div style={{ textAlign: "center", marginBottom: 20, borderBottom: "2px solid #0077b6", paddingBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0a2540" }}>業務日報</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
              {fac?.name} ／ {report.date} ／ 記録者: {report.author}
            </div>
          </div>

          {/* 基本情報 */}
          <Section title="基本情報">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              <Field label="天気" value={
                isEdit ? (
                  <select className="form-input" style={{ padding: "6px 10px" }} value={report.weather} onChange={(e) => setReport({ ...report, weather: e.target.value })}>
                    {WEATHER_OPTIONS.map((w) => <option key={w}>{w}</option>)}
                  </select>
                ) : report.weather
              } />
              <Field label="来所児童数" value={
                isEdit ? (
                  <input className="form-input" type="number" style={{ padding: "6px 10px" }} value={report.child_count} onChange={(e) => setReport({ ...report, child_count: +e.target.value })} />
                ) : `${report.child_count}名`
              } />
              <Field label="出勤スタッフ数" value={
                isEdit ? (
                  <input className="form-input" type="number" style={{ padding: "6px 10px" }} value={report.staff_count} onChange={(e) => setReport({ ...report, staff_count: +e.target.value })} />
                ) : `${report.staff_count}名`
              } />
            </div>
          </Section>

          {/* 来所児童一覧 */}
          <Section title="来所児童一覧（自動集計）">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {todayChildren.map((c) => (
                <span key={c.id} className="badge badge-blue" style={{ fontSize: 12 }}>{c.name} ({c.grade})</span>
              ))}
              {todayChildren.length === 0 && <span style={{ color: "#94a3b8", fontSize: 13 }}>来所予定なし</span>}
            </div>
          </Section>

          {/* 活動プログラム */}
          <Section title="活動プログラム">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle}>時間</th>
                  <th style={thStyle}>活動内容</th>
                  <th style={thStyle}>詳細・備考</th>
                  <th style={thStyle}>担当</th>
                  {isEdit && <th style={{ ...thStyle, width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {report.activities.map((act, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>
                      {isEdit ? <input className="form-input" type="time" style={{ padding: "4px 8px", fontSize: 12 }} value={act.time} onChange={(e) => updActivity(i, "time", e.target.value)} /> : act.time}
                    </td>
                    <td style={tdStyle}>
                      {isEdit ? <input className="form-input" style={{ padding: "4px 8px", fontSize: 12 }} placeholder="活動名" value={act.title} onChange={(e) => updActivity(i, "title", e.target.value)} /> : act.title}
                    </td>
                    <td style={tdStyle}>
                      {isEdit ? <input className="form-input" style={{ padding: "4px 8px", fontSize: 12 }} placeholder="詳細" value={act.detail} onChange={(e) => updActivity(i, "detail", e.target.value)} /> : act.detail}
                    </td>
                    <td style={tdStyle}>
                      {isEdit ? <input className="form-input" style={{ padding: "4px 8px", fontSize: 12 }} placeholder="担当者" value={act.staff} onChange={(e) => updActivity(i, "staff", e.target.value)} /> : act.staff}
                    </td>
                    {isEdit && (
                      <td style={tdStyle}>
                        <button onClick={() => removeActivity(i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>✕</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {isEdit && (
              <button className="btn-secondary" onClick={addActivity} style={{ marginTop: 8, padding: "6px 14px", fontSize: 12 }}>
                ＋ 行を追加
              </button>
            )}
          </Section>

          {/* 特記事項 */}
          <Section title="特記事項・インシデント">
            {isEdit ? (
              <textarea className="form-input" style={{ minHeight: 72, resize: "vertical" }} placeholder="ヒヤリハット・インシデントがあれば記録" value={report.incident} onChange={(e) => setReport({ ...report, incident: e.target.value })} />
            ) : (
              <div style={{ fontSize: 13, color: report.incident ? "#1e293b" : "#94a3b8", lineHeight: 1.7 }}>{report.incident || "特になし"}</div>
            )}
          </Section>

          {/* 保護者連絡事項 */}
          <Section title="保護者への連絡事項">
            {isEdit ? (
              <textarea className="form-input" style={{ minHeight: 72, resize: "vertical" }} placeholder="保護者へ伝えること" value={report.parent_note} onChange={(e) => setReport({ ...report, parent_note: e.target.value })} />
            ) : (
              <div style={{ fontSize: 13, color: report.parent_note ? "#1e293b" : "#94a3b8", lineHeight: 1.7 }}>{report.parent_note || "特になし"}</div>
            )}
          </Section>

          {/* 翌日の申し送り */}
          <Section title="翌日への申し送り">
            {isEdit ? (
              <textarea className="form-input" style={{ minHeight: 72, resize: "vertical" }} placeholder="翌日スタッフへの引き継ぎ事項" value={report.tomorrow_note} onChange={(e) => setReport({ ...report, tomorrow_note: e.target.value })} />
            ) : (
              <div style={{ fontSize: 13, color: report.tomorrow_note ? "#1e293b" : "#94a3b8", lineHeight: 1.7 }}>{report.tomorrow_note || "特になし"}</div>
            )}
          </Section>

          {/* 管理者コメント */}
          {(session.role === "manager" || session.role === "admin" || report.manager_note) && (
            <Section title="管理者コメント">
              {isEdit && (session.role === "manager" || session.role === "admin") ? (
                <textarea className="form-input" style={{ minHeight: 60, resize: "vertical" }} placeholder="管理者からのコメント" value={report.manager_note} onChange={(e) => setReport({ ...report, manager_note: e.target.value })} />
              ) : (
                <div style={{ fontSize: 13, color: report.manager_note ? "#1e293b" : "#94a3b8", lineHeight: 1.7 }}>{report.manager_note || "—"}</div>
              )}
            </Section>
          )}

          {/* 署名欄 */}
          <div style={{ display: "flex", gap: 20, marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
            {["記録者", "確認者", "管理者"].map((label) => (
              <div key={label} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{label}</div>
                <div style={{ height: 40, borderBottom: "1px solid #cbd5e1" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===== 一覧画面 =====
  const facReports = reports
    .filter((r) => r.facility_id === session.selected_facility_id)
    .sort((a, b) => b.date > a.date ? 1 : -1);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>📓 業務日報</h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{fac?.name}</p>
        </div>
      </div>

      {/* 日付選択・新規作成 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>日付</label>
            <input className="form-input" type="date" style={{ width: "auto" }} value={selDate} onChange={(e) => setSelDate(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={createReport}>
            {facReports.find((r) => r.date === selDate) ? "📓 編集する" : "＋ 日報を作成"}
          </button>
        </div>
      </div>

      {/* 過去の日報一覧 */}
      {facReports.length > 0 ? (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>天気</th>
                <th>来所数</th>
                <th>状態</th>
                <th>記録者</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {facReports.map((r) => {
                const statusColor: Record<ReportStatus, string> = { "下書き": "#f59e0b", "確認中": "#3b82f6", "承認済": "#22c55e" };
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.date}</td>
                    <td>{r.weather}</td>
                    <td>{r.child_count}名</td>
                    <td>
                      <span className="badge" style={{ background: statusColor[r.status] + "22", color: statusColor[r.status] }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "#64748b" }}>{r.author}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-secondary" onClick={() => { setReport(r); setView("view"); }} style={{ padding: "4px 10px", fontSize: 11 }}>閲覧</button>
                        <button className="btn-secondary" onClick={() => { setReport(r); setView("edit"); }} style={{ padding: "4px 10px", fontSize: 11 }}>編集</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📓</div>
          日報がまだありません。上のボタンから作成してください。
        </div>
      )}
    </div>
  );
}

// 共通コンポーネント
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#0077b6", marginBottom: 10, paddingBottom: 6, borderBottom: "1.5px solid #dbeafe" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{value}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#64748b", fontSize: 11, borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #e2e8f0", verticalAlign: "middle" };
