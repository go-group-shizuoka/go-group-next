"use client";
// ==================== 管理画面 ====================
// 施設管理・職員管理・児童登録

import { useState } from "react";
import { DUMMY_FACILITIES, DUMMY_STAFF, DUMMY_CHILDREN } from "@/lib/dummy-data";
import { saveRecord } from "@/lib/supabase";
import type { UserSession, Child } from "@/types";
import { useSession } from "@/hooks/useSession";

type Tab = "facility" | "staff" | "children";

// 職員型
type StaffMember = {
  id: string; org_id: string; facility_id: string;
  name: string; role: "admin" | "manager" | "staff";
  login_id: string; created_at: string;
};

const EMPTY_STAFF = {
  name: "", role: "staff" as "admin" | "manager" | "staff",
  login_id: "", facility_id: "",
};

function genId() { return crypto.randomUUID(); }

const EMPTY_CHILD = {
  name: "", name_kana: "", dob: "", grade: "", gender: "" as "" | "男" | "女",
  diagnosis: "", use_days: [] as string[], has_transport: false,
  parent_name: "", parent_phone: "", notes: "", support_content: "",
  facility_id: "",
};

const DOW_OPTIONS = ["月", "火", "水", "木", "金", "土"];
const GRADE_OPTIONS = ["未就学", "年少", "年中", "年長", "小1", "小2", "小3", "小4", "小5", "小6", "中1", "中2", "中3"];

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 };

export default function AdminPage() {
  const session = useSession();
  const [tab, setTab] = useState<Tab>("children");
  const [children, setChildren] = useState<Child[]>(DUMMY_CHILDREN);
  const [showChildForm, setShowChildForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_CHILD });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 職員管理用state
  const [staffList, setStaffList] = useState<StaffMember[]>(
    DUMMY_STAFF.map((s) => ({
      id: s.id, org_id: s.org_id, facility_id: s.facility_id,
      name: s.name, role: s.role, login_id: s.id,
      created_at: new Date().toISOString(),
    }))
  );
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffForm, setStaffForm] = useState({ ...EMPTY_STAFF });
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffSaved, setStaffSaved] = useState(false);

  if (!session) return null;

  // 管理者または管理者ロールのみアクセス可
  // staffは閲覧のみ（フォームを隠す）
  const isManager = session.role === "admin" || session.role === "manager";

  // 職員登録
  const handleSaveStaff = async () => {
    if (!staffForm.name.trim() || !staffForm.login_id.trim() || !staffForm.facility_id) return;
    setStaffSaving(true);
    const staff: StaffMember = {
      id: genId(),
      org_id: session!.org_id,
      facility_id: staffForm.facility_id || session!.selected_facility_id,
      name: staffForm.name.trim(),
      role: staffForm.role,
      login_id: staffForm.login_id.trim(),
      created_at: new Date().toISOString(),
    };
    await saveRecord("ng_staff", staff as unknown as Record<string, unknown>);
    setStaffList((prev) => [staff, ...prev]);
    setStaffForm({ ...EMPTY_STAFF });
    setShowStaffForm(false);
    setStaffSaving(false);
    setStaffSaved(true);
    setTimeout(() => setStaffSaved(false), 3000);
  };

  const handleDayToggle = (day: string) => {
    setForm((prev) => ({
      ...prev,
      use_days: prev.use_days.includes(day)
        ? prev.use_days.filter((d) => d !== day)
        : [...prev.use_days, day],
    }));
  };

  const handleSaveChild = async () => {
    if (!form.name.trim() || !form.dob || !form.facility_id) return;
    setSaving(true);
    const child: Child = {
      id: genId(),
      org_id: session.org_id,
      facility_id: form.facility_id || session.selected_facility_id,
      name: form.name,
      name_kana: form.name_kana || undefined,
      dob: form.dob,
      grade: form.grade || undefined,
      gender: (form.gender as "男" | "女") || undefined,
      diagnosis: form.diagnosis || undefined,
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
    setChildren((prev) => [child, ...prev]);
    setForm({ ...EMPTY_CHILD });
    setShowChildForm(false);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>⚙️ 管理画面</h1>
        <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>GO GROUP システム管理</p>
      </div>

      {/* タブ */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #e2e8f0" }}>
        {([
          { key: "children", label: "👦 児童管理" },
          { key: "staff", label: "👥 職員管理" },
          { key: "facility", label: "🏢 施設情報" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 20px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              background: "transparent", borderBottom: tab === t.key ? "3px solid #0077b6" : "3px solid transparent",
              color: tab === t.key ? "#0077b6" : "#64748b", marginBottom: -2, transition: "all 0.15s",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== 児童管理 ===== */}
      {tab === "children" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
              登録児童数：{children.length}名
            </div>
            {isManager && (
              <button className="btn-primary" onClick={() => { setShowChildForm(!showChildForm); setForm({ ...EMPTY_CHILD, facility_id: session.selected_facility_id }); }}>
                ＋ 新規登録
              </button>
            )}
          </div>

          {/* 保存完了メッセージ */}
          {saved && (
            <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#166534", fontWeight: 600 }}>
              ✅ 登録が完了しました。Supabaseに保存しました。
            </div>
          )}

          {/* 新規登録フォーム */}
          {showChildForm && isManager && (
            <div className="card" style={{ padding: 24, marginBottom: 20, border: "2px solid #0077b6" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20, color: "#0077b6" }}>📝 新規児童登録</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* 氏名 */}
                <div>
                  <label style={labelStyle}>氏名 *</label>
                  <input className="form-input" placeholder="山田 太郎" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>氏名（ふりがな）</label>
                  <input className="form-input" placeholder="やまだ たろう" value={form.name_kana} onChange={(e) => setForm(p => ({ ...p, name_kana: e.target.value }))} />
                </div>

                {/* 生年月日・学年 */}
                <div>
                  <label style={labelStyle}>生年月日 *</label>
                  <input className="form-input" type="date" value={form.dob} onChange={(e) => setForm(p => ({ ...p, dob: e.target.value }))} />
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
                  <input className="form-input" placeholder="例：自閉スペクトラム症" value={form.diagnosis} onChange={(e) => setForm(p => ({ ...p, diagnosis: e.target.value }))} />
                </div>

                {/* 施設 */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>所属施設 *</label>
                  <select className="form-input" value={form.facility_id} onChange={(e) => setForm(p => ({ ...p, facility_id: e.target.value }))}>
                    <option value="">選択してください</option>
                    {DUMMY_FACILITIES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>

                {/* 利用曜日 */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>利用曜日</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {DOW_OPTIONS.map((d) => (
                      <button key={d}
                        type="button"
                        onClick={() => handleDayToggle(d)}
                        style={{
                          width: 40, height: 40, borderRadius: 8, border: "2px solid", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit", transition: "all 0.15s",
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
                    <input type="checkbox" checked={form.has_transport} onChange={(e) => setForm(p => ({ ...p, has_transport: e.target.checked }))} style={{ width: 16, height: 16 }} />
                    送迎あり
                  </label>
                </div>

                {/* 保護者情報 */}
                <div>
                  <label style={labelStyle}>保護者氏名</label>
                  <input className="form-input" placeholder="山田 花子" value={form.parent_name} onChange={(e) => setForm(p => ({ ...p, parent_name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>保護者電話番号</label>
                  <input className="form-input" placeholder="000-0000-0000" value={form.parent_phone} onChange={(e) => setForm(p => ({ ...p, parent_phone: e.target.value }))} />
                </div>

                {/* 注意事項・支援内容 */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>注意事項</label>
                  <textarea className="form-input" style={{ minHeight: 72, resize: "vertical" }} placeholder="支援時の注意点など" value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>支援内容</label>
                  <textarea className="form-input" style={{ minHeight: 72, resize: "vertical" }} placeholder="個別支援の内容など" value={form.support_content} onChange={(e) => setForm(p => ({ ...p, support_content: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button className="btn-primary"
                  onClick={handleSaveChild}
                  disabled={saving || !form.name.trim() || !form.dob || !form.facility_id}
                  style={{ minWidth: 100 }}>
                  {saving ? "保存中..." : "登録する"}
                </button>
                <button className="btn-secondary" onClick={() => setShowChildForm(false)}>キャンセル</button>
              </div>
            </div>
          )}

          {/* 児童一覧 */}
          <div className="card" style={{ overflow: "hidden", padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>学年</th>
                  <th>診断</th>
                  <th>利用曜日</th>
                  <th>施設</th>
                  <th>送迎</th>
                  <th>状態</th>
                </tr>
              </thead>
              <tbody>
                {children.map((c) => {
                  const fac = DUMMY_FACILITIES.find((f) => f.id === c.facility_id);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{c.name_kana}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{c.grade ?? "—"}</td>
                      <td style={{ fontSize: 12 }}>{c.diagnosis ?? "—"}</td>
                      <td style={{ fontSize: 12 }}>{c.use_days?.join("・") || "—"}</td>
                      <td style={{ fontSize: 12 }}>{fac?.name ?? "—"}</td>
                      <td>{c.has_transport ? <span className="badge badge-blue">🚌</span> : <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>}</td>
                      <td>
                        <span className={`badge ${c.active ? "badge-green" : "badge-gray"}`}>
                          {c.active ? "在籍" : "退所"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== 職員管理 ===== */}
      {tab === "staff" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>登録職員数：{staffList.length}名</div>
            {isManager && (
              <button className="btn-primary" onClick={() => { setShowStaffForm(!showStaffForm); setStaffForm({ ...EMPTY_STAFF, facility_id: session.selected_facility_id }); }}>
                ＋ 職員追加
              </button>
            )}
          </div>

          {staffSaved && (
            <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#166534", fontWeight: 600 }}>
              ✅ 職員を登録しました。
            </div>
          )}

          {/* 職員追加フォーム */}
          {showStaffForm && isManager && (
            <div className="card" style={{ padding: 24, marginBottom: 20, border: "2px solid #0077b6" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20, color: "#0077b6" }}>👥 職員追加</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>氏名 *</label>
                  <input className="form-input" placeholder="田中 美穂" value={staffForm.name} onChange={(e) => setStaffForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>ログインID *</label>
                  <input className="form-input" placeholder="例: tanaka_m" value={staffForm.login_id} onChange={(e) => setStaffForm(p => ({ ...p, login_id: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>役割</label>
                  <select className="form-input" value={staffForm.role} onChange={(e) => setStaffForm(p => ({ ...p, role: e.target.value as "admin" | "manager" | "staff" }))}>
                    <option value="staff">職員</option>
                    <option value="manager">管理者（施設長）</option>
                    <option value="admin">本部管理者</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>所属施設 *</label>
                  <select className="form-input" value={staffForm.facility_id} onChange={(e) => setStaffForm(p => ({ ...p, facility_id: e.target.value }))}>
                    <option value="">選択してください</option>
                    {DUMMY_FACILITIES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button className="btn-primary" onClick={handleSaveStaff}
                  disabled={staffSaving || !staffForm.name.trim() || !staffForm.login_id.trim() || !staffForm.facility_id}
                  style={{ minWidth: 100 }}>
                  {staffSaving ? "保存中..." : "登録する"}
                </button>
                <button className="btn-secondary" onClick={() => setShowStaffForm(false)}>キャンセル</button>
              </div>
            </div>
          )}

          <div className="card" style={{ overflow: "hidden", padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>ログインID</th>
                  <th>役割</th>
                  <th>所属施設</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s) => {
                  const fac = DUMMY_FACILITIES.find((f) => f.id === s.facility_id);
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</td>
                      <td style={{ fontSize: 12, color: "#64748b" }}>{s.login_id}</td>
                      <td>
                        <span className={`badge ${s.role === "admin" ? "badge-red" : s.role === "manager" ? "badge-blue" : "badge-green"}`}>
                          {s.role === "admin" ? "本部管理者" : s.role === "manager" ? "管理者" : "職員"}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{fac?.name ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== 施設情報 ===== */}
      {tab === "facility" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {DUMMY_FACILITIES.map((f) => {
            const staffCount = DUMMY_STAFF.filter((s) => s.facility_id === f.id).length;
            const childCount = DUMMY_CHILDREN.filter((c) => c.facility_id === f.id && c.active).length;
            return (
              <div key={f.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#0a2540" }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{f.service_type}</div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#0077b6" }}>{f.capacity ?? "—"}</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>定員</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#059669" }}>{childCount}</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>在籍</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#6366f1" }}>{staffCount}</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>職員</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <p style={{ fontSize: 11, color: "#94a3b8" }}>※ 施設情報の編集機能は近日実装予定です。</p>
        </div>
      )}
    </div>
  );
}
