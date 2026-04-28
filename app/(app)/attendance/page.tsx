"use client";
// ==================== 入退室記録 ====================

import { useState, useEffect } from "react";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { saveRecord, fetchByDate, uploadPhoto } from "@/lib/supabase";
import type { UserSession, AttendanceRecord } from "@/types";
// Excel出力：xlsx-js-style（純粋JS・Vercel対応）
import { useSession } from "@/hooks/useSession";
import { todayISO, nowHHMM, DOW } from "@/lib/utils";

function getTodayDow() {
  return DOW[new Date().getDay()];
}

export default function AttendancePage() {
  const session = useSession();
  const [records, setRecords] = useState<Record<string, { arrive?: string; depart?: string; temp?: string; photo_url?: string }>>({});
  const [selChild, setSelChild] = useState<string | null>(null);
  const [inputTemp, setInputTemp] = useState("");
  const [inputTime, setInputTime] = useState(nowHHMM());
  const [loadingDB, setLoadingDB] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Supabaseから本日の入退室記録を読み込む
  useEffect(() => {
    if (!session) return;
    setLoadingDB(true);
    fetchByDate<AttendanceRecord>(
      "ng_attendance",
      session.org_id,
      session.selected_facility_id,
      todayISO()
    ).then((rows) => {
      if (rows.length > 0) {
        const map: Record<string, { arrive?: string; depart?: string; temp?: string; photo_url?: string }> = {};
        rows.forEach((r) => {
          map[r.child_id] = {
            arrive: r.arrive_time ?? undefined,
            depart: r.depart_time ?? undefined,
            temp: r.temperature ?? undefined,
            photo_url: r.photo_url ?? undefined,
          };
        });
        setRecords(map);
      }
      setLoadingDB(false);
    });
  }, [session]);

  if (!session) return null;

  const todayDow = getTodayDow();
  if (loadingDB) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <span className="spinner" />
    </div>
  );
  const todayChildren = DUMMY_CHILDREN.filter(
    (c) =>
      c.active &&
      c.facility_id === session.selected_facility_id &&
      (c.use_days ?? []).includes(todayDow)
  );
  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);

  // Excel出力（xlsx-js-style：枠線・色付き）
  const exportExcel = async () => {
    const XLSXStyle = (await import("xlsx-js-style")).default;

    const { xlsBorder: bd } = await import("@/lib/excel-style");
    const COLS = ["A","B","C","D","E","F","G"];
    const colWidths = [{ wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws: Record<string, any> = {};
    const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

    // タイトル行
    ws["A1"] = {
      v: `${fac?.name}　入退室記録　${todayISO()}`, t: "s",
      s: {
        font: { bold: true, sz: 13, color: { rgb: "0A2540" } },
        alignment: { horizontal: "center", vertical: "center" },
      },
    };

    // ヘッダー行
    const headers = ["氏名", "学年", "入室時刻", "退出時刻", "体温（℃）", "状態", "送迎"];
    headers.forEach((h, i) => {
      ws[`${COLS[i]}2`] = {
        v: h, t: "s",
        s: {
          fill: { patternType: "solid", fgColor: { rgb: "0A2540" } },
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
          alignment: { horizontal: "center", vertical: "center" },
          border: bd,
        },
      };
    });

    // データ行
    todayChildren.forEach((child, rowIdx) => {
      const rec = records[child.id];
      const rowNum = rowIdx + 3;
      const bgRgb = rowIdx % 2 === 0 ? "F8FAFC" : "FFFFFF";
      const status = rec?.depart ? "退所済" : rec?.arrive ? "来所中" : "未来所";
      const statusRgb = rec?.depart ? "94A3B8" : rec?.arrive ? "059669" : "F59E0B";
      const values = [
        child.name, child.grade ?? "",
        rec?.arrive ?? "", rec?.depart ?? "",
        rec?.temp ?? "", status,
        child.has_transport ? "あり" : "—",
      ];

      values.forEach((v, i) => {
        // 列ごとの文字色
        let fontRgb = "374151";
        if (i === 2 && rec?.arrive) fontRgb = "059669";
        else if (i === 3 && rec?.depart) fontRgb = "0077B6";
        else if (i === 5) fontRgb = statusRgb;

        ws[`${COLS[i]}${rowNum}`] = {
          v, t: "s",
          s: {
            font: { bold: i === 0 || [2,3,5].includes(i), sz: 10, color: { rgb: fontRgb } },
            alignment: { horizontal: i === 0 ? "left" : "center", vertical: "center" },
            border: bd,
            fill: { patternType: "solid", fgColor: { rgb: bgRgb } },
          },
        };
      });
    });

    const lastRow = todayChildren.length + 2;
    ws["!ref"] = `A1:G${lastRow}`;
    ws["!merges"] = merges;
    ws["!cols"] = colWidths;

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, "入退室記録");
    const wbout: ArrayBuffer = XLSXStyle.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `入退室記録_${fac?.name}_${todayISO()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleArrive = async (childId: string) => {
    const child = DUMMY_CHILDREN.find((c) => c.id === childId);
    setUploading(true);

    // 写真アップロード
    let photoUrl: string | undefined;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop();
      const path = `attendance/${session!.org_id}/${todayISO()}_${childId}.${ext}`;
      const url = await uploadPhoto(photoFile, path);
      if (url) photoUrl = url;
    }

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
      photo_url: photoUrl,
      recorded_by: session!.name,
      created_at: new Date().toISOString(),
    };
    saveRecord("ng_attendance", rec as unknown as Record<string, unknown>);
    setRecords((prev) => ({
      ...prev,
      [childId]: { ...prev[childId], arrive: inputTime, temp: inputTemp || "—", photo_url: photoUrl },
    }));
    setSelChild(null);
    setInputTemp("");
    setInputTime(nowHHMM());
    setPhotoFile(null);
    setPhotoPreview(null);
    setUploading(false);
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>
            📋 入退室記録
          </h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
            {fac?.name} ／ {todayISO()} ({todayDow}曜) ／ {todayChildren.length}名来所予定
          </p>
        </div>
        <button className="btn-secondary" onClick={exportExcel} style={{ fontSize: 12, padding: "7px 14px" }}>
          📊 Excel出力
        </button>
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
            {/* 写真アップロード（来所時のみ） */}
            {!rec.arrive && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                  📷 来所時の写真（任意）
                </label>
                <input type="file" accept="image/*" capture="environment"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setPhotoFile(f);
                    setPhotoPreview(URL.createObjectURL(f));
                  }}
                  style={{ fontSize: 12, color: "#475569" }} />
                {photoPreview && (
                  <div style={{ marginTop: 6, position: "relative", display: "inline-block" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="プレビュー"
                      style={{ maxWidth: 120, maxHeight: 90, borderRadius: 6, objectFit: "cover", border: "1px solid #e2e8f0" }} />
                    <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                      style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "white", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>✕</button>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              {!rec.arrive && (
                <button className="btn-primary" onClick={() => handleArrive(selChild)} disabled={uploading}>
                  {uploading ? "保存中..." : "🟢 入室記録"}
                </button>
              )}
              {rec.arrive && !rec.depart && (
                <button
                  className="btn-primary"
                  onClick={() => handleDepart(selChild)}
                  style={{ background: "#059669" }}
                >
                  🏠 退出記録
                </button>
              )}
              <button className="btn-secondary" onClick={() => { setSelChild(null); setPhotoFile(null); setPhotoPreview(null); }}>
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
              <th>入室時刻</th>
              <th>退出時刻</th>
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
                      {/* 来所写真サムネイル */}
                      {rec.photo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={rec.photo_url} alt="来所写真"
                          style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", border: "1px solid #e2e8f0" }} />
                      )}
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
                        {rec.arrive ? "退出" : "入室"}
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
