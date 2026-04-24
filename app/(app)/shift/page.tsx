"use client";
// ==================== シフト管理 ====================
// 月間シフト表の表示・入力。Supabase保存・読み込み対応。

import { useState, useEffect, useCallback } from "react";
import { DUMMY_STAFF, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { saveRecord, fetchByFacility, fetchByFacilityWhere } from "@/lib/supabase";
import type { ShiftRecord, Staff } from "@/types";
import * as XLSX from "xlsx";
import { useSession } from "@/hooks/useSession";

const DOW_JP = ["日", "月", "火", "水", "木", "金", "土"];

const SHIFT_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  "A":  { label: "早番", color: "#0077b6", bg: "#e0f2fe" },
  "B":  { label: "遅番", color: "#059669", bg: "#dcfce7" },
  "C":  { label: "通常", color: "#6366f1", bg: "#ede9fe" },
  "休": { label: "休み", color: "#94a3b8", bg: "#f1f5f9" },
  "有": { label: "有休", color: "#f59e0b", bg: "#fef9c3" },
  "":   { label: "未設定", color: "#cbd5e1", bg: "white" },
};

type ShiftMap = Record<string, Record<number, string>>;

export default function ShiftPage() {
  const session = useSession();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [shifts, setShifts] = useState<ShiftMap>({});
  const [editCell, setEditCell] = useState<{ staffId: string; day: number } | null>(null);
  const [loadingDB, setLoadingDB] = useState(false);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  // DBから取得したスタッフデータ
  const [dbStaff, setDbStaff] = useState<Staff[]>([]);

  // Supabaseから当月のシフト＋スタッフを読み込む
  const loadShifts = useCallback(async () => {
    if (!session) return;
    setLoadingDB(true);

    const [rows, staffRows] = await Promise.all([
      // シフトデータ取得
      fetchByFacilityWhere<ShiftRecord>(
        "ng_shifts",
        session.org_id,
        session.selected_facility_id,
        { year, month }
      ),
      // スタッフデータ取得（ng_staffテーブル）
      fetchByFacility<Staff>(
        "ng_staff",
        session.org_id,
        session.selected_facility_id
      ),
    ]);

    // スタッフデータ反映（DBにあればDB優先）
    if (staffRows.length > 0) {
      setDbStaff(staffRows);
    }

    // ShiftMapに変換
    const map: ShiftMap = {};
    for (const r of rows) {
      if (!map[r.staff_id]) map[r.staff_id] = {};
      map[r.staff_id][r.day] = r.shift_type;
    }
    setShifts(map);
    setLoadingDB(false);
  }, [session, year, month]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  if (!session) return null;

  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);

  // DBにスタッフがあればDB優先、なければDUMMY_STAFFにフォールバック
  const staff = dbStaff.length > 0
    ? dbStaff
    : DUMMY_STAFF.filter((s) => s.facility_id === session.selected_facility_id);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getShift = (staffId: string, day: number) => shifts[staffId]?.[day] ?? "";

  // シフトを変更してSupabaseに保存
  const setShift = async (staffId: string, day: number, val: string) => {
    const cellKey = `${staffId}_${day}`;
    setSavingCell(cellKey);
    setShifts((prev) => ({ ...prev, [staffId]: { ...(prev[staffId] ?? {}), [day]: val } }));
    setEditCell(null);

    // staff配列からスタッフ名を取得
    const s = staff.find((x) => x.id === staffId);
    await saveRecord("ng_shifts", {
      id: `${staffId}_${year}_${String(month).padStart(2, "0")}_${String(day).padStart(2, "0")}`,
      org_id: session.org_id,
      facility_id: session.selected_facility_id,
      staff_id: staffId,
      staff_name: s?.name ?? "",
      year,
      month,
      day,
      shift_type: val,
      created_by: session.name,
      created_at: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
    setSavingCell(null);
  };

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  // 月間出勤日数（A/B/Cシフト）を集計
  const countWork = (staffId: string) =>
    days.filter((d) => { const s = getShift(staffId, d); return s === "A" || s === "B" || s === "C"; }).length;

  // 月間休日数（休）を集計
  const countOff = (staffId: string) =>
    days.filter((d) => getShift(staffId, d) === "休").length;

  // 月間有休日数を集計
  const countPaid = (staffId: string) =>
    days.filter((d) => getShift(staffId, d) === "有").length;

  // 日別出勤人数
  const countByDay = (day: number) =>
    staff.filter((s) => { const v = getShift(s.id, day); return v === "A" || v === "B" || v === "C"; }).length;

  // Excel出力：行=職員名 | 1日～月末日 | 出勤日数合計
  const exportShiftExcel = () => {
    const header = ["職員名", "役職", ...days.map((d) => `${d}日`), "出勤日数", "休日数", "有休日数"];
    const data = staff.map((s) => {
      const row: Record<string, string | number> = {
        "職員名": s.name,
        "役職": s.role === "manager" ? "管理者" : "職員",
      };
      days.forEach((d) => {
        row[`${d}日`] = getShift(s.id, d) || "－";
      });
      row["出勤日数"] = countWork(s.id);
      row["休日数"] = countOff(s.id);
      row["有休日数"] = countPaid(s.id);
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data, { header });
    // 列幅調整（職員名列を広く、日付列は狭く）
    ws["!cols"] = [
      { wch: 14 }, { wch: 8 },
      ...days.map(() => ({ wch: 5 })),
      { wch: 8 }, { wch: 8 }, { wch: 8 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `シフト表_${month}月`);
    XLSX.writeFile(wb, `シフト表_${fac?.name}_${year}年${month}月.xlsx`);
  };

  if (loadingDB) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <span className="spinner" />
    </div>
  );

  return (
    <div>
      {/* 印刷時にボタン類を非表示・テーブルをA4横向きに */}
      <style>{`
        @media print {
          .shift-no-print { display: none !important; }
          .shift-table-wrap { overflow: visible !important; }
          @page { size: A4 landscape; margin: 10mm; }
          body { font-size: 10px; }
        }
      `}</style>

      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>🗓️ シフト管理</h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{fac?.name} ／ {year}年{month}月</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} className="shift-no-print">
          {/* 月切替 */}
          <button className="btn-secondary" onClick={prevMonth} style={{ padding: "6px 14px" }}>‹ 前月</button>
          <button className="btn-secondary" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }} style={{ padding: "6px 14px" }}>今月</button>
          <button className="btn-secondary" onClick={nextMonth} style={{ padding: "6px 14px" }}>翌月 ›</button>
          {/* 印刷・Excel出力ボタン */}
          <button className="btn-secondary" onClick={() => window.print()} style={{ fontSize: 12 }}>
            🖨️ 印刷
          </button>
          <button className="btn-secondary" onClick={exportShiftExcel} style={{ fontSize: 12 }}>
            📊 Excel出力
          </button>
        </div>
      </div>

      {/* 凡例 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }} className="shift-no-print">
        {Object.entries(SHIFT_TYPES).filter(([k]) => k !== "").map(([key, val]) => (
          <span key={key} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: val.bg, color: val.color, fontWeight: 700, border: "1px solid " + val.color + "33" }}>
            {key}：{val.label}
          </span>
        ))}
        {savingCell && (
          <span style={{ fontSize: 11, color: "#0077b6", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            保存中...
          </span>
        )}
      </div>

      <div className="card shift-table-wrap" style={{ overflowX: "auto", padding: 0 }}>
        {staff.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>この施設の職員が登録されていません</div>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 600, fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: 700, color: "#64748b", width: 100, position: "sticky", left: 0, background: "#f8fafc", zIndex: 1 }}>
                  職員名
                </th>
                {days.map((d) => {
                  const dow = new Date(year, month - 1, d).getDay();
                  const isT = year === today.getFullYear() && month === today.getMonth() + 1 && d === today.getDate();
                  return (
                    <th key={d} style={{ padding: "6px 2px", textAlign: "center", borderBottom: "2px solid #e2e8f0", color: dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "#64748b", minWidth: 34, fontWeight: isT ? 800 : 600, background: isT ? "#e0f2fe" : "#f8fafc" }}>
                      <div>{d}</div>
                      <div style={{ fontSize: 9 }}>{DOW_JP[dow]}</div>
                    </th>
                  );
                })}
                {/* 月間集計列ヘッダー */}
                <th style={{ padding: "6px 6px", textAlign: "center", borderBottom: "2px solid #e2e8f0", fontWeight: 700, color: "#0077b6", width: 52, position: "sticky", right: 0, background: "#f8fafc", zIndex: 1, fontSize: 11, borderLeft: "1px solid #e2e8f0" }}>
                  出勤<br />/休
                </th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "#1e293b", position: "sticky", left: 0, background: "white", zIndex: 1, borderRight: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{s.role === "manager" ? "管理者" : "職員"}</div>
                  </td>
                  {days.map((d) => {
                    const val = getShift(s.id, d);
                    const info = SHIFT_TYPES[val] ?? SHIFT_TYPES[""];
                    const dow = new Date(year, month - 1, d).getDay();
                    const isEditing = editCell?.staffId === s.id && editCell?.day === d;
                    const cellKey = `${s.id}_${d}`;
                    const isSaving = savingCell === cellKey;
                    return (
                      <td key={d} style={{ textAlign: "center", padding: "3px 2px", background: dow === 0 || dow === 6 ? "#fafafa" : "white" }}>
                        {isEditing ? (
                          <select autoFocus defaultValue={val}
                            onChange={(e) => setShift(s.id, d, e.target.value)}
                            onBlur={() => setEditCell(null)}
                            style={{ width: 38, fontSize: 11, border: "1px solid #0077b6", borderRadius: 4 }}>
                            {Object.keys(SHIFT_TYPES).map((k) => (
                              <option key={k} value={k}>{k === "" ? "－" : k}</option>
                            ))}
                          </select>
                        ) : (
                          <div onClick={() => setEditCell({ staffId: s.id, day: d })}
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, cursor: "pointer", background: isSaving ? "#e0f2fe" : info.bg, color: isSaving ? "#0077b6" : info.color, fontWeight: 700, fontSize: 12, border: val ? "none" : "1px dashed #e2e8f0", opacity: isSaving ? 0.6 : 1 }}>
                            {isSaving ? "…" : (val || "")}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {/* 月間出勤日数・休日数・有休日数の集計 */}
                  <td style={{ textAlign: "center", position: "sticky", right: 0, background: "white", borderLeft: "1px solid #e2e8f0", padding: "4px 6px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0077b6" }}>{countWork(s.id)}日</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.3 }}>
                      {countOff(s.id) > 0 && <span>休{countOff(s.id)} </span>}
                      {countPaid(s.id) > 0 && <span style={{ color: "#f59e0b" }}>有{countPaid(s.id)}</span>}
                    </div>
                  </td>
                </tr>
              ))}

              {/* 日別出勤数の合計行 */}
              <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                <td style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, color: "#64748b", position: "sticky", left: 0, background: "#f8fafc", zIndex: 1 }}>出勤数</td>
                {days.map((d) => {
                  const cnt = countByDay(d);
                  const dow = new Date(year, month - 1, d).getDay();
                  return (
                    <td key={d} style={{ textAlign: "center", padding: "4px 2px", background: dow === 0 || dow === 6 ? "#fafafa" : "#f8fafc" }}>
                      {cnt > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: cnt >= 2 ? "#059669" : "#f59e0b" }}>{cnt}</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ position: "sticky", right: 0, background: "#f8fafc", borderLeft: "1px solid #e2e8f0" }} />
              </tr>
            </tbody>
          </table>
        )}
      </div>
      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>※ セルをクリックしてシフト種別を設定。変更は自動保存されます。</p>
    </div>
  );
}
