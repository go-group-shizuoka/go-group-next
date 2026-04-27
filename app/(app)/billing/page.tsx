"use client";
// ==================== 請求管理 ====================
// 月間の利用日数をもとに請求額を計算・Excel出力

import { useState, useEffect } from "react";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { fetchByFacility, saveRecord } from "@/lib/supabase";
import type { AttendanceRecord, Child } from "@/types";
import * as XLSX from "xlsx";
import { useSession } from "@/hooks/useSession";

// 放課後等デイサービスの基本的な単価設定（簡易版）
const DEFAULT_UNIT_PRICE = 10000; // 1回あたりの基本単価（円）
const USER_BURDEN_RATE = 0.1;     // 利用者負担率（1割）
const USER_BURDEN_CAP = 37200;    // 利用者負担上限額（月額・円）デフォルト

// 送迎加算の定数（大阪地域区分）
const TRANSPORT_UNIT = 54;                                      // 送迎加算単価（単位）
const UNIT_PRICE_PER_UNIT = 11.2;                               // 1単位の単価（円）
const TRANSPORT_ADDITION = Math.round(TRANSPORT_UNIT * UNIT_PRICE_PER_UNIT); // ≒605円/回

function genMonths(count = 12) {
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

// BillingRow型定義：送迎加算・個別負担上限を追加
type BillingRow = {
  child: Child;
  useDays: number;           // 利用日数
  unitPrice: number;         // 1回単価
  transportDays: number;     // 送迎利用日数
  transportAddition: number; // 送迎加算額
  totalAmount: number;       // 合計（利用日数 × 単価 + 送迎加算）
  userBurden: number;        // 利用者負担額
  publicBurden: number;      // 給付費（公費）
  burdenCap: number;         // 個別の負担上限額
};

export default function BillingPage() {
  const session = useSession();
  const today = new Date();
  const [selYear, setSelYear] = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth() + 1);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [dbChildren, setDbChildren] = useState<Child[]>([]);
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});
  // 個別負担上限額（child.id => 金額）
  const [burdenCaps, setBurdenCaps] = useState<Record<string, number>>({});
  // 請求ステータス管理
  const [billingStatus, setBillingStatus] = useState<"draft" | "confirmed">("draft");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // 選択月の入退室データを読み込む
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    // 月が変わったらステータスをリセット
    setBillingStatus("draft");
    setSavedMsg("");
    Promise.all([
      fetchByFacility<AttendanceRecord>("ng_attendance", session.org_id, session.selected_facility_id),
      fetchByFacility<Child>("ng_children", session.org_id, session.selected_facility_id),
    ]).then(([att, children]) => {
      setAttendance(att);
      if (children.length > 0) setDbChildren(children.filter((c) => c.active));
      setLoading(false);
    });
  }, [session, selYear, selMonth]);

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

  // 請求計算（送迎加算・個別負担上限対応）
  const rows: BillingRow[] = children.map((child) => {
    const childAtt = monthAttendance.filter(
      (a) => a.child_id === child.id || a.child_name === child.name
    );
    const useDays = childAtt.length;
    // 送迎あり児童のみ送迎日数を集計
    const transportDays = child.has_transport
      ? childAtt.filter((a) => a.transport_to || a.transport_from).length
      : 0;
    const transportAddition = transportDays * TRANSPORT_ADDITION;
    const unitPrice = unitPrices[child.id] ?? DEFAULT_UNIT_PRICE;
    const totalAmount = useDays * unitPrice + transportAddition;
    const cap = burdenCaps[child.id] ?? USER_BURDEN_CAP;
    const rawBurden = Math.floor(totalAmount * USER_BURDEN_RATE);
    const userBurden = Math.min(rawBurden, cap);
    const publicBurden = totalAmount - userBurden;
    return { child, useDays, unitPrice, transportDays, transportAddition, totalAmount, userBurden, publicBurden, burdenCap: cap };
  });

  const totals = {
    useDays: rows.reduce((s, r) => s + r.useDays, 0),
    transportDays: rows.reduce((s, r) => s + r.transportDays, 0),
    transportAddition: rows.reduce((s, r) => s + r.transportAddition, 0),
    total: rows.reduce((s, r) => s + r.totalAmount, 0),
    userBurden: rows.reduce((s, r) => s + r.userBurden, 0),
    publicBurden: rows.reduce((s, r) => s + r.publicBurden, 0),
  };

  // 請求確定：ng_billingテーブルに保存
  const handleConfirm = async () => {
    setSaving(true);
    try {
      await Promise.all(rows.map((row) =>
        saveRecord("ng_billing", {
          id: `${session.selected_facility_id}_${monthStr}_${row.child.id}`,
          org_id: session.org_id,
          facility_id: session.selected_facility_id,
          child_id: row.child.id,
          child_name: row.child.name,
          year: selYear,
          month: selMonth,
          use_days: row.useDays,
          transport_days: row.transportDays,
          unit_price: row.unitPrice,
          transport_addition: row.transportAddition,
          total_amount: row.totalAmount,
          user_burden: row.userBurden,
          public_burden: row.publicBurden,
          burden_cap: row.burdenCap,
          status: "confirmed",
          created_at: new Date().toISOString(),
        } as Record<string, unknown>)
      ));
      setBillingStatus("confirmed");
      setSavedMsg("✓ 請求を確定しました");
    } catch {
      setSavedMsg("⚠️ 保存に失敗しました");
    }
    setSaving(false);
    setTimeout(() => setSavedMsg(""), 4000);
  };

  // Excel出力
  const exportExcel = () => {
    const data = rows.map((r) => ({
      "氏名": r.child.name,
      "受給者証番号": r.child.recipient_number ?? "",
      "上限管理事業所": r.child.limit_manager ?? "",
      "学年": r.child.grade ?? "",
      "診断名": r.child.diagnosis ?? "",
      "利用日数": r.useDays,
      "1回単価（円）": r.unitPrice,
      "送迎日数": r.transportDays,
      "送迎加算（円）": r.transportAddition,
      "合計（円）": r.totalAmount,
      "負担上限（円）": r.burdenCap,
      "利用者負担額（円）": r.userBurden,
      "給付費（円）": r.publicBurden,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    // 列幅調整
    ws["!cols"] = [14, 8, 16, 8, 12, 8, 12, 12, 12, 16, 12].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "請求一覧");
    // 合計シートを追加
    const summaryData = [
      { "項目": "合計利用日数", "値": totals.useDays },
      { "項目": "合計送迎加算", "値": totals.transportAddition },
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
        {/* ボタンエリア */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* 保存結果メッセージ */}
          {savedMsg && (
            <span style={{ fontSize: 12, color: savedMsg.includes("✓") ? "#059669" : "#dc2626", fontWeight: 600, alignSelf: "center" }}>
              {savedMsg}
            </span>
          )}
          {/* 確定済みバッジ */}
          {billingStatus === "confirmed" && (
            <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 12, background: "#dcfce7", color: "#059669", fontWeight: 700, border: "1px solid #059669aa" }}>
              ✓ 確定済み
            </span>
          )}
          {/* Excel出力ボタン */}
          <button className="btn-secondary" onClick={exportExcel} style={{ fontSize: 12 }}>
            📊 Excel出力
          </button>
          {/* 請求確定ボタン（未確定時のみ表示） */}
          {billingStatus === "draft" && (
            <button
              className="btn-primary"
              onClick={handleConfirm}
              disabled={saving}
              style={{ background: "#059669", fontSize: 12 }}
            >
              {saving ? "保存中..." : "✅ 請求確定"}
            </button>
          )}
        </div>
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
            ※ 単価・負担上限は各行で変更できます（デフォルト単価: {DEFAULT_UNIT_PRICE.toLocaleString()}円）
          </div>
        </div>
      </div>

      {/* 集計サマリー */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "合計利用日数",    val: `${totals.useDays}日`,                      color: "#0077b6", bg: "#dbeafe" },
          { label: "送迎加算合計",    val: `¥${totals.transportAddition.toLocaleString()}`, color: "#0891b2", bg: "#e0f7fa" },
          { label: "合計請求額",      val: `¥${totals.total.toLocaleString()}`,          color: "#059669", bg: "#dcfce7" },
          { label: "利用者負担合計",  val: `¥${totals.userBurden.toLocaleString()}`,     color: "#d97706", bg: "#fef9c3" },
          { label: "給付費合計",      val: `¥${totals.publicBurden.toLocaleString()}`,   color: "#7c3aed", bg: "#f3e8ff" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "14px 16px", background: s.bg, border: "none" }}>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 700, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.val}</div>
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
                <th>受給者証番号</th>
                <th>上限管理事業所</th>
                <th style={{ textAlign: "right" }}>利用日数</th>
                <th style={{ textAlign: "right" }}>1回単価</th>
                <th style={{ textAlign: "right" }}>送迎加算</th>
                <th style={{ textAlign: "right" }}>合計額</th>
                <th style={{ textAlign: "right" }}>負担上限</th>
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
                  <td style={{ fontSize: 12, color: "#475569" }}>{row.child.recipient_number ?? "—"}</td>
                  <td style={{ fontSize: 12, color: "#475569" }}>{row.child.limit_manager ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: row.useDays > 0 ? "#0077b6" : "#94a3b8" }}>
                      {row.useDays}
                    </span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>日</span>
                  </td>
                  {/* 1回単価（編集可能） */}
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
                  {/* 送迎加算 */}
                  <td style={{ textAlign: "right", fontSize: 12, color: "#0891b2" }}>
                    {row.transportDays > 0 ? (
                      <span title={`送迎${row.transportDays}日`}>
                        ¥{row.transportAddition.toLocaleString()}
                      </span>
                    ) : "—"}
                  </td>
                  {/* 合計額 */}
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {row.totalAmount > 0 ? `¥${row.totalAmount.toLocaleString()}` : "—"}
                  </td>
                  {/* 個別負担上限（編集可能） */}
                  <td style={{ textAlign: "right" }}>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={burdenCaps[row.child.id] ?? USER_BURDEN_CAP}
                      onChange={(e) => setBurdenCaps((p) => ({ ...p, [row.child.id]: +e.target.value }))}
                      style={{ width: 90, textAlign: "right", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 6px", fontSize: 12, fontFamily: "inherit" }}
                    />
                  </td>
                  {/* 利用者負担 */}
                  <td style={{ textAlign: "right", color: "#d97706" }}>
                    {row.userBurden > 0 ? `¥${row.userBurden.toLocaleString()}` : "—"}
                  </td>
                  {/* 給付費 */}
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
                <td style={{ textAlign: "right", color: "#0891b2" }}>
                  {totals.transportAddition > 0 ? `¥${totals.transportAddition.toLocaleString()}` : "—"}
                </td>
                <td style={{ textAlign: "right" }}>¥{totals.total.toLocaleString()}</td>
                <td></td>
                <td style={{ textAlign: "right", color: "#d97706" }}>¥{totals.userBurden.toLocaleString()}</td>
                <td style={{ textAlign: "right", color: "#7c3aed" }}>¥{totals.publicBurden.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 注意書き */}
      <div style={{ marginTop: 12, fontSize: 11, color: "#94a3b8", lineHeight: 1.8 }}>
        ※ 送迎加算: {TRANSPORT_UNIT}単位 × {UNIT_PRICE_PER_UNIT}円 = {TRANSPORT_ADDITION}円/回（片道）<br />
        ※ 利用者負担：合計額の1割（負担上限額は個別に設定可能）<br />
        ※ 「請求確定」ボタンで ng_billing テーブルに保存されます。<br />
        ※ この画面は概算計算です。実際の請求は障害支援区分・加算・地域区分等により異なります。
      </div>
    </div>
  );
}
