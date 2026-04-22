"use client";
// ==================== 請求管理 ====================
// 月間の利用日数をもとに請求額を計算・Excel出力

import { useState, useEffect } from "react";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { fetchByFacility } from "@/lib/supabase";
import type { UserSession, AttendanceRecord, Child } from "@/types";
import * as XLSX from "xlsx";

// 放課後等デイサービスの基本的な単価設定（簡易版）
const DEFAULT_UNIT_PRICE = 10000; // 1回あたりの基本単価（円）
const USER_BURDEN_RATE = 0.1;     // 利用者負担率（1割）
const USER_BURDEN_CAP = 37200;    // 利用者負担上限額（月額・円）

function genMonths(count = 6) {
  const months = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    months.push({ year: y, month: m, label: `${y}年${m}月` });
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

type BillingRow = {
  child: Child;
  useDays: number;        // 利用日数
  unitPrice: number;      // 1回単価
  totalAmount: number;    // 合計（利用日数 × 単価）
  userBurden: number;     // 利用者負担額
  publicBurden: number;   // 給付費（公費）
};

export default function BillingPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const today = new Date();
  const [selYear, setSelYear] = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth() + 1);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [dbChildren, setDbChildren] = useState<Child[]>([]);
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("gg_session");
    if (raw) setSession(JSON.parse(raw));
  }, []);

  // 選択月の入退室データを読み込む
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    Promise.all([
      fetchByFacility<AttendanceRecord>("ng_attendance", session.org_id, session.selected_facility_id),
      fetchByFacility<Child>("ng_children", session.org_id, session.selected_facility_id),
    ]).then(([att, children]) => {
      setAttendance(att);
      if (children.length > 0) setDbChildren(children.filter((c) => c.active));
      setLoading(false);
    });
  }, [session]);

  if (!session) return null;

  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);
  const children = dbChildren.length > 0 ? dbChildren : DUMMY_CHILDREN.filter(
    (c) => c.active && c.facility_id === session.selected_facility_id
  );

  // 選択月の来所記録のみ絞り込み
  const monthStr = `${selYear}-${String(selMonth).padStart(2, "0")}`;
  const monthAttendance = attendance.filter(
    (a) => a.date?.startsWith(monthStr) && a.status === "来所"
  );

  // 請求計算
  const rows: BillingRow[] = children.map((child) => {
    const useDays = monthAttendance.filter(
      (a) => a.child_id === child.id || a.child_name === child.name
    ).length;
    const unitPrice = unitPrices[child.id] ?? DEFAULT_UNIT_PRICE;
    const totalAmount = useDays * unitPrice;
    const rawBurden = Math.floor(totalAmount * USER_BURDEN_RATE);
    const userBurden = Math.min(rawBurden, USER_BURDEN_CAP);
    const publicBurden = totalAmount - userBurden;
    return { child, useDays, unitPrice, totalAmount, userBurden, publicBurden };
  });

  const totals = {
    useDays: rows.reduce((s, r) => s + r.useDays, 0),
    total: rows.reduce((s, r) => s + r.totalAmount, 0),
    userBurden: rows.reduce((s, r) => s + r.userBurden, 0),
    publicBurden: rows.reduce((s, r) => s + r.publicBurden, 0),
  };

  // Excel出力
  const exportExcel = () => {
    const data = rows.map((r) => ({
      "氏名": r.child.name,
      "学年": r.child.grade ?? "",
      "診断名": r.child.diagnosis ?? "",
      "利用日数": r.useDays,
      "1回単価（円）": r.unitPrice,
      "合計（円）": r.totalAmount,
      "利用者負担額（円）": r.userBurden,
      "給付費（円）": r.publicBurden,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    // 列幅調整
    ws["!cols"] = [14,8,16,8,12,12,16,12].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "請求一覧");
    // 合計行追加
    const summaryData = [
      { "項目": "合計利用日数", "値": totals.useDays },
      { "項目": "合計請求額", "値": totals.total },
      { "項目": "利用者負担合計", "値": totals.userBurden },
      { "項目": "給付費合計", "値": totals.publicBurden },
    ];
    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws2, "合計");
    XLSX.writeFile(wb, `請求一覧_${fac?.name}_${selYear}年${selMonth}月.xlsx`);
  };

  const months = genMonths(12);

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>💴 請求管理</h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{fac?.name} ／ 月間利用料金の計算</p>
        </div>
        <button className="btn-primary" onClick={exportExcel} style={{ background: "#059669" }}>
          📊 Excelで出力
        </button>
      </div>

      {/* 月選択 */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>対象月</label>
            <select className="form-input" style={{ width: "auto" }}
              value={`${selYear}-${selMonth}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-");
                setSelYear(+y); setSelMonth(+m);
              }}>
              {months.map((m) => (
                <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{m.label}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", paddingBottom: 10 }}>
            ※ 単価は各行で変更できます（デフォルト: {DEFAULT_UNIT_PRICE.toLocaleString()}円）
          </div>
        </div>
      </div>

      {/* 集計サマリー */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "合計利用日数", val: `${totals.useDays}日`, color: "#0077b6", bg: "#dbeafe" },
          { label: "合計請求額",   val: `¥${totals.total.toLocaleString()}`, color: "#059669", bg: "#dcfce7" },
          { label: "利用者負担合計", val: `¥${totals.userBurden.toLocaleString()}`, color: "#d97706", bg: "#fef9c3" },
          { label: "給付費合計",   val: `¥${totals.publicBurden.toLocaleString()}`, color: "#7c3aed", bg: "#f3e8ff" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "14px 16px", background: s.bg, border: "none" }}>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 700, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* 請求明細テーブル */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><span className="spinner" /></div>
      ) : (
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>氏名</th>
                <th>学年</th>
                <th style={{ textAlign: "right" }}>利用日数</th>
                <th style={{ textAlign: "right" }}>1回単価</th>
                <th style={{ textAlign: "right" }}>合計額</th>
                <th style={{ textAlign: "right" }}>利用者負担</th>
                <th style={{ textAlign: "right" }}>給付費</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.child.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.child.name}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{row.child.name_kana}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{row.child.grade ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: row.useDays > 0 ? "#0077b6" : "#94a3b8" }}>
                      {row.useDays}
                    </span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>日</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={unitPrices[row.child.id] ?? DEFAULT_UNIT_PRICE}
                      onChange={(e) => setUnitPrices((p) => ({ ...p, [row.child.id]: +e.target.value }))}
                      style={{ width: 90, textAlign: "right", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 6px", fontSize: 12, fontFamily: "inherit" }}
                    />
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {row.totalAmount > 0 ? `¥${row.totalAmount.toLocaleString()}` : "—"}
                  </td>
                  <td style={{ textAlign: "right", color: "#d97706" }}>
                    {row.userBurden > 0 ? `¥${row.userBurden.toLocaleString()}` : "—"}
                  </td>
                  <td style={{ textAlign: "right", color: "#7c3aed" }}>
                    {row.publicBurden > 0 ? `¥${row.publicBurden.toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #e2e8f0" }}>
                <td colSpan={2} style={{ fontSize: 13, color: "#0a2540" }}>合計</td>
                <td style={{ textAlign: "right", color: "#0077b6" }}>{totals.useDays}日</td>
                <td></td>
                <td style={{ textAlign: "right" }}>¥{totals.total.toLocaleString()}</td>
                <td style={{ textAlign: "right", color: "#d97706" }}>¥{totals.userBurden.toLocaleString()}</td>
                <td style={{ textAlign: "right", color: "#7c3aed" }}>¥{totals.publicBurden.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: "#94a3b8", lineHeight: 1.8 }}>
        ※ この画面は概算計算です。実際の請求は障害支援区分・加算・地域区分等により異なります。<br />
        ※ 利用者負担：合計額の1割（月額上限 {USER_BURDEN_CAP.toLocaleString()}円）
      </div>
    </div>
  );
}
