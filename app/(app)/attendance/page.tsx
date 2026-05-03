"use client";
// ==================== 入退室記録 ====================
// 日付選択対応・過去/未来の記録閲覧＆編集が可能

import { useState, useEffect, useCallback } from "react";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { saveRecord, fetchByDate, fetchChildren, uploadPhoto } from "@/lib/supabase";
import type { AttendanceRecord, Child } from "@/types";
import { useSession } from "@/hooks/useSession";
import { todayISO, DOW } from "@/lib/utils";
import { xlsBorder } from "@/lib/excel-style";

function dateToYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return dateToYMD(d);
}
function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const dow = DOW[d.getDay()];
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}（${dow}）`;
}
function getDow(dateStr: string) {
  return DOW[new Date(dateStr + "T00:00:00").getDay()];
}
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type RecMap = Record<string, { arrive?: string; depart?: string; temp?: string; photo_url?: string }>;

export default function AttendancePage() {
  const session = useSession();
  const [selDate, setSelDate] = useState(todayISO());
  const [records, setRecords] = useState<RecMap>({});
  const [editChild, setEditChild] = useState<string | null>(null);
  const [editArrive, setEditArrive] = useState("");
  const [editDepart, setEditDepart] = useState("");
  const [editTemp, setEditTemp] = useState("");
  const [loadingDB, setLoadingDB] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dbChildren, setDbChildren] = useState<Child[]>([]);

  // 児童リストを初回ロード
  useEffect(() => {
    if (!session) return;
    fetchChildren(session.org_id, session.selected_facility_id).then((rows) => {
      if (rows.length > 0) setDbChildren(rows.filter((c) => c.active));
    });
  }, [session]);

  // 選択日の入退室記録をロード
  const loadRecords = useCallback(async () => {
    if (!session) return;
    setLoadingDB(true);
    const rows = await fetchByDate<AttendanceRecord>(
      "ng_attendance", session.org_id, session.selected_facility_id, selDate
    );
    const map: RecMap = {};
    rows.forEach((r) => {
      map[r.child_id] = {
        arrive: r.arrive_time ?? undefined,
        depart: r.depart_time ?? undefined,
        temp: r.temperature ?? undefined,
        photo_url: r.photo_url ?? undefined,
      };
    });
    setRecords(map);
    setLoadingDB(false);
  }, [session, selDate]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  if (!session) return null;

  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);
  const dow = getDow(selDate);
  const allChildren = dbChildren.length > 0
    ? dbChildren
    : DUMMY_CHILDREN.filter((c) => c.active && c.facility_id === session.selected_facility_id);

  // その日の利用予定児童 ＋ 記録がある児童（予定外でも表示）
  const scheduledIds = new Set(allChildren.filter((c) => (c.use_days ?? []).includes(dow)).map((c) => c.id));
  const recordedIds = new Set(Object.keys(records));
  const displayChildren = allChildren.filter((c) => scheduledIds.has(c.id) || recordedIds.has(c.id));

  // 編集パネルを開く
  const openEdit = (childId: string) => {
    const rec = records[childId] ?? {};
    setEditChild(childId);
    setEditArrive(rec.arrive ?? nowHHMM());
    setEditDepart(rec.depart ?? "");
    setEditTemp(rec.temp && rec.temp !== "—" ? rec.temp : "");
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  // 記録を保存（arrive/departどちらか片方でもOK）
  const handleSave = async (childId: string) => {
    const child = allChildren.find((c) => c.id === childId);
    setUploading(true);

    let photoUrl: string | undefined = records[childId]?.photo_url;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop();
      const path = `attendance/${session!.org_id}/${selDate}_${childId}.${ext}`;
      const url = await uploadPhoto(photoFile, path);
      if (url) photoUrl = url;
    }

    const rec: AttendanceRecord = {
      id: `${childId}_${selDate}`,
      org_id: session!.org_id,
      facility_id: session!.selected_facility_id,
      child_id: childId,
      child_name: child?.name ?? "",
      date: selDate,
      arrive_time: editArrive || undefined,
      depart_time: editDepart || undefined,
      temperature: editTemp || undefined,
      transport_to: child?.has_transport ?? false,
      status: "来所",
      photo_url: photoUrl,
      recorded_by: session!.name,
      created_at: new Date().toISOString(),
    };
    await saveRecord("ng_attendance", rec as unknown as Record<string, unknown>);
    setRecords((prev) => ({
      ...prev,
      [childId]: { arrive: editArrive, depart: editDepart, temp: editTemp || undefined, photo_url: photoUrl },
    }));
    setEditChild(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setUploading(false);
  };

  // Excel出力
  const exportExcel = async () => {
    const XLSXStyle = (await import("xlsx-js-style")).default;
    const bd = xlsBorder;
    const COLS = ["A","B","C","D","E","F","G"];
    const colWidths = [{ wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws: Record<string, any> = {};
    const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    ws["A1"] = {
      v: `${fac?.name}　入退室記録　${selDate}`, t: "s",
      s: { font: { bold: true, sz: 13, color: { rgb: "0A2540" } }, alignment: { horizontal: "center", vertical: "center" } },
    };
    const headers = ["氏名", "学年", "入室時刻", "退出時刻", "体温（℃）", "状態", "送迎"];
    headers.forEach((h, i) => {
      ws[`${COLS[i]}2`] = {
        v: h, t: "s",
        s: { fill: { patternType: "solid", fgColor: { rgb: "0A2540" } }, font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 }, alignment: { horizontal: "center", vertical: "center" }, border: bd },
      };
    });
    displayChildren.forEach((child, rowIdx) => {
      const rec = records[child.id];
      const rowNum = rowIdx + 3;
      const bgRgb = rowIdx % 2 === 0 ? "F8FAFC" : "FFFFFF";
      const status = rec?.depart ? "退所済" : rec?.arrive ? "来所中" : "未来所";
      const statusRgb = rec?.depart ? "94A3B8" : rec?.arrive ? "059669" : "F59E0B";
      const values = [child.name, child.grade ?? "", rec?.arrive ?? "", rec?.depart ?? "", rec?.temp ?? "", status, child.has_transport ? "あり" : "—"];
      values.forEach((v, i) => {
        let fontRgb = "374151";
        if (i === 2 && rec?.arrive) fontRgb = "059669";
        else if (i === 3 && rec?.depart) fontRgb = "0077B6";
        else if (i === 5) fontRgb = statusRgb;
        ws[`${COLS[i]}${rowNum}`] = { v, t: "s", s: { font: { bold: i === 0 || [2,3,5].includes(i), sz: 10, color: { rgb: fontRgb } }, alignment: { horizontal: i === 0 ? "left" : "center", vertical: "center" }, border: bd, fill: { patternType: "solid", fgColor: { rgb: bgRgb } } } };
      });
    });
    const lastRow = displayChildren.length + 2;
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
    a.download = `入退室記録_${fac?.name}_${selDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>📋 入退室記録</h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{fac?.name}</p>
        </div>
        <button className="btn-secondary" onClick={exportExcel} style={{ fontSize: 12, padding: "7px 14px" }}>
          📊 Excel出力
        </button>
      </div>

      {/* 日付ナビ */}
      <div className="card" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button className="btn-secondary" onClick={() => setSelDate(d => addDays(d, -1))} style={{ padding: "6px 14px", fontSize: 13 }}>
          ‹ 前日
        </button>
        <input
          type="date"
          className="form-input"
          value={selDate}
          onChange={(e) => setSelDate(e.target.value)}
          style={{ width: "auto", flex: "0 0 auto" }}
        />
        <button className="btn-secondary" onClick={() => setSelDate(todayISO())} style={{ padding: "6px 12px", fontSize: 12 }}>
          今日
        </button>
        <button className="btn-secondary" onClick={() => setSelDate(d => addDays(d, 1))} style={{ padding: "6px 14px", fontSize: 13 }}>
          翌日 ›
        </button>
        <div style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#0a2540" }}>
          {formatDate(selDate)}　<span style={{ color: "#0077b6" }}>{displayChildren.length}名</span>
        </div>
      </div>

      {loadingDB ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><span className="spinner" /></div>
      ) : (
        <>
          {/* 編集パネル */}
          {editChild && (() => {
            const child = allChildren.find((c) => c.id === editChild)!;
            const rec = records[editChild] ?? {};
            return (
              <div className="card" style={{ padding: 20, marginBottom: 16, border: "2px solid #0077b6" }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>✏️ {child.name} の記録</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>来所時刻</label>
                    <input className="form-input" type="time" value={editArrive} onChange={(e) => setEditArrive(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>退所時刻</label>
                    <input className="form-input" type="time" value={editDepart} onChange={(e) => setEditDepart(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>体温 (℃)</label>
                    <input className="form-input" type="number" step="0.1" placeholder="36.5" value={editTemp} onChange={(e) => setEditTemp(e.target.value)} />
                  </div>
                </div>
                {/* 写真アップロード（来所記録がまだない場合） */}
                {!rec.arrive && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>📷 来所時の写真（任意）</label>
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
                        <img src={photoPreview} alt="プレビュー" style={{ maxWidth: 120, maxHeight: 90, borderRadius: 6, objectFit: "cover", border: "1px solid #e2e8f0" }} />
                        <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                          style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "white", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>✕</button>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" onClick={() => handleSave(editChild)} disabled={uploading || (!editArrive && !editDepart)}>
                    {uploading ? "保存中..." : "💾 保存する"}
                  </button>
                  <button className="btn-secondary" onClick={() => { setEditChild(null); setPhotoFile(null); setPhotoPreview(null); }}>
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
                {displayChildren.map((child) => {
                  const rec = records[child.id] ?? {};
                  const isRecorded = !!rec.arrive || !!rec.depart;
                  const status = rec.depart ? "退所済" : rec.arrive ? "来所中" : "未記録";
                  const statusColor = rec.depart ? "#94a3b8" : rec.arrive ? "#059669" : "#e2e8f0";
                  const isExtra = !scheduledIds.has(child.id); // 予定外児童

                  return (
                    <tr key={child.id} style={{ background: isExtra ? "#fffbeb" : undefined }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: "50%",
                            background: "linear-gradient(135deg,#0077b6,#00b4d8)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "white", fontSize: 12, fontWeight: 700, flexShrink: 0,
                          }}>
                            {child.name.slice(0, 1)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{child.name}</div>
                            <div style={{ fontSize: 10, color: "#94a3b8" }}>
                              {child.grade}{isExtra ? " ・スポット" : ""}
                            </div>
                          </div>
                          {rec.photo_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={rec.photo_url} alt="来所写真" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", border: "1px solid #e2e8f0" }} />
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
                        {child.has_transport
                          ? <span className="badge badge-blue">🚌</span>
                          : <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          {isRecorded && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                              background: statusColor, color: rec.depart ? "#64748b" : rec.arrive ? "#065f46" : "#94a3b8",
                            }}>
                              {status}
                            </span>
                          )}
                          <button
                            className="btn-primary"
                            onClick={() => openEdit(child.id)}
                            style={{ padding: "5px 12px", fontSize: 12, background: isRecorded ? "#64748b" : "#0077b6" }}
                          >
                            {isRecorded ? "編集" : "記録"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {displayChildren.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: 13 }}>
                {dow}曜日の来所予定はありません
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
