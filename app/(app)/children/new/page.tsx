"use client";
// ==================== 児童新規登録 ====================
// /children/new へのアクセスで表示する新規登録フォーム

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DUMMY_FACILITIES } from "@/lib/dummy-data";
import { saveRecord } from "@/lib/supabase";
import type { UserSession, Child } from "@/types";
import { useSession } from "@/hooks/useSession";

function genId() { return crypto.randomUUID(); }

const DOW_OPTIONS = ["月", "火", "水", "木", "金", "土"];
const GRADE_OPTIONS = [
  "未就学", "年少", "年中", "年長",
  "小1", "小2", "小3", "小4", "小5", "小6",
  "中1", "中2", "中3",
];

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4,
};

const EMPTY_FORM = {
  name: "", name_kana: "", dob: "", grade: "",
  gender: "" as "" | "男" | "女",
  diagnosis: "", school: "",
  use_days: [] as string[],
  has_transport: false,
  parent_name: "", parent_phone: "",
  notes: "", support_content: "",
  facility_id: "",
};

export default function ChildrenNewPage() {
  const router = useRouter();
  const session = useSession();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // セッションが確定したら所属施設をデフォルト設定
  useEffect(() => {
    if (session) {
      setForm((prev) => ({ ...prev, facility_id: session.selected_facility_id }));
    }
  }, [session]);

  if (!session) return null;

  const handleDayToggle = (day: string) => {
    setForm((prev) => ({
      ...prev,
      use_days: prev.use_days.includes(day)
        ? prev.use_days.filter((d) => d !== day)
        : [...prev.use_days, day],
    }));
  };

  const validate = () => {
    const errs: string[] = [];
    if (!form.name.trim()) errs.push("氏名を入力してください");
    if (!form.dob) errs.push("生年月日を入力してください");
    if (!form.facility_id) errs.push("所属施設を選択してください");
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setSaving(true);
    const child: Child = {
      id: genId(),
      org_id: session.org_id,
      facility_id: form.facility_id,
      name: form.name.trim(),
      name_kana: form.name_kana || undefined,
      dob: form.dob,
      grade: form.grade || undefined,
      gender: (form.gender as "男" | "女") || undefined,
      diagnosis: form.diagnosis || undefined,
      school: form.school || undefined,
      use_days: form.use_days,
      has_transport: form.has_transport,
      parent_name: form.parent_name || undefined,
      parent_phone: form.parent_phone || undefined,
      notes: form.notes || undefined,
      support_content: form.support_content || undefined,
      active: true,
      created_at: new Date().toISOString(),
    };
    await saveRecord("ng_children", child as unknown as Record<string, unknown>);
    setSaving(false);
    router.push("/children");
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.back()}
          style={{ color: "#0077b6", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}
        >
          ← 戻る
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>
          👦 児童新規登録
        </h1>
      </div>

      {/* エラー表示 */}
      {errors.length > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
          {errors.map((e, i) => (
            <div key={i} style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>⚠️ {e}</div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* 氏名 */}
          <div>
            <label style={labelStyle}>氏名 <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="form-input" placeholder="山田 太郎"
              value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>氏名（ふりがな）</label>
            <input className="form-input" placeholder="やまだ たろう"
              value={form.name_kana} onChange={(e) => setForm(p => ({ ...p, name_kana: e.target.value }))} />
          </div>

          {/* 生年月日・学年 */}
          <div>
            <label style={labelStyle}>生年月日 <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="form-input" type="date"
              value={form.dob} onChange={(e) => setForm(p => ({ ...p, dob: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>学年</label>
            <select className="form-input" value={form.grade} onChange={(e) => setForm(p => ({ ...p, grade: e.target.value }))}>
              <option value="">選択</option>
              {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* 性別・診断名 */}
          <div>
            <label style={labelStyle}>性別</label>
            <select className="form-input" value={form.gender} onChange={(e) => setForm(p => ({ ...p, gender: e.target.value as "" | "男" | "女" }))}>
              <option value="">選択</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>診断名</label>
            <input className="form-input" placeholder="例：自閉スペクトラム症"
              value={form.diagnosis} onChange={(e) => setForm(p => ({ ...p, diagnosis: e.target.value }))} />
          </div>

          {/* 学校名 */}
          <div>
            <label style={labelStyle}>学校名</label>
            <input className="form-input" placeholder="例：○○小学校"
              value={form.school} onChange={(e) => setForm(p => ({ ...p, school: e.target.value }))} />
          </div>
          <div>{/* スペーサー */}</div>

          {/* 所属施設 */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>所属施設 <span style={{ color: "#ef4444" }}>*</span></label>
            <select className="form-input" value={form.facility_id} onChange={(e) => setForm(p => ({ ...p, facility_id: e.target.value }))}>
              <option value="">選択してください</option>
              {DUMMY_FACILITIES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          {/* 利用曜日 */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>利用曜日</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DOW_OPTIONS.map((d) => (
                <button key={d} type="button" onClick={() => handleDayToggle(d)}
                  style={{
                    width: 44, height: 44, borderRadius: 8, border: "2px solid",
                    cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit",
                    transition: "all 0.15s",
                    background: form.use_days.includes(d) ? "#0077b6" : "white",
                    borderColor: form.use_days.includes(d) ? "#0077b6" : "#e2e8f0",
                    color: form.use_days.includes(d) ? "white" : "#64748b",
                  }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* 送迎 */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              <input type="checkbox" checked={form.has_transport}
                onChange={(e) => setForm(p => ({ ...p, has_transport: e.target.checked }))}
                style={{ width: 16, height: 16 }} />
              🚌 送迎あり
            </label>
          </div>

          {/* 保護者情報 */}
          <div>
            <label style={labelStyle}>保護者氏名</label>
            <input className="form-input" placeholder="山田 花子"
              value={form.parent_name} onChange={(e) => setForm(p => ({ ...p, parent_name: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>保護者電話番号</label>
            <input className="form-input" type="tel" placeholder="000-0000-0000"
              value={form.parent_phone} onChange={(e) => setForm(p => ({ ...p, parent_phone: e.target.value }))} />
          </div>

          {/* 注意事項・支援内容 */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>注意事項</label>
            <textarea className="form-input" style={{ minHeight: 80, resize: "vertical" }}
              placeholder="支援時の注意点など"
              value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>支援内容</label>
            <textarea className="form-input" style={{ minHeight: 80, resize: "vertical" }}
              placeholder="個別支援の内容など"
              value={form.support_content} onChange={(e) => setForm(p => ({ ...p, support_content: e.target.value }))} />
          </div>
        </div>

        {/* ボタン */}
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving}
            style={{ minWidth: 120 }}>
            {saving ? "保存中..." : "✅ 登録する"}
          </button>
          <button className="btn-secondary" onClick={() => router.back()}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
