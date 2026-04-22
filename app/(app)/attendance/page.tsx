"use client";
// ==================== 入退室記録 ====================

import { useState, useEffect } from "react";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { saveRecord } from "@/lib/supabase";
import type { UserSession, AttendanceRecord } from "@/types";

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function todayISO() {
  return new Date().toISOString().slice(0,10);
}
function getTodayDow() {
  return ["日","月","火","水","木","金","土"][new Date().getDay()];
}

export default function AttendancePage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [records, setRecords] = useState<Record<string, { arrive?: string; depart?: string; temp?: string }>>({});
  const [selChild, setSelChild] = useState<string | null>(null);
  const [inputTemp, setInputTemp] = useState("");
  const [inputTime, setInputTime] = useState(nowHHMM());

  useEffect(() => {
    const raw = localStorage.getItem("gg_session");
    if (raw) setSession(JSON.parse(raw));
  }, []);

  if (!session) return null;

  const todayDow = getTodayDow();
  const todayChildren = DUMMY_CHILDREN.filter(
    (c) =>
      c.active &&
      c.facility_id === session.selected_facility_id &&
      (c.use_days ?? []).includes(todayDow)
  );
  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);

  const handleArrive = (childId: string) => {
    const child = DUMMY_CHILDREN.find((c) => c.id === childId);
    const rec: AttendanceRecord = {
      id: `${childId}_${todayISO()}`,
      org_id: session!.org_id,
      facility_id: session!.selected_facility_id,
      child_id: childId,
      child_name: child?.name ?? "",
      date: todayISO(),
      arrive_time: inputTime,
      temperature: inputTemp || undefined,
      transport_to: child?.has_transport ?? false,
      status: "来所",
      recorded_by: session!.name,
      created_at: new Date().toISOString(),
    };
    // Supabaseに保存
    saveRecord("ng_attendance", rec as unknown as Record<string, unknown>);
    setRecords((prev) => ({
      ...prev,
      [childId]: { ...prev[childId], arrive: inputTime, temp: inputTemp || "—" },
    }));
    setSelChild(null);
    setInputTemp("");
    setInputTime(nowHHMM());
  };

  const handleDepart = (childId: string) => {
    const child = DUMMY_CHILDREN.find((c) => c.id === childId);
    const rec: Partial<AttendanceRecord> = {
      id: `${childId}_${todayISO()}`,
      org_id: session!.org_id,
      facility_id: session!.selected_facility_id,
      child_id: childId,
      child_name: child?.name ?? "",
      date: todayISO(),
      depart_time: inputTime,
      status: "来所",
    };
    saveRecord("ng_attendance", rec as unknown as Record<string, unknown>);
    setRecords((prev) => ({
      ...prev,
      [childId]: { ...prev[childId], depart: inputTime },
    }));
    setSelChild(null);
    setInputTime(nowHHMM());
  };

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>
          📋 入退室記録
        </h1>
        <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
          {fac?.name} ／ {todayISO()} ({todayDow}曜) ／ {todayChildren.length}名来所予定
        </p>
      </div>

      {/* 入力パネル（選択中） */}
      {selChild && (() => {
        const child = DUMMY_CHILDREN.find((c) => c.id === selChild)!;
        const rec = records[selChild] ?? {};
        return (
          <div
            className="card"
            style={{
              padding: 20,
              marginBottom: 16,
              border: "2px solid #0077b6",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
              📌 {child.name} の記録
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ flex: "1 1 140px" }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                  時刻
                </label>
                <input
                  className="form-input"
                  type="time"
                  value={inputTime}
                  onChange={(e) => setInputTime(e.target.value)}
                />
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                  体温 (℃)
                </label>
                <input
                  className="form-input"
                  type="number"
                  step="0.1"
                  placeholder="36.5"
                  value={inputTemp}
                  onChange={(e) => setInputTemp(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {!rec.arrive && (
                <button className="btn-primary" onClick={() => handleArrive(selChild)}>
                  🟢 来所記録
                </button>
              )}
              {rec.arrive && !rec.depart && (
                <button
                  className="btn-primary"
                  onClick={() => handleDepart(selChild)}
                  style={{ background: "#059669" }}
                >
                  🏠 退所記録
                </button>
              )}
              <button className="btn-secondary" onClick={() => setSelChild(null)}>
                キャンセル
              </button>
            </div>
          </div>
        );
      })()}

      {/* 児童リスト */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>児童名</th>
              <th>体温</th>
              <th>来所時刻</th>
              <th>退所時刻</th>
              <th>送迎</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {todayChildren.map((child) => {
              const rec = records[child.id] ?? {};
              const status = rec.depart ? "退所済" : rec.arrive ? "来所中" : "未来所";
              const statusColor = rec.depart ? "#94a3b8" : rec.arrive ? "#059669" : "#f59e0b";

              return (
                <tr key={child.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg,#0077b6,#00b4d8)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: 12,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {child.name.slice(0, 1)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{child.name}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{child.grade}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{rec.temp ?? "—"}</td>
                  <td style={{ fontSize: 13, fontWeight: rec.arrive ? 700 : 400, color: rec.arrive ? "#059669" : "#94a3b8" }}>
                    {rec.arrive ?? "—"}
                  </td>
                  <td style={{ fontSize: 13, fontWeight: rec.depart ? 700 : 400, color: rec.depart ? "#0077b6" : "#94a3b8" }}>
                    {rec.depart ?? "—"}
                  </td>
                  <td>
                    {child.has_transport ? (
                      <span className="badge badge-blue">🚌</span>
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td>
                    {rec.depart ? (
                      <span className="badge badge-gray">完了</span>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={() => {
                          setSelChild(child.id);
                          setInputTime(nowHHMM());
                          setInputTemp("");
                        }}
                        style={{
                          padding: "5px 12px",
                          fontSize: 12,
                          background: rec.arrive ? "#059669" : "#0077b6",
                        }}
                      >
                        {rec.arrive ? "退所" : "来所"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {todayChildren.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: 13 }}>
            本日（{todayDow}曜）の来所予定はありません
          </div>
        )}
      </div>
    </div>
  );
}
