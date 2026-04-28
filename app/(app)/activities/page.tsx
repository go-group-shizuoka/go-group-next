"use client";
// ==================== 活動記録 ====================

import { useState, useEffect } from "react";
import { DUMMY_FACILITIES } from "@/lib/dummy-data";
import { saveRecord, fetchByDate, uploadPhoto } from "@/lib/supabase";
import type { UserSession, ActivityRecord } from "@/types";
import { useSession } from "@/hooks/useSession";
import { todayISO } from "@/lib/utils";

const ACTIVITY_TYPES = [
  "個別支援","集団療育","運動療育","言語療育",
  "学習支援","リハビリ","外出支援","イベント","制作活動","その他",
];

function genId() {
  return crypto.randomUUID();
}

export default function ActivitiesPage() {
  const session = useSession();
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loadingDB, setLoadingDB] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    activity_type: "集団療育",
    visible_to_parent: true,
  });

  // Supabaseから本日の活動記録を読み込む
  useEffect(() => {
    if (!session) return;
    setLoadingDB(true);
    fetchByDate<ActivityRecord>(
      "ng_activities",
      session.org_id,
      session.selected_facility_id,
      todayISO()
    ).then((rows) => {
      if (rows.length > 0) setActivities(rows);
      setLoadingDB(false);
    });
  }, [session]);

  if (!session) return null;
  if (loadingDB) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <span className="spinner" />
    </div>
  );

  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setUploading(true);

    // 写真アップロード
    let photoUrl: string | undefined;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop();
      const path = `activities/${session.org_id}/${todayISO()}_${genId()}.${ext}`;
      const url = await uploadPhoto(photoFile, path);
      if (url) photoUrl = url;
    }

    const record: ActivityRecord = {
      id: genId(),
      org_id: session.org_id,
      facility_id: session.selected_facility_id,
      date: todayISO(),
      title: form.title,
      content: form.content,
      activity_type: form.activity_type,
      photo_url: photoUrl,
      visible_to_parent: form.visible_to_parent,
      created_by: session.name,
      created_at: new Date().toISOString(),
    };
    await saveRecord("ng_activities", record as unknown as Record<string, unknown>);
    setActivities((prev) => [record, ...prev]);
    setForm({ title: "", content: "", activity_type: "集団療育", visible_to_parent: true });
    setPhotoFile(null);
    setPhotoPreview(null);
    setShowForm(false);
    setUploading(false);
  };

  // 写真選択ハンドラ
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  return (
    <div>
      {/* ヘッダー */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>
            📸 活動記録
          </h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
            {fac?.name} ／ {todayISO()}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          ＋ 活動を記録
        </button>
      </div>

      {/* 入力フォーム */}
      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 20, border: "2px solid #0077b6" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>📝 新規活動記録</div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
              活動タイトル *
            </label>
            <input
              className="form-input"
              placeholder="例: 運動遊び・創作活動"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
              活動種別
            </label>
            <select
              className="form-input"
              value={form.activity_type}
              onChange={(e) => setForm((p) => ({ ...p, activity_type: e.target.value }))}
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
              活動内容 *
            </label>
            <textarea
              className="form-input"
              style={{ minHeight: 100, resize: "vertical" }}
              placeholder="活動の内容・子どもたちの様子を記録してください"
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            />
          </div>

          {/* 写真アップロード */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
              📷 写真（任意）
            </label>
            <input type="file" accept="image/*" onChange={handlePhotoChange}
              style={{ fontSize: 13, color: "#475569" }} />
            {photoPreview && (
              <div style={{ marginTop: 8, position: "relative", display: "inline-block" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="プレビュー"
                  style={{ maxWidth: 200, maxHeight: 150, borderRadius: 8, objectFit: "cover", border: "1px solid #e2e8f0" }} />
                <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                  style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "white", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={form.visible_to_parent}
                onChange={(e) => setForm((p) => ({ ...p, visible_to_parent: e.target.checked }))}
                style={{ width: 16, height: 16 }} />
              保護者向けに表示する
            </label>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={handleSave}
              disabled={!form.title.trim() || !form.content.trim() || uploading}>
              {uploading ? "保存中..." : "保存する"}
            </button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setPhotoFile(null); setPhotoPreview(null); }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 活動記録リスト */}
      {activities.length === 0 ? (
        <div
          className="card"
          style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
          本日の活動記録はありません
          <br />
          <button
            className="btn-primary"
            onClick={() => setShowForm(true)}
            style={{ marginTop: 16 }}
          >
            ＋ 最初の活動を記録する
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {activities.map((act) => (
            <div key={act.id} className="card" style={{ padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#0a2540" }}>
                    {act.title}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <span className="badge badge-blue">{act.activity_type}</span>
                    {act.visible_to_parent && (
                      <span className="badge badge-green">👨‍👩‍👧 保護者表示</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right" }}>
                  <div>{act.date}</div>
                  <div>{act.created_by}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
                {act.content}
              </div>
              {act.photo_url && (
                <div style={{ marginTop: 10 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={act.photo_url} alt="活動写真"
                    style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8, objectFit: "cover", border: "1px solid #e2e8f0" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
