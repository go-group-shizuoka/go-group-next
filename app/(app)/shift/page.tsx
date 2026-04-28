"use client";
// ==================== シフト・出勤管理 ====================
// シフト表の作成・編集（月次カレンダー）と出勤打刻機能

import { useState, useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { fetchByFacility, saveRecord } from "@/lib/supabase";
import { DUMMY_STAFF, DUMMY_FACILITIES } from "@/lib/dummy-data";
import type { ShiftRecord, WorkLog } from "@/types";
// xlsxは削除しexceljsに移行

type TabKey = "shift" | "worklog";

// シフト種別（クリックで循環）
const SHIFT_TYPES = ["", "日勤", "早番", "遅番", "休", "有", "欠"];

// シフト種別ごとの色定義
const SHIFT_STYLE: Record<string, { bg: string; color: string }> = {
  "":     { bg: "#f8fafc", color: "#94a3b8" },
  "日勤": { bg: "#dbeafe", color: "#1d4ed8" },
  "早番": { bg: "#dcfce7", color: "#15803d" },
  "遅番": { bg: "#fef9c3", color: "#b45309" },
  "休":   { bg: "#f1f5f9", color: "#64748b" },
  "有":   { bg: "#f3e8ff", color: "#7c3aed" },
  "欠":   { bg: "#fee2e2", color: "#dc2626" },
};

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

// 月の日数を取得
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

// 過去12ヶ月の選択肢を生成
function genMonths(count = 12) {
  const months = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    months.push({
      year: d.getFullYear(), month: d.getMonth() + 1,
      label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
    });
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

// 現在時刻を HH:MM 形式で取得
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 今日の日付を YYYY-MM-DD 形式で取得
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ShiftPage() {
  const session = useSession();
  const [tab, setTab] = useState<TabKey>("shift");

  // 月選択（シフト・ログ共通）
  const today = new Date();
  const [selYear, setSelYear] = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth() + 1);
  const months = genMonths(12);

  // === シフト管理 ===
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  // key: "staffId_year_month_day" → シフト種別
  const [editShifts, setEditShifts] = useState<Record<string, string>>({});
  const [shiftSaving, setShiftSaving] = useState(false);
  const [shiftMsg, setShiftMsg] = useState("");

  // === 出勤打刻 ===
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [clockMsg, setClockMsg] = useState("");

  // データ読み込み
  useEffect(() => {
    if (!session) return;
    Promise.all([
      fetchByFacility<ShiftRecord>("ng_shift", session.org_id, session.selected_facility_id),
      fetchByFacility<WorkLog>("ng_work_log", session.org_id, session.selected_facility_id),
    ]).then(([s, w]) => {
      setShifts(s);
      setWorkLogs(w);
      // 編集マップを初期化
      const map: Record<string, string> = {};
      s.forEach((r) => { map[`${r.staff_id}_${r.year}_${r.month}_${r.day}`] = r.shift_type; });
      setEditShifts(map);
    });
  }, [session]);

  if (!session) return null;

  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);
  // この施設の職員一覧（ダミーから取得）
  const staffList = DUMMY_STAFF.filter((s) => s.facility_id === session.selected_facility_id);
  const daysInMonth = getDaysInMonth(selYear, selMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // シフトをクリックで次の種別に循環
  const cycleShift = (staffId: string, day: number) => {
    const key = `${staffId}_${selYear}_${selMonth}_${day}`;
    const current = editShifts[key] ?? "";
    const idx = SHIFT_TYPES.indexOf(current);
    const next = SHIFT_TYPES[(idx + 1) % SHIFT_TYPES.length];
    setEditShifts((p) => ({ ...p, [key]: next }));
  };

  // シフトを保存（ng_shiftテーブルへupsert）
  const handleSaveShift = async () => {
    setShiftSaving(true);
    try {
      const targets = Object.entries(editShifts).filter(([key]) =>
        key.includes(`_${selYear}_${selMonth}_`)
      );
      await Promise.all(
        targets.map(([key, shift_type]) => {
          const parts = key.split("_");
          const staff_id = parts[0];
          const day = Number(parts[3]);
          const staff = staffList.find((s) => s.id === staff_id);
          return saveRecord("ng_shift", {
            id: `${session.selected_facility_id}_${selYear}_${selMonth}_${staff_id}_${day}`,
            org_id: session.org_id,
            facility_id: session.selected_facility_id,
            staff_id,
            staff_name: staff?.name ?? "",
            year: selYear,
            month: selMonth,
            day,
            shift_type,
            created_by: session.name,
            created_at: new Date().toISOString(),
          } as Record<string, unknown>);
        })
      );
      setShiftMsg("✓ シフトを保存しました");
    } catch {
      setShiftMsg("⚠️ 保存に失敗しました");
    }
    setShiftSaving(false);
    setTimeout(() => setShiftMsg(""), 3000);
  };

  // シフト表をExcel出力（exceljs：枠線・色付き）
  const exportShiftExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("シフト表", {
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, paperSize: 9 },
    });

    const thin = { style: "thin" as const, color: { argb: "FFCCCCCC" } };
    const bd = { top: thin, left: thin, bottom: thin, right: thin };

    // ===== タイトル行 =====
    ws.mergeCells(1, 1, 1, days.length + 2);
    const title = ws.getCell(1, 1);
    title.value = `${fac?.name}　シフト表　${selYear}年${selMonth}月`;
    title.font = { bold: true, size: 13, color: { argb: "FF0A2540" } };
    title.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 26;

    // ===== ヘッダー行 =====
    ws.getRow(2).height = 32;
    // 氏名列ヘッダー
    const h0 = ws.getCell(2, 1);
    h0.value = "氏名";
    h0.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } };
    h0.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    h0.alignment = { horizontal: "center", vertical: "middle" };
    h0.border = bd;

    days.forEach((day, i) => {
      const dow = new Date(selYear, selMonth - 1, day).getDay();
      const isSun = dow === 0;
      const isSat = dow === 6;
      const cell = ws.getCell(2, i + 2);
      cell.value = `${day}\n${DOW[dow]}`;
      cell.fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: isSun ? "FFFCE4E4" : isSat ? "FFE4EAFE" : "FF1E3A5F" },
      };
      cell.font = {
        bold: true, size: 9,
        color: { argb: isSun ? "FFDC2626" : isSat ? "FF2563EB" : "FFFFFFFF" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = bd;
    });

    // 出勤日数ヘッダー
    const hLast = ws.getCell(2, days.length + 2);
    hLast.value = "出勤\n日数";
    hLast.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } };
    hLast.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    hLast.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    hLast.border = bd;

    // ===== データ行 =====
    const shiftColors: Record<string, string> = {
      "日勤": "FFDBEAFE", "早番": "FFDCFCE7", "遅番": "FFFEF9C3",
      "休":   "FFF1F5F9", "有":   "FFF3E8FF", "欠":   "FFFEE2E2",
    };
    const shiftFontColors: Record<string, string> = {
      "日勤": "FF1D4ED8", "早番": "FF15803D", "遅番": "FFB45309",
      "休":   "FF64748B", "有":   "FF7C3AED", "欠":   "FFDC2626",
    };

    staffList.forEach((staff, rowIdx) => {
      let workDays = 0;
      const row = ws.getRow(rowIdx + 3);
      row.height = 20;
      const bgRow = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: rowIdx % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" } };

      // 氏名
      const nameCell = row.getCell(1);
      nameCell.value = staff.name;
      nameCell.font = { bold: true, size: 10 };
      nameCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      nameCell.border = bd;
      nameCell.fill = bgRow;

      days.forEach((day, colIdx) => {
        const key = `${staff.id}_${selYear}_${selMonth}_${day}`;
        const s = editShifts[key] ?? "";
        if (s && s !== "休" && s !== "有" && s !== "欠") workDays++;
        const cell = row.getCell(colIdx + 2);
        cell.value = s || "";
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = bd;
        cell.font = { bold: !!s, size: 9, color: { argb: s ? (shiftFontColors[s] ?? "FF374151") : "FF94A3B8" } };
        cell.fill = s && shiftColors[s]
          ? { type: "pattern", pattern: "solid", fgColor: { argb: shiftColors[s] } }
          : bgRow;
      });

      // 出勤日数
      const wdCell = row.getCell(days.length + 2);
      wdCell.value = workDays;
      wdCell.font = { bold: true, size: 10, color: { argb: "FF0077B6" } };
      wdCell.alignment = { horizontal: "center", vertical: "middle" };
      wdCell.border = bd;
      wdCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    });

    // ===== 列幅 =====
    ws.getColumn(1).width = 14;
    days.forEach((_, i) => { ws.getColumn(i + 2).width = 4.5; });
    ws.getColumn(days.length + 2).width = 7;

    // ===== ダウンロード =====
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `シフト表_${fac?.name}_${selYear}年${selMonth}月.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // === 出勤打刻 ===
  const today_str = todayStr();
  const todayLogs = workLogs.filter((w) => w.date === today_str);

  // 出勤打刻
  const handleClockIn = async (staffId: string, staffName: string) => {
    const existing = todayLogs.find((w) => w.staff_id === staffId);
    if (existing?.clock_in) return;
    const log: WorkLog = {
      id: `${session.selected_facility_id}_${today_str}_${staffId}`,
      org_id: session.org_id,
      facility_id: session.selected_facility_id,
      staff_id: staffId,
      staff_name: staffName,
      date: today_str,
      clock_in: nowTime(),
      break_minutes: 60,
      created_at: new Date().toISOString(),
    };
    await saveRecord("ng_work_log", log as unknown as Record<string, unknown>);
    setWorkLogs((p) => {
      const exists = p.find((w) => w.id === log.id);
      return exists ? p.map((w) => w.id === log.id ? log : w) : [...p, log];
    });
    setClockMsg(`✓ ${staffName} の出勤を記録しました（${log.clock_in}）`);
    setTimeout(() => setClockMsg(""), 4000);
  };

  // 退勤打刻
  const handleClockOut = async (staffId: string) => {
    const existing = todayLogs.find((w) => w.staff_id === staffId);
    if (!existing || existing.clock_out) return;
    const clockOut = nowTime();
    const [inH, inM] = (existing.clock_in ?? "09:00").split(":").map(Number);
    const [outH, outM] = clockOut.split(":").map(Number);
    const totalMins = (outH * 60 + outM) - (inH * 60 + inM);
    const workMinutes = Math.max(0, totalMins - (existing.break_minutes ?? 60));
    const updated = { ...existing, clock_out: clockOut, work_minutes: workMinutes };
    await saveRecord("ng_work_log", updated as unknown as Record<string, unknown>);
    setWorkLogs((p) => p.map((w) => w.id === existing.id ? updated : w));
    setClockMsg(`✓ ${existing.staff_name} の退勤を記録しました（${clockOut}）`);
    setTimeout(() => setClockMsg(""), 4000);
  };

  // 月次ログ
  const monthStr = `${selYear}-${String(selMonth).padStart(2, "0")}`;
  const monthLogs = workLogs
    .filter((w) => w.date?.startsWith(monthStr))
    .sort((a, b) => a.date > b.date ? 1 : -1);

  // 月次勤務時間集計
  const monthTotals = staffList.map((staff) => {
    const logs = monthLogs.filter((w) => w.staff_id === staff.id);
    const totalMins = logs.reduce((s, w) => s + (w.work_minutes ?? 0), 0);
    const workDays = logs.filter((w) => w.clock_in).length;
    return { staff, totalMins, workDays };
  });

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>📆 シフト・出勤管理</h1>
        <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{fac?.name} ／ 職員シフト・勤怠管理</p>
      </div>

      {/* タブ */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #e2e8f0" }}>
        {([
          { key: "shift" as TabKey, label: "📅 シフト管理" },
          { key: "worklog" as TabKey, label: "⏰ 出勤打刻" },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "10px 20px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
              fontFamily: "inherit", background: "transparent",
              borderBottom: tab === t.key ? "3px solid #0077b6" : "3px solid transparent",
              color: tab === t.key ? "#0077b6" : "#64748b", marginBottom: -2, transition: "all 0.15s",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== シフト管理タブ ===== */}
      {tab === "shift" && (
        <div>
          {/* コントロールバー */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", justifyContent: "space-between" }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>対象月</label>
                <select className="form-input" style={{ width: "auto" }}
                  value={`${selYear}-${selMonth}`}
                  onChange={(e) => { const [y, m] = e.target.value.split("-"); setSelYear(+y); setSelMonth(+m); }}>
                  {months.map((m) => (
                    <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {shiftMsg && (
                  <span style={{ fontSize: 12, color: shiftMsg.includes("✓") ? "#059669" : "#dc2626", fontWeight: 600 }}>
                    {shiftMsg}
                  </span>
                )}
                <button className="btn-secondary" onClick={exportShiftExcel} style={{ fontSize: 12 }}>
                  📊 Excel出力
                </button>
                <button className="btn-primary" onClick={handleSaveShift} disabled={shiftSaving} style={{ fontSize: 12 }}>
                  {shiftSaving ? "保存中..." : "💾 シフト保存"}
                </button>
              </div>
            </div>
          </div>

          {/* 凡例 */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
            {SHIFT_TYPES.filter((s) => s !== "").map((s) => (
              <span key={s} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 10,
                background: SHIFT_STYLE[s].bg, color: SHIFT_STYLE[s].color, fontWeight: 700,
              }}>
                {s}
              </span>
            ))}
            <span style={{ fontSize: 11, color: "#94a3b8" }}>※ セルをクリックで変更</span>
          </div>

          {/* シフト表カレンダー */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
              <thead>
                <tr>
                  <th style={{
                    position: "sticky", left: 0, background: "#f8fafc", zIndex: 2,
                    padding: "8px 14px", textAlign: "left", borderBottom: "2px solid #e2e8f0",
                    minWidth: 100, fontWeight: 700, color: "#374151",
                  }}>
                    職員名
                  </th>
                  {days.map((day) => {
                    const dow = new Date(selYear, selMonth - 1, day).getDay();
                    const isSun = dow === 0;
                    const isSat = dow === 6;
                    return (
                      <th key={day} style={{
                        padding: "4px 2px", textAlign: "center", borderBottom: "2px solid #e2e8f0",
                        minWidth: 34, color: isSun ? "#dc2626" : isSat ? "#2563eb" : "#374151", fontWeight: 700,
                      }}>
                        <div style={{ fontSize: 11 }}>{day}</div>
                        <div style={{ fontSize: 9, fontWeight: 400 }}>{DOW[dow]}</div>
                      </th>
                    );
                  })}
                  <th style={{
                    padding: "8px 8px", textAlign: "center", borderBottom: "2px solid #e2e8f0",
                    minWidth: 60, fontWeight: 700, color: "#374151",
                  }}>
                    出勤日数
                  </th>
                </tr>
              </thead>
              <tbody>
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 2} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>
                      この施設の職員が登録されていません
                    </td>
                  </tr>
                ) : staffList.map((staff) => {
                  let workDays = 0;
                  return (
                    <tr key={staff.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{
                        position: "sticky", left: 0, background: "white", zIndex: 1,
                        padding: "6px 14px", fontWeight: 600, whiteSpace: "nowrap",
                        borderRight: "1px solid #f1f5f9",
                      }}>
                        {staff.name}
                      </td>
                      {days.map((day) => {
                        const key = `${staff.id}_${selYear}_${selMonth}_${day}`;
                        const s = editShifts[key] ?? "";
                        const style = SHIFT_STYLE[s] ?? SHIFT_STYLE[""];
                        if (s && s !== "休" && s !== "有" && s !== "欠") workDays++;
                        return (
                          <td key={day}
                            onClick={() => cycleShift(staff.id, day)}
                            style={{ padding: "3px 2px", textAlign: "center", cursor: "pointer" }}>
                            <div style={{
                              background: style.bg, color: style.color, fontWeight: 700,
                              fontSize: 11, borderRadius: 4, padding: "3px 1px", minWidth: 28,
                            }}>
                              {s || "—"}
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: "#0077b6" }}>
                        {workDays}日
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== 出勤打刻タブ ===== */}
      {tab === "worklog" && (
        <div>
          {/* 本日の打刻 */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0a2540", marginBottom: 16 }}>
              ⏰ 本日の出勤状況
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 400, marginLeft: 8 }}>
                {today_str.replace(/-/g, "/")}
              </span>
            </div>
            {clockMsg && (
              <div style={{
                background: clockMsg.includes("✓") ? "#dcfce7" : "#fef2f2",
                color: clockMsg.includes("✓") ? "#166534" : "#dc2626",
                borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, fontWeight: 600,
              }}>
                {clockMsg}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {staffList.length === 0 && (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: 24 }}>
                  職員が登録されていません
                </div>
              )}
              {staffList.map((staff) => {
                const log = todayLogs.find((w) => w.staff_id === staff.id);
                return (
                  <div key={staff.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    background: "#f8fafc", borderRadius: 10, flexWrap: "wrap",
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg,#0077b6,#00b4d8)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "white", fontWeight: 800, fontSize: 15,
                    }}>
                      {staff.name.slice(0, 1)}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, minWidth: 90 }}>{staff.name}</div>
                    <div style={{ display: "flex", gap: 16, flex: 1, alignItems: "center", flexWrap: "wrap" }}>
                      {log?.clock_in ? (
                        <span style={{ fontSize: 13, color: "#059669", fontWeight: 700 }}>🟢 出勤 {log.clock_in}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>未出勤</span>
                      )}
                      {log?.clock_out ? (
                        <span style={{ fontSize: 13, color: "#7c3aed", fontWeight: 700 }}>🟣 退勤 {log.clock_out}</span>
                      ) : log?.clock_in ? (
                        <span style={{ fontSize: 12, color: "#f59e0b" }}>勤務中…</span>
                      ) : null}
                      {log?.work_minutes != null && (
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          ⏱ {Math.floor(log.work_minutes / 60)}時間{log.work_minutes % 60}分
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {!log?.clock_in && (
                        <button className="btn-primary"
                          onClick={() => handleClockIn(staff.id, staff.name)}
                          style={{ fontSize: 12, padding: "6px 16px", background: "#059669" }}>
                          出勤
                        </button>
                      )}
                      {log?.clock_in && !log?.clock_out && (
                        <button className="btn-primary"
                          onClick={() => handleClockOut(staff.id)}
                          style={{ fontSize: 12, padding: "6px 16px", background: "#7c3aed" }}>
                          退勤
                        </button>
                      )}
                      {log?.clock_out && (
                        <span style={{
                          fontSize: 11, padding: "4px 12px", borderRadius: 12,
                          background: "#f3e8ff", color: "#7c3aed", fontWeight: 700,
                        }}>
                          ✓ 完了
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 月次勤務サマリー */}
          {monthTotals.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
              {monthTotals.map(({ staff, totalMins, workDays }) => (
                <div key={staff.id} className="card" style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0a2540", marginBottom: 6 }}>{staff.name}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0077b6" }}>
                    {Math.floor(totalMins / 60)}<span style={{ fontSize: 12 }}>h</span>{totalMins % 60}<span style={{ fontSize: 12 }}>m</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>出勤 {workDays}日</div>
                </div>
              ))}
            </div>
          )}

          {/* 月次勤怠ログテーブル */}
          <div className="card" style={{ overflow: "hidden", padding: 0 }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0a2540" }}>📋 月次勤怠ログ</div>
              <select className="form-input" style={{ width: "auto", fontSize: 12 }}
                value={`${selYear}-${selMonth}`}
                onChange={(e) => { const [y, m] = e.target.value.split("-"); setSelYear(+y); setSelMonth(+m); }}>
                {months.map((m) => (
                  <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{m.label}</option>
                ))}
              </select>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>氏名</th>
                  <th style={{ textAlign: "center" }}>出勤時刻</th>
                  <th style={{ textAlign: "center" }}>退勤時刻</th>
                  <th style={{ textAlign: "center" }}>実働時間</th>
                </tr>
              </thead>
              <tbody>
                {monthLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>
                      この月の記録はありません
                    </td>
                  </tr>
                ) : monthLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: 13 }}>{log.date}</td>
                    <td style={{ fontWeight: 600 }}>{log.staff_name}</td>
                    <td style={{ textAlign: "center", color: "#059669", fontWeight: 700 }}>{log.clock_in ?? "—"}</td>
                    <td style={{ textAlign: "center", color: "#7c3aed", fontWeight: 700 }}>{log.clock_out ?? "—"}</td>
                    <td style={{ textAlign: "center", color: "#64748b" }}>
                      {log.work_minutes != null
                        ? `${Math.floor(log.work_minutes / 60)}h${log.work_minutes % 60}m`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
