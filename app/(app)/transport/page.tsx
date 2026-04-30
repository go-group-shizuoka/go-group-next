"use client";
// ==================== 送迎管理 ====================
// 本日の送迎対象児童の出発・到着ステータス管理（Supabase保存・読み込み対応）

import { useState, useEffect } from "react";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { saveRecord, fetchByDate, fetchChildren } from "@/lib/supabase";
import type { Child } from "@/types";
import { useSession } from "@/hooks/useSession";
import { todayISO, nowHHMM, DOW } from "@/lib/utils";

function getTodayDow() { return DOW[new Date().getDay()]; }

type TransportStatus = "待機中" | "出発" | "到着済" | "欠席";
type RouteType = "来所" | "帰所";

// Supabaseに保存するレコード型
type TransportDBRecord = {
  id: string;
  org_id: string;
  facility_id: string;
  child_id: string;
  child_name: string;
  date: string;
  route: RouteType;
  status: TransportStatus;
  time?: string;
  pickup_order?: number;
  recorded_by: string;
  created_at: string;
};

// ローカルステート型
type TransportRecord = {
  childId: string;
  route: RouteType;
  status: TransportStatus;
  time?: string;
  pickupOrder: number;
};

export default function TransportPage() {
  const session = useSession();
  const [route, setRoute] = useState<RouteType>("来所");
  const [records, setRecords] = useState<Record<string, TransportRecord>>({});
  const [selChild, setSelChild] = useState<string | null>(null);
  const [loadingDB, setLoadingDB] = useState(false);
  const [orderMode, setOrderMode] = useState(false);
  const [dbChildren, setDbChildren] = useState<Child[]>([]);

  // Supabaseから本日の送迎記録と児童リストを読み込む
  useEffect(() => {
    if (!session) return;
    setLoadingDB(true);
    Promise.all([
      fetchByDate<TransportDBRecord>("ng_transport", session.org_id, session.selected_facility_id, todayISO()),
      fetchChildren(session.org_id, session.selected_facility_id),
    ]).then(([rows, childrenRows]) => {
      const map: Record<string, TransportRecord> = {};
      for (const r of rows) {
        const key = `${r.child_id}_${r.route}`;
        map[key] = {
          childId: r.child_id,
          route: r.route,
          status: r.status,
          time: r.time,
          pickupOrder: r.pickup_order ?? 0,
        };
      }
      setRecords(map);
      if (childrenRows.length > 0) setDbChildren(childrenRows.filter((c) => c.active));
      setLoadingDB(false);
    });
  }, [session]);

  if (!session) return null;

  const todayDow = getTodayDow();
  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);

  const allChildren = dbChildren.length > 0
    ? dbChildren
    : DUMMY_CHILDREN.filter((c) => c.active && c.facility_id === session.selected_facility_id);
  // 本日の送迎対象児童
  const transportChildren = allChildren.filter(
    (c) => c.has_transport && (c.use_days ?? []).includes(todayDow)
  );

  const getRecord = (childId: string): TransportRecord => {
    const key = `${childId}_${route}`;
    return records[key] ?? { childId, route, status: "待機中", pickupOrder: 0 };
  };

  const updateStatus = async (childId: string, status: TransportStatus) => {
    const time = (status === "出発" || status === "到着済") ? nowHHMM() : undefined;
    const key = `${childId}_${route}`;
    const existing = records[key];
    const newRec: TransportRecord = {
      childId,
      route,
      status,
      time,
      pickupOrder: existing?.pickupOrder ?? 0,
    };
    setRecords((prev) => ({ ...prev, [key]: newRec }));

    // Supabaseに保存
    const child = allChildren.find((c) => c.id === childId);
    await saveRecord("ng_transport", {
      id: `${childId}_${todayISO()}_${route}`,
      org_id: session.org_id,
      facility_id: session.selected_facility_id,
      child_id: childId,
      child_name: child?.name ?? "",
      date: todayISO(),
      route,
      status,
      time,
      pickup_order: newRec.pickupOrder,
      recorded_by: session.name,
      created_at: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
    setSelChild(null);
  };

  // 順番を設定
  const setPickupOrder = async (childId: string, order: number) => {
    const key = `${childId}_${route}`;
    const existing = records[key];
    const newRec: TransportRecord = { ...(existing ?? { childId, route, status: "待機中", pickupOrder: 0 }), pickupOrder: order };
    setRecords((prev) => ({ ...prev, [key]: newRec }));

    const child = allChildren.find((c) => c.id === childId);
    await saveRecord("ng_transport", {
      id: `${childId}_${todayISO()}_${route}`,
      org_id: session.org_id,
      facility_id: session.selected_facility_id,
      child_id: childId,
      child_name: child?.name ?? "",
      date: todayISO(),
      route,
      status: newRec.status,
      time: newRec.time,
      pickup_order: order,
      recorded_by: session.name,
      created_at: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
  };

  const statusColor: Record<TransportStatus, string> = {
    "待機中": "#f59e0b", "出発": "#3b82f6", "到着済": "#059669", "欠席": "#94a3b8",
  };
  const statusBg: Record<TransportStatus, string> = {
    "待機中": "#fef9c3", "出発": "#dbeafe", "到着済": "#dcfce7", "欠席": "#f1f5f9",
  };

  const summary = {
    waiting:  transportChildren.filter((c) => getRecord(c.id).status === "待機中").length,
    departed: transportChildren.filter((c) => getRecord(c.id).status === "出発").length,
    arrived:  transportChildren.filter((c) => getRecord(c.id).status === "到着済").length,
    absent:   transportChildren.filter((c) => getRecord(c.id).status === "欠席").length,
  };

  // 順番でソート
  const sortedChildren = [...transportChildren].sort((a, b) => {
    const oa = getRecord(a.id).pickupOrder || 999;
    const ob = getRecord(b.id).pickupOrder || 999;
    return oa - ob;
  });

  if (loadingDB) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <span className="spinner" />
    </div>
  );

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>🚌 送迎管理</h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
            {fac?.name} ／ {todayISO()}（{todayDow}曜）／ 送迎対象 {transportChildren.length}名
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* 順番設定トグル */}
          <button
            className={orderMode ? "btn-primary" : "btn-secondary"}
            onClick={() => { setOrderMode(!orderMode); setSelChild(null); }}
            style={{ padding: "7px 14px", fontSize: 12 }}>
            {orderMode ? "✓ 順番設定中" : "🔢 順番を設定"}
          </button>
          {/* 来所/帰所 切替 */}
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3 }}>
            {(["来所", "帰所"] as RouteType[]).map((r) => (
              <button key={r}
                onClick={() => { setRoute(r); setSelChild(null); setOrderMode(false); }}
                style={{ padding: "7px 22px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit", transition: "all 0.15s", background: route === r ? "#0077b6" : "transparent", color: route === r ? "white" : "#64748b" }}>
                {r === "来所" ? "🏫 来所" : "🏠 帰所"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* サマリーカード */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "待機中", val: summary.waiting,  color: "#f59e0b", bg: "#fef9c3" },
          { label: "出発済", val: summary.departed, color: "#3b82f6", bg: "#dbeafe" },
          { label: "到着済", val: summary.arrived,  color: "#059669", bg: "#dcfce7" },
          { label: "欠席",   val: summary.absent,   color: "#94a3b8", bg: "#f1f5f9" },
        ].map((item) => (
          <div key={item.label} className="card" style={{ padding: "12px", textAlign: "center", background: item.bg, border: "none" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.val}</div>
            <div style={{ fontSize: 11, color: item.color, fontWeight: 600 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* 操作パネル（選択中の場合） */}
      {selChild && !orderMode && (() => {
        const child = allChildren.find((c) => c.id === selChild)!;
        const rec = getRecord(selChild);
        return (
          <div className="card" style={{ padding: 20, marginBottom: 16, border: "2px solid #0077b6" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
              🚌 {child.name} の{route}送迎
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {route === "来所" ? (
                <>
                  <button className="btn-primary" onClick={() => updateStatus(selChild, "出発")} disabled={rec.status === "到着済"} style={{ background: "#3b82f6" }}>🚌 出発</button>
                  <button className="btn-primary" onClick={() => updateStatus(selChild, "到着済")} style={{ background: "#059669" }}>✅ 到着</button>
                </>
              ) : (
                <>
                  <button className="btn-primary" onClick={() => updateStatus(selChild, "出発")} disabled={rec.status === "到着済"} style={{ background: "#3b82f6" }}>🏠 出発</button>
                  <button className="btn-primary" onClick={() => updateStatus(selChild, "到着済")} style={{ background: "#059669" }}>✅ 送届完了</button>
                </>
              )}
              <button className="btn-secondary" onClick={() => updateStatus(selChild, "欠席")} style={{ color: "#94a3b8" }}>欠席</button>
              <button className="btn-secondary" onClick={() => setSelChild(null)}>キャンセル</button>
            </div>
          </div>
        );
      })()}

      {/* 順番設定モード の説明 */}
      {orderMode && (
        <div style={{ background: "#dbeafe", borderRadius: 10, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#1d4ed8", fontWeight: 600 }}>
          🔢 各児童の送迎順番を入力してください。入力後は自動保存されます。
        </div>
      )}

      {/* 児童リスト */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {transportChildren.length === 0 ? (
          <div className="card" style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>
            本日（{todayDow}曜）の送迎対象がいません
          </div>
        ) : sortedChildren.map((child) => {
          const rec = getRecord(child.id);
          const sc = statusColor[rec.status];
          const sb = statusBg[rec.status];
          return (
            <div key={child.id} className="card"
              onClick={() => { if (!orderMode) setSelChild(selChild === child.id ? null : child.id); }}
              style={{ padding: "14px 16px", cursor: orderMode ? "default" : "pointer", borderLeft: `4px solid ${sc}`, transition: "box-shadow 0.15s" }}
              onMouseEnter={(e) => { if (!orderMode) e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)")}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* 順番番号 */}
                {orderMode ? (
                  <input
                    type="number"
                    min={1}
                    max={99}
                    placeholder="順"
                    defaultValue={rec.pickupOrder || ""}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v > 0) setPickupOrder(child.id, v);
                    }}
                    style={{ width: 52, textAlign: "center", border: "2px solid #0077b6", borderRadius: 8, padding: "6px", fontSize: 14, fontWeight: 700, color: "#0077b6", fontFamily: "inherit" }}
                  />
                ) : (
                  rec.pickupOrder > 0 && (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#0077b6", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                      {rec.pickupOrder}
                    </div>
                  )
                )}

                {/* アバター */}
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#0077b6,#00b4d8)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                  {child.name.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{child.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{child.grade}　{child.parent_name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700, background: sb, color: sc }}>
                    {rec.status}
                  </span>
                  {rec.time && (
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{rec.time}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
