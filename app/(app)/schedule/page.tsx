"use client";
// ==================== 生徒予定表 ====================
// 月間カレンダーで各日の来所予定児童を確認する画面

import { useState } from "react";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import type { UserSession, Child } from "@/types";
import { useSession } from "@/hooks/useSession";
import { DOW as DOW_JP } from "@/lib/utils";

// YYYY-MM の月全日を生成
function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=日
  const daysInMonth = new Date(year, month, 0).getDate();
  return { firstDay, daysInMonth };
}

// use_days の曜日に一致するか判定
function scheduledOnDate(child: Child, date: Date): boolean {
  const dow = DOW_JP[date.getDay()];
  return (child.use_days ?? []).includes(dow);
}

export default function SchedulePage() {
  const session = useSession();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selDay, setSelDay] = useState<number | null>(today.getDate());

  if (!session) return null;

  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);
  const children = DUMMY_CHILDREN.filter(
    (c) => c.active && c.facility_id === session.selected_facility_id
  );

  const { firstDay, daysInMonth } = buildCalendar(year, month);

  // 前月の末尾を埋めるための空白マス
  const blanks = Array(firstDay).fill(null);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelDay(null);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelDay(null);
  };

  // 選択日の来所予定児童
  const selDate = selDay ? new Date(year, month - 1, selDay) : null;
  const selChildren = selDate ? children.filter((c) => scheduledOnDate(c, selDate)) : [];

  // 日ごとの来所人数マップ
  const countMap: Record<number, number> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    countMap[d] = children.filter((c) => scheduledOnDate(c, date)).length;
  }

  const isToday = (d: number) =>
    year === today.getFullYear() && month === today.getMonth() + 1 && d === today.getDate();

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>
            📅 生徒予定表
          </h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
            {fac?.name} ／ {year}年{month}月
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn-secondary" onClick={prevMonth} style={{ padding: "6px 14px" }}>‹ 前月</button>
          <button className="btn-secondary" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); setSelDay(today.getDate()); }} style={{ padding: "6px 14px" }}>今月</button>
          <button className="btn-secondary" onClick={nextMonth} style={{ padding: "6px 14px" }}>翌月 ›</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* カレンダー */}
        <div className="card" style={{ flex: "1 1 320px", padding: 16, minWidth: 300 }}>
          {/* 曜日ヘッダー */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {DOW_JP.map((d, i) => (
              <div key={d} style={{
                textAlign: "center", fontSize: 11, fontWeight: 700, padding: "4px 0",
                color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : "#64748b",
              }}>{d}</div>
            ))}
          </div>

          {/* 日マス */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {blanks.map((_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
              const dow = new Date(year, month - 1, d).getDay();
              const count = countMap[d] ?? 0;
              const isSel = d === selDay;
              const isT = isToday(d);
              return (
                <div key={d}
                  onClick={() => setSelDay(d)}
                  style={{
                    borderRadius: 6, padding: "6px 4px", cursor: "pointer", textAlign: "center",
                    background: isSel ? "#0077b6" : isT ? "#e0f2fe" : "white",
                    border: isT && !isSel ? "1.5px solid #0077b6" : "1px solid #e2e8f0",
                    transition: "all 0.1s",
                  }}>
                  <div style={{
                    fontSize: 13, fontWeight: isSel ? 800 : 600,
                    color: isSel ? "white" : dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "#1e293b",
                  }}>{d}</div>
                  {count > 0 && (
                    <div style={{
                      fontSize: 10, fontWeight: 700, marginTop: 2,
                      color: isSel ? "rgba(255,255,255,0.85)" : "#0077b6",
                    }}>{count}名</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 選択日の詳細 */}
        <div className="card" style={{ flex: "1 1 240px", padding: 16 }}>
          {selDay && selDate ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: "#0a2540" }}>
                {month}/{selDay}（{DOW_JP[selDate.getDay()]}）来所予定
              </div>
              {selChildren.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                  来所予定はありません
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selChildren.map((child) => (
                    <div key={child.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f8fafc", borderRadius: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#0077b6,#00b4d8)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                        {child.name.slice(0, 1)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{child.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {child.grade} {child.has_transport ? "🚌送迎" : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, textAlign: "right" }}>
                    計 {selChildren.length}名
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: "#94a3b8", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
              日付を選択してください
            </div>
          )}
        </div>
      </div>

      {/* 凡例 */}
      <div style={{ marginTop: 16, fontSize: 12, color: "#64748b", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>※ 曜日利用設定に基づく予定表です</span>
        <span>🔵 今日 &nbsp; 🟦 選択中</span>
      </div>
    </div>
  );
}
