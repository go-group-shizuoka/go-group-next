"use client";
// ==================== 予約管理 ====================
// 日付別に来所予定を管理（定期利用 + スポット利用 + 欠席）

import { useState, useEffect, useCallback } from "react";
import { DUMMY_FACILITIES } from "@/lib/dummy-data";
import { supabase, fetchChildren } from "@/lib/supabase";
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
  const [dbError, setDbError] = useState(false);

  // 児童一覧を読み込む
  useEffect(() => {
    if (!session) return;
    fetchChildren(session.org_id, session.selected_facility_id).then((rows) => {
      setChildren(rows.filter((c) => c.active));
    });
  }, [session]);

  // 選択日の予約を読み込む
  const loadReservations = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("ng_reservations")
      .select("*")
      .eq("org_id", session.org_id)
      .eq("facility_id", session.selected_facility_id)
      .eq("date", selDate);

    if (error) {
      if (error.code === "PGRST205" || error.message.includes("ng_reservations")) {
        setDbError(true);
      }
      setLoading(false);
      return;
    }
    setReservations((data as Reservation[]) ?? []);
    setLoading(false);
  }, [session, selDate]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  if (!session) return null;

  const dow = getDow(selDate);
  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);

  // 定期利用児童（use_daysに当日の曜日が含まれる）
  const regularChildren = children.filter((c) => (c.use_days ?? []).includes(dow));

  // その日の欠席登録済みID
  const cancelledIds = new Set(reservations.filter((r) => r.type === "cancel").map((r) => r.child_id));

  // スポット利用登録済みID
  const spotIds = new Set(reservations.filter((r) => r.type === "spot").map((r) => r.child_id));

  // 実際の来所予定（定期 - 欠席 + スポット）
  const regularActive = regularChildren.filter((c) => !cancelledIds.has(c.id));
  const spotChildren = children.filter((c) => spotIds.has(c.id) && !regularChildren.find((r) => r.id === c.id));
  const totalCount = regularActive.length + spotChildren.length;

  // スポット追加できる児童（定期利用でなく、まだスポット登録されていない）
  const spotCandidates = children.filter((c) => !regularChildren.find((r) => r.id === c.id) && !spotIds.has(c.id));

  // 欠席登録/解除
  const toggleCancel = async (child: Child) => {
    if (!session) return;
    setSaving(child.id);
    const existing = reservations.find((r) => r.child_id === child.id && r.type === "cancel");
    if (existing) {
      // 欠席解除
      await supabase.from("ng_reservations").delete().eq("id", existing.id);
    } else {
      // 欠席登録
      await supabase.from("ng_reservations").upsert({
        id: `${child.id}_${selDate}_cancel`,
        org_id: session.org_id,
        facility_id: session.selected_facility_id,
        child_id: child.id,
        child_name: child.name,
        date: selDate,
        type: "cancel",
        notes: null,
        created_at: new Date().toISOString(),
      });
    }
    await loadReservations();
    setSaving(null);
  };

  // スポット利用登録
  const addSpot = async () => {
    if (!session || !spotChildId) return;
    setSaving("spot");
    const child = children.find((c) => c.id === spotChildId);
    if (!child) return;
    await supabase.from("ng_reservations").upsert({
      id: `${child.id}_${selDate}_spot`,
      org_id: session.org_id,
      facility_id: session.selected_facility_id,
      child_id: child.id,
      child_name: child.name,
      date: selDate,
      type: "spot",
      notes: spotNotes || null,
      created_at: new Date().toISOString(),
    });
    setSpotModal(false);
    setSpotChildId("");
    setSpotNotes("");
    await loadReservations();
    setSaving(null);
  };

  // スポット削除
  const removeSpot = async (child: Child) => {
    if (!session) return;
    setSaving(child.id);
    await supabase.from("ng_reservations").delete().eq("id", `${child.id}_${selDate}_spot`);
    await loadReservations();
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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>📅 予約管理</h1>
        <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{fac?.name}</p>
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
                  const res = reservations.find((r) => r.child_id === child.id && r.type === "spot");
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
