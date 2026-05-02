"use client";
// ==================== 予約管理 ====================
// 日付別に来所予定を管理（定期利用 + スポット利用 + 欠席）

import { useState, useEffect, useCallback } from "react";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { supabase, normalizeChild, isSupabaseReady } from "@/lib/supabase";
import type { Child } from "@/types";
import { useSession } from "@/hooks/useSession";
import { todayISO, DOW } from "@/lib/utils";

type ReservationType = "spot" | "cancel";

type Reservation = {
  id: string;
  org_id: string;
  facility_id: string;
  child_id: string;
  child_name: string;
  date: string;
  type: ReservationType;
  notes: string | null;
  arrive_time?: string | null;
  depart_time?: string | null;
  created_at: string;
};

function getDow(dateStr: string): string {
  return DOW[new Date(dateStr + "T00:00:00").getDay()];
}

export default function ReservationsPage() {
  const session = useSession();
  const [selDate, setSelDate] = useState(todayISO());
  const [children, setChildren] = useState<Child[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [spotModal, setSpotModal] = useState(false);
  const [spotChildId, setSpotChildId] = useState("");
  const [spotNotes, setSpotNotes] = useState("");
  const [spotArriveTime, setSpotArriveTime] = useState("");
  const [spotDepartTime, setSpotDepartTime] = useState("");
  const [dbError, setDbError] = useState(false);

  // 月間一括登録用 state
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkChildId, setBulkChildId] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkArriveTime, setBulkArriveTime] = useState("");
  const [bulkDepartTime, setBulkDepartTime] = useState("");
  const [bulkYear, setBulkYear] = useState(() => new Date().getFullYear());
  const [bulkMonth, setBulkMonth] = useState(() => new Date().getMonth() + 1);
  const [bulkDays, setBulkDays] = useState<Set<number>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);

  // 児童一覧を読み込む
  useEffect(() => {
    if (!session) return;
    const load = async () => {
      if (!isSupabaseReady) {
        setChildren(
          DUMMY_CHILDREN.filter(
            (c) => c.active !== false && (session.role === "admin" || c.facility_id === session.selected_facility_id)
          ).map(normalizeChild)
        );
        return;
      }
      try {
        const { data, error } = await supabase
          .from("ng_children")
          .select("*")
          .eq("org_id", session.org_id)
          .eq("active", true)
          .order("name");
        if (error || !data || data.length === 0) {
          setChildren(
            DUMMY_CHILDREN.filter(
              (c) => c.active !== false && (session.role === "admin" || c.facility_id === session.selected_facility_id)
            ).map(normalizeChild)
          );
        } else {
          setChildren(
            (data as Child[]).map(normalizeChild).filter(
              (c) => session.role === "admin" || c.facility_id === session.selected_facility_id
            )
          );
        }
      } catch {
        setChildren(
          DUMMY_CHILDREN.filter(
            (c) => c.active !== false && (session.role === "admin" || c.facility_id === session.selected_facility_id)
          ).map(normalizeChild)
        );
      }
    };
    load();
  }, [session]);

  // 施設の全予約を一括読み込み（日付フィルタは表示側で行う）
  const loadReservations = useCallback(async () => {
    if (!session) return;
    // Supabase未設定時はローカル状態をそのまま使う
    if (!isSupabaseReady) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ng_reservations")
        .select("*")
        .eq("org_id", session.org_id)
        .eq("facility_id", session.selected_facility_id);

      if (error) {
        if (error.code === "PGRST205" || error.message.includes("ng_reservations")) {
          setDbError(true);
        }
        setLoading(false);
        return;
      }
      setReservations((data as Reservation[]) ?? []);
    } catch {
      // ネットワークエラーは無視してローカル状態を保持
    }
    setLoading(false);
  }, [session]); // selDateに依存しない→日付変更で再fetchしない

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  if (!session) return null;

  const dow = getDow(selDate);
  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);

  // 定期利用児童（use_daysに当日の曜日が含まれる）
  const regularChildren = children.filter((c) => (c.use_days ?? []).includes(dow));

  // 選択日の予約のみ抽出
  const todayReservations = reservations.filter((r) => r.date === selDate);

  // その日の欠席登録済みID
  const cancelledIds = new Set(todayReservations.filter((r) => r.type === "cancel").map((r) => r.child_id));

  // スポット利用登録済みID
  const spotIds = new Set(todayReservations.filter((r) => r.type === "spot").map((r) => r.child_id));

  // 実際の来所予定（定期 - 欠席 + スポット）
  const regularActive = regularChildren.filter((c) => !cancelledIds.has(c.id));
  const spotChildren = children.filter((c) => spotIds.has(c.id) && !regularChildren.find((r) => r.id === c.id));
  const totalCount = regularActive.length + spotChildren.length;

  // スポット追加できる児童（定期利用でなく、まだスポット登録されていない）
  const spotCandidates = children.filter((c) => !regularChildren.find((r) => r.id === c.id) && !spotIds.has(c.id));

  // 予約をローカル状態に直接反映するヘルパー
  const localUpsert = (res: Reservation) =>
    setReservations((prev) => [...prev.filter((r) => r.id !== res.id), res]);
  const localDelete = (id: string) =>
    setReservations((prev) => prev.filter((r) => r.id !== id));

  // 欠席登録/解除
  const toggleCancel = async (child: Child) => {
    if (!session) return;
    setSaving(child.id);
    const existing = reservations.find((r) => r.child_id === child.id && r.type === "cancel");
    const resId = `${child.id}_${selDate}_cancel`;
    if (existing) {
      localDelete(resId);
      if (isSupabaseReady) {
        try { await supabase.from("ng_reservations").delete().eq("id", resId); } catch {}
      }
    } else {
      const newRes: Reservation = {
        id: resId,
        org_id: session.org_id,
        facility_id: session.selected_facility_id,
        child_id: child.id,
        child_name: child.name,
        date: selDate,
        type: "cancel",
        notes: null,
        created_at: new Date().toISOString(),
      };
      localUpsert(newRes);
      if (isSupabaseReady) {
        try { await supabase.from("ng_reservations").upsert(newRes); } catch {}
      }
    }
    setSaving(null);
  };

  // スポット利用登録
  const addSpot = async () => {
    if (!session || !spotChildId) return;
    setSaving("spot");
    const child = children.find((c) => c.id === spotChildId);
    if (!child) { setSaving(null); return; }
    const newRes: Reservation = {
      id: `${child.id}_${selDate}_spot`,
      org_id: session.org_id,
      facility_id: session.selected_facility_id,
      child_id: child.id,
      child_name: child.name,
      date: selDate,
      type: "spot",
      notes: spotNotes || null,
      arrive_time: spotArriveTime || null,
      depart_time: spotDepartTime || null,
      created_at: new Date().toISOString(),
    };
    localUpsert(newRes);
    if (isSupabaseReady) {
      try { await supabase.from("ng_reservations").upsert(newRes); } catch {}
    }
    setSpotModal(false);
    setSpotChildId("");
    setSpotNotes("");
    setSpotArriveTime("");
    setSpotDepartTime("");
    setSaving(null);
  };

  // 月間一括スポット登録
  const saveBulk = async () => {
    if (!session || !bulkChildId || bulkDays.size === 0) return;
    setBulkSaving(true);
    const child = children.find((c) => c.id === bulkChildId);
    if (!child) { setBulkSaving(false); return; }
    const newReservations: Reservation[] = [];
    for (const day of Array.from(bulkDays).sort()) {
      const mm = String(bulkMonth).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const date = `${bulkYear}-${mm}-${dd}`;
      const newRes: Reservation = {
        id: `${child.id}_${date}_spot`,
        org_id: session.org_id,
        facility_id: session.selected_facility_id,
        child_id: child.id,
        child_name: child.name,
        date,
        type: "spot",
        notes: bulkNotes || null,
        arrive_time: bulkArriveTime || null,
        depart_time: bulkDepartTime || null,
        created_at: new Date().toISOString(),
      };
      newReservations.push(newRes);
    }
    // 全日付分をローカルstateに反映（日付変更時も即表示）
    for (const res of newReservations) localUpsert(res);
    if (isSupabaseReady) {
      try { await supabase.from("ng_reservations").upsert(newReservations); } catch {}
    }
    setBulkSaving(false);
    setBulkDone(true);
    setTimeout(() => {
      setBulkModal(false);
      setBulkChildId("");
      setBulkNotes("");
      setBulkDays(new Set());
      setBulkDone(false);
    }, 1500);
  };

  // スポット削除
  const removeSpot = async (child: Child) => {
    if (!session) return;
    setSaving(child.id);
    const resId = `${child.id}_${selDate}_spot`;
    localDelete(resId);
    if (isSupabaseReady) {
      try { await supabase.from("ng_reservations").delete().eq("id", resId); } catch {}
    }
    setSaving(null);
  };

  // DB未作成エラー
  if (dbError) {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", marginBottom: 8 }}>📅 予約管理</h1>
        <div className="card" style={{ padding: 24, borderLeft: "4px solid #f59e0b" }}>
          <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 12 }}>⚠️ データベースの初期設定が必要です</div>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
            Supabaseダッシュボードの「SQL Editor」で以下のSQLを実行してください：
          </p>
          <pre style={{
            background: "#0a2540", color: "#e2e8f0", padding: 16, borderRadius: 8,
            fontSize: 11, overflow: "auto", lineHeight: 1.6,
          }}>
{`CREATE TABLE IF NOT EXISTS ng_reservations (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  facility_id text NOT NULL,
  child_id text NOT NULL,
  child_name text NOT NULL,
  date text NOT NULL,
  type text NOT NULL DEFAULT 'spot',
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ng_reservations_idx
  ON ng_reservations(org_id, facility_id, date);
ALTER TABLE ng_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON ng_reservations FOR ALL USING (true);`}
          </pre>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => { setDbError(false); loadReservations(); }}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>📅 予約管理</h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{fac?.name}</p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => { setBulkYear(new Date().getFullYear()); setBulkMonth(new Date().getMonth() + 1); setBulkDays(new Set()); setBulkModal(true); }}
          style={{ fontSize: 13, padding: "8px 14px", whiteSpace: "nowrap" }}
        >
          📆 月間一括登録
        </button>
      </div>

      {/* 日付選択 */}
      <div className="card" style={{ padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input
          type="date"
          className="form-input"
          value={selDate}
          onChange={(e) => setSelDate(e.target.value)}
          style={{ width: "auto", flex: "0 0 auto" }}
        />
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0a2540" }}>
          {selDate.replace(/-/g, "/")}（{dow}）
        </div>
        <button className="btn-secondary" onClick={() => setSelDate(todayISO())} style={{ padding: "6px 14px", fontSize: 12 }}>
          今日
        </button>
        <div style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#0077b6" }}>
          来所予定：<span style={{ fontSize: 20 }}>{loading ? "…" : totalCount}</span>名
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><span className="spinner" /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ① 定期利用 */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0a2540" }}>
                📋 定期利用（{dow}曜日）
                <span style={{ fontWeight: 400, fontSize: 12, color: "#64748b", marginLeft: 8 }}>{regularChildren.length}名登録</span>
              </div>
            </div>
            {regularChildren.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                {dow}曜日に定期利用の児童はいません
              </div>
            ) : (
              <div>
                {regularChildren.map((child) => {
                  const cancelled = cancelledIds.has(child.id);
                  return (
                    <div key={child.id} style={{
                      display: "flex", alignItems: "center", padding: "12px 16px",
                      borderBottom: "1px solid #f1f5f9",
                      background: cancelled ? "#fef2f2" : "white",
                      opacity: cancelled ? 0.8 : 1,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0, marginRight: 12,
                        background: cancelled ? "#e2e8f0" : (child.gender === "女" ? "linear-gradient(135deg,#db2777,#f472b6)" : "linear-gradient(135deg,#0077b6,#00b4d8)"),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", fontWeight: 800, fontSize: 14,
                      }}>
                        {child.name.slice(0, 1)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: cancelled ? "#94a3b8" : "#0a2540", textDecoration: cancelled ? "line-through" : "none" }}>
                          {child.name}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{child.grade}</div>
                      </div>
                      {child.has_transport && !cancelled && (
                        <span className="badge badge-blue" style={{ marginRight: 8 }}>🚌 送迎</span>
                      )}
                      {cancelled ? (
                        <span className="badge badge-red" style={{ marginRight: 8 }}>欠席</span>
                      ) : null}
                      <button
                        onClick={() => toggleCancel(child)}
                        disabled={saving === child.id}
                        style={{
                          padding: "6px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                          background: cancelled ? "#dcfce7" : "#fee2e2",
                          border: `1.5px solid ${cancelled ? "#86efac" : "#fca5a5"}`,
                          color: cancelled ? "#166534" : "#991b1b",
                        }}
                      >
                        {saving === child.id ? "…" : cancelled ? "欠席解除" : "欠席登録"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ② スポット利用 */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0a2540" }}>
                ➕ スポット利用
                <span style={{ fontWeight: 400, fontSize: 12, color: "#64748b", marginLeft: 8 }}>{spotChildren.length}名</span>
              </div>
              <button
                className="btn-primary"
                onClick={() => setSpotModal(true)}
                disabled={spotCandidates.length === 0}
                style={{ padding: "6px 14px", fontSize: 12 }}
              >
                ＋ 追加
              </button>
            </div>
            {spotChildren.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                スポット利用の予約はありません
              </div>
            ) : (
              <div>
                {spotChildren.map((child) => {
                  const res = todayReservations.find((r) => r.child_id === child.id && r.type === "spot");
                  return (
                    <div key={child.id} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0, marginRight: 12,
                        background: child.gender === "女" ? "linear-gradient(135deg,#db2777,#f472b6)" : "linear-gradient(135deg,#0077b6,#00b4d8)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", fontWeight: 800, fontSize: 14,
                      }}>
                        {child.name.slice(0, 1)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#0a2540" }}>{child.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {child.grade}
                          {res?.notes && <span style={{ marginLeft: 8, color: "#94a3b8" }}>📝 {res.notes}</span>}
                        </div>
                      </div>
                      <span className="badge badge-yellow" style={{ marginRight: 8 }}>スポット</span>
                      <button
                        onClick={() => removeSpot(child)}
                        disabled={saving === child.id}
                        style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, background: "#fee2e2", border: "1.5px solid #fca5a5", color: "#991b1b" }}
                      >
                        {saving === child.id ? "…" : "取消"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 月間一括登録モーダル */}
      {bulkModal && (() => {
        const daysInMonth = new Date(bulkYear, bulkMonth, 0).getDate();
        const firstDow = new Date(bulkYear, bulkMonth - 1, 1).getDay(); // 0=日
        const DOW_LABELS = ["日","月","火","水","木","金","土"];
        const toggleDay = (d: number) => setBulkDays((prev) => {
          const next = new Set(prev);
          next.has(d) ? next.delete(d) : next.add(d);
          return next;
        });
        const prevMonth = () => { if (bulkMonth === 1) { setBulkYear(y => y - 1); setBulkMonth(12); } else setBulkMonth(m => m - 1); setBulkDays(new Set()); };
        const nextMonth = () => { if (bulkMonth === 12) { setBulkYear(y => y + 1); setBulkMonth(1); } else setBulkMonth(m => m + 1); setBulkDays(new Set()); };
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={() => setBulkModal(false)}>
            <div className="card" style={{ padding: 20, maxWidth: 440, width: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0a2540", marginBottom: 16 }}>📆 月間スポット一括登録</div>

              {/* 児童選択 */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>児童を選択 *</label>
                <select className="form-input" value={bulkChildId} onChange={(e) => setBulkChildId(e.target.value)}>
                  <option value="">選択してください</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}（{c.grade}）</option>
                  ))}
                </select>
              </div>

              {/* 時間 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>来所時間（任意）</label>
                  <input className="form-input" type="time" value={bulkArriveTime} onChange={(e) => setBulkArriveTime(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>退所時間（任意）</label>
                  <input className="form-input" type="time" value={bulkDepartTime} onChange={(e) => setBulkDepartTime(e.target.value)} />
                </div>
              </div>
              {/* メモ */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>メモ（任意）</label>
                <input className="form-input" placeholder="例: 夏休み期間" value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} />
              </div>

              {/* 月ナビ */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <button onClick={prevMonth} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>‹</button>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#0a2540" }}>{bulkYear}年{bulkMonth}月</span>
                <button onClick={nextMonth} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>›</button>
              </div>

              {/* カレンダー */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 8 }}>
                {DOW_LABELS.map((d, i) => (
                  <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, padding: "3px 0", color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : "#64748b" }}>{d}</div>
                ))}
                {Array(firstDow).fill(null).map((_, i) => <div key={`b${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                  const dow = new Date(bulkYear, bulkMonth - 1, d).getDay();
                  const selected = bulkDays.has(d);
                  const isSun = dow === 0;
                  const isSat = dow === 6;
                  return (
                    <div key={d} onClick={() => toggleDay(d)} style={{
                      textAlign: "center", padding: "6px 2px", borderRadius: 6, cursor: "pointer",
                      fontSize: 13, fontWeight: selected ? 800 : 500,
                      background: selected ? "#0077b6" : isSun ? "#fff0f0" : isSat ? "#f0f4ff" : "#f8fafc",
                      color: selected ? "white" : isSun ? "#ef4444" : isSat ? "#3b82f6" : "#1e293b",
                      border: selected ? "2px solid #005a8e" : "1px solid #e2e8f0",
                      userSelect: "none",
                    }}>{d}</div>
                  );
                })}
              </div>

              {/* 選択状況 */}
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, minHeight: 20 }}>
                {bulkDays.size > 0
                  ? `✓ ${bulkDays.size}日選択中： ${Array.from(bulkDays).sort((a,b)=>a-b).map(d=>`${bulkMonth}/${d}`).join("、")}`
                  : "日付をタップして選択してください"}
              </div>

              {bulkDone && (
                <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#166534", marginBottom: 12, fontWeight: 600 }}>
                  ✓ {bulkDays.size}件登録しました
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-primary" onClick={saveBulk}
                  disabled={!bulkChildId || bulkDays.size === 0 || bulkSaving || bulkDone}
                  style={{ flex: 1 }}>
                  {bulkSaving ? "登録中…" : `${bulkDays.size}日分を登録する`}
                </button>
                <button className="btn-secondary" onClick={() => setBulkModal(false)}>閉じる</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* スポット追加モーダル */}
      {spotModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSpotModal(false)}>
          <div className="card" style={{ padding: 24, maxWidth: 400, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0a2540", marginBottom: 16 }}>➕ スポット利用を追加</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>児童を選択 *</label>
              <select className="form-input" value={spotChildId} onChange={(e) => setSpotChildId(e.target.value)}>
                <option value="">選択してください</option>
                {spotCandidates.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}（{c.grade}）</option>
                ))}
              </select>
            </div>
            {/* 時間入力 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>来所時間（任意）</label>
                <input className="form-input" type="time" value={spotArriveTime} onChange={(e) => setSpotArriveTime(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>退所時間（任意）</label>
                <input className="form-input" type="time" value={spotDepartTime} onChange={(e) => setSpotDepartTime(e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>メモ（任意）</label>
              <input className="form-input" placeholder="例: 振替、長期休暇中など" value={spotNotes} onChange={(e) => setSpotNotes(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={addSpot} disabled={!spotChildId || saving === "spot"} style={{ flex: 1 }}>
                {saving === "spot" ? "登録中…" : "登録する"}
              </button>
              <button className="btn-secondary" onClick={() => setSpotModal(false)}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
