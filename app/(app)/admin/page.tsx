"use client";
// ==================== 管理画面 ====================
// 施設管理・職員管理・児童登録

import { useState, useEffect } from "react";
import { DUMMY_FACILITIES, DUMMY_STAFF, DUMMY_CHILDREN } from "@/lib/dummy-data";
import { saveRecord, fetchByOrg, deleteRecord, normalizeChild, toStringArray } from "@/lib/supabase";
import type { UserSession, Child } from "@/types";
import { useSession } from "@/hooks/useSession";

type Tab = "facility" | "staff" | "children";

// 保有資格の選択肢
const QUALIFICATION_OPTIONS = [
  "保育士", "児童指導員", "児童指導員（５年以上）", "児童発達支援管理責任者",
  "社会福祉士", "精神保健福祉士", "公認心理師", "臨床心理士",
  "作業療法士", "理学療法士", "言語聴覚士", "看護師", "介護福祉士",
];

// 職員型
type StaffMember = {
  id: string; org_id: string; facility_id: string;
  name: string; role: "admin" | "manager" | "staff";
  login_id?: string; email?: string; created_at: string;
  phone?: string;
  employment_type?: string;
  qualifications?: string[];
  hire_date?: string;
  emergency_contact?: string;
};

// emailからlogin_idを取得（例: tanaka_m@go-group-sys.app → tanaka_m）
function getLoginId(s: StaffMember): string {
  if (s.login_id) return s.login_id;
  if (s.email) return s.email.replace(/@go-group-sys\.app$/, "");
  return s.id.slice(0, 8);
}

const EMPTY_STAFF = {
  name: "", role: "staff" as "admin" | "manager" | "staff",
  login_id: "", password: "", facility_id: "",
  phone: "", employment_type: "正社員", qualifications: [] as string[],
  hire_date: "", emergency_contact: "",
};

function genId() { return crypto.randomUUID(); }

// 覚えやすい初期パスワードを生成（英小文字+数字 8文字）
function genPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // 紛らわしい文字を除外
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

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
  const [children, setChildren] = useState<Child[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [showChildForm, setShowChildForm] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_CHILD });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 職員管理用state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({ ...EMPTY_STAFF });
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffSaved, setStaffSaved] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // 登録完了後に表示するログイン情報
  const [registeredInfo, setRegisteredInfo] = useState<{ login_id: string; password: string } | null>(null);

  // Supabaseから児童・職員を読み込む
  useEffect(() => {
    if (!session) return;
    // 児童読み込み（use_days等のJSONBフィールドを正規化）
    fetchByOrg<Child>("ng_children", session.org_id).then((rows) => {
      setChildren(rows.length > 0 ? rows.map(normalizeChild) : DUMMY_CHILDREN);
      setLoadingChildren(false);
    });
    // 職員読み込み（qualificationsのJSONBフィールドを正規化）
    fetchByOrg<StaffMember>("ng_staff", session.org_id).then((rows) => {
      if (rows.length > 0) {
        setStaffList(rows.map((s) => ({ ...s, qualifications: toStringArray(s.qualifications) })));
      } else {
        setStaffList(DUMMY_STAFF.map((s) => ({
          id: s.id, org_id: s.org_id, facility_id: s.facility_id,
          name: s.name, role: s.role, login_id: s.id,
          created_at: new Date().toISOString(),
        })));
      }
      setLoadingStaff(false);
    });
  }, [session]);

  if (!session) return null;

  // 管理者または管理者ロールのみアクセス可
  // staffは閲覧のみ（フォームを隠す）
  const isManager = session.role === "admin" || session.role === "manager";

  // 職員登録・編集（Supabase Auth + ng_staffテーブルへ登録）
  const handleSaveStaff = async () => {
    if (!staffForm.name.trim() || !staffForm.login_id.trim() || !staffForm.facility_id) return;
    // 新規登録時はパスワード必須
    if (!editingStaffId && !staffForm.password.trim()) return;
    setStaffSaving(true);
    setStaffError("");
    try {
      if (editingStaffId) {
        // ===== 編集モード =====
        // パスワードが入力されていれば変更
        if (staffForm.password.trim().length >= 8) {
          const pwRes = await fetch("/api/admin/update-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ login_id: staffForm.login_id.trim(), password: staffForm.password.trim() }),
          });
          const pwJson = await pwRes.json();
          if (!pwRes.ok || pwJson.error) {
            setStaffError(`パスワード変更エラー: ${pwJson.error}`);
            setStaffSaving(false);
            return;
          }
        }
        // ng_staffテーブルを更新
        await saveRecord("ng_staff", {
          id: editingStaffId,
          org_id: session!.org_id,
          facility_id: staffForm.facility_id,
          name: staffForm.name.trim(),
          role: staffForm.role,
          login_id: staffForm.login_id.trim(),
          phone: staffForm.phone.trim() || null,
          employment_type: staffForm.employment_type || null,
          qualifications: staffForm.qualifications.length > 0 ? staffForm.qualifications : null,
          hire_date: staffForm.hire_date || null,
          emergency_contact: staffForm.emergency_contact.trim() || null,
        });
        setStaffList((prev) => prev.map((s) => s.id === editingStaffId ? {
          ...s,
          name: staffForm.name.trim(),
          role: staffForm.role,
          facility_id: staffForm.facility_id,
          login_id: staffForm.login_id.trim(),
          phone: staffForm.phone.trim() || undefined,
          employment_type: staffForm.employment_type || undefined,
          qualifications: staffForm.qualifications,
          hire_date: staffForm.hire_date || undefined,
          emergency_contact: staffForm.emergency_contact.trim() || undefined,
        } : s));
      } else {
        // ===== 新規登録モード =====
        const res = await fetch("/api/admin/create-staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            login_id: staffForm.login_id.trim(),
            password: staffForm.password.trim(),
            name: staffForm.name.trim(),
            role: staffForm.role,
            facility_id: staffForm.facility_id || session!.selected_facility_id,
            org_id: session!.org_id,
            phone: staffForm.phone.trim() || null,
            employment_type: staffForm.employment_type || null,
            qualifications: staffForm.qualifications.length > 0 ? staffForm.qualifications : null,
            hire_date: staffForm.hire_date || null,
            emergency_contact: staffForm.emergency_contact.trim() || null,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          setStaffError(json.error ?? "登録に失敗しました");
          setStaffSaving(false);
          return;
        }
        const newStaff: StaffMember = {
          id: genId(),
          org_id: session!.org_id,
          facility_id: staffForm.facility_id || session!.selected_facility_id,
          name: staffForm.name.trim(),
          role: staffForm.role,
          login_id: staffForm.login_id.trim(),
          created_at: new Date().toISOString(),
          phone: staffForm.phone.trim() || undefined,
          employment_type: staffForm.employment_type || undefined,
          qualifications: staffForm.qualifications,
          hire_date: staffForm.hire_date || undefined,
          emergency_contact: staffForm.emergency_contact.trim() || undefined,
        };
        setStaffList((prev) => [newStaff, ...prev]);
        // 新規登録時のみログイン情報カードを表示
        setRegisteredInfo({ login_id: staffForm.login_id.trim(), password: staffForm.password.trim() });
      }
      setStaffForm({ ...EMPTY_STAFF });
      setShowPassword(false);
      setShowStaffForm(false);
      setEditingStaffId(null);
      setStaffSaved(true);
      setTimeout(() => setStaffSaved(false), 3000);
    } catch (e) {
      setStaffError(String(e));
    }
    setStaffSaving(false);
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？\nこの操作は取り消せません。`)) return;
    await deleteRecord("ng_staff", id);
    setStaffList((prev) => prev.filter((s) => s.id !== id));
  };

  const handleEditStaff = (staff: StaffMember) => {
    setStaffForm({
      name: staff.name,
      login_id: getLoginId(staff),
      password: "", // パスワードは変更時のみ入力
      role: staff.role,
      facility_id: staff.facility_id,
      phone: staff.phone ?? "",
      employment_type: staff.employment_type ?? "正社員",
      qualifications: staff.qualifications ?? [],
      hire_date: staff.hire_date ?? "",
      emergency_contact: staff.emergency_contact ?? "",
    });
    setEditingStaffId(staff.id);
    setShowStaffForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      id: editingChildId ?? genId(),
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
    if (editingChildId) {
      setChildren((prev) => prev.map((c) => c.id === editingChildId ? child : c));
    } else {
      setChildren((prev) => [child, ...prev]);
    }
    setForm({ ...EMPTY_CHILD });
    setShowChildForm(false);
    setEditingChildId(null);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleDeleteChild = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？\nこの操作は取り消せません。`)) return;
    await deleteRecord("ng_children", id);
    setChildren((prev) => prev.filter((c) => c.id !== id));
  };

  const handleEditChild = (child: Child) => {
    setForm({
      name: child.name,
      name_kana: child.name_kana ?? "",
      dob: child.dob,
      grade: child.grade ?? "",
      gender: (child.gender as "" | "男" | "女") ?? "",
      diagnosis: child.diagnosis ?? "",
      use_days: child.use_days ?? [],
      has_transport: child.has_transport ?? false,
      parent_name: child.parent_name ?? "",
      parent_phone: child.parent_phone ?? "",
      notes: child.notes ?? "",
      support_content: child.support_content ?? "",
      facility_id: child.facility_id,
    });
    setEditingChildId(child.id);
    setShowChildForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
              {loadingChildren ? "読み込み中..." : `登録児童数：${children.length}名`}
            </div>
            {isManager && (
              <button className="btn-primary" onClick={() => { setEditingChildId(null); setForm({ ...EMPTY_CHILD, facility_id: session.selected_facility_id }); setShowChildForm(true); }}>
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
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20, color: "#0077b6" }}>
                {editingChildId ? "✏️ 児童情報を編集" : "📝 新規児童登録"}
              </div>

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
                  {saving ? "保存中..." : editingChildId ? "✅ 更新する" : "登録する"}
                </button>
                <button className="btn-secondary" onClick={() => { setShowChildForm(false); setEditingChildId(null); }}>キャンセル</button>
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
                  {isManager && <th>操作</th>}
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
                      <td style={{ fontSize: 12 }}>{Array.isArray(c.use_days) && c.use_days.length > 0 ? c.use_days.join("・") : "—"}</td>
                      <td style={{ fontSize: 12 }}>{fac?.name ?? "—"}</td>
                      <td>{c.has_transport ? <span className="badge badge-blue">🚌</span> : <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>}</td>
                      <td>
                        <span className={`badge ${c.active ? "badge-green" : "badge-gray"}`}>
                          {c.active ? "在籍" : "退所"}
                        </span>
                      </td>
                      {isManager && (
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => handleEditChild(c)}
                              style={{ padding: "4px 10px", fontSize: 11, borderRadius: 6, border: "1.5px solid #0077b6", background: "white", color: "#0077b6", cursor: "pointer", fontWeight: 600 }}>
                              編集
                            </button>
                            <button onClick={() => handleDeleteChild(c.id, c.name)}
                              style={{ padding: "4px 10px", fontSize: 11, borderRadius: 6, border: "1.5px solid #ef4444", background: "white", color: "#ef4444", cursor: "pointer", fontWeight: 600 }}>
                              削除
                            </button>
                          </div>
                        </td>
                      )}
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
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
              {loadingStaff ? "読み込み中..." : `登録職員数：${staffList.length}名`}
            </div>
            {isManager && (
              <button className="btn-primary" onClick={() => { setEditingStaffId(null); setStaffForm({ ...EMPTY_STAFF, facility_id: session.selected_facility_id }); setShowStaffForm(true); }}>
                ＋ 職員追加
              </button>
            )}
          </div>

          {/* 登録完了後のログイン情報カード */}
          {registeredInfo && (
            <div style={{ background: "#eff6ff", border: "2px solid #3b82f6", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#1d4ed8", marginBottom: 12 }}>
                ✅ 登録完了！スタッフにこの情報を伝えてください
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ background: "white", borderRadius: 8, padding: "10px 14px", border: "1px solid #bfdbfe" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>ログインID</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0a2540", letterSpacing: "0.05em" }}>
                    {registeredInfo.login_id}
                  </div>
                </div>
                <div style={{ background: "white", borderRadius: 8, padding: "10px 14px", border: "1px solid #bfdbfe" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>初期パスワード</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0a2540", letterSpacing: "0.1em" }}>
                    {registeredInfo.password}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: "#3b82f6" }}>
                ※ ログインURL: https://go-group-new.com/login
              </div>
              <button
                onClick={() => setRegisteredInfo(null)}
                style={{ marginTop: 10, fontSize: 11, background: "none", border: "none", color: "#64748b", cursor: "pointer", textDecoration: "underline" }}
              >
                閉じる
              </button>
            </div>
          )}

          {/* 職員追加フォーム */}
          {showStaffForm && isManager && (
            <div className="card" style={{ padding: 24, marginBottom: 20, border: "2px solid #0077b6" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20, color: "#0077b6" }}>
                {editingStaffId ? "✏️ 職員情報を編集" : "👥 職員追加"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>氏名 *</label>
                  <input className="form-input" placeholder="田中 美穂" value={staffForm.name} onChange={(e) => setStaffForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>ログインID *</label>
                  <input className="form-input" placeholder="例: tanaka_m" value={staffForm.login_id} onChange={(e) => setStaffForm(p => ({ ...p, login_id: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>
                    {editingStaffId ? "パスワード変更（変更しない場合は空白）" : "初期パスワード *（8文字以上）"}
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <input
                        className="form-input"
                        type={showPassword ? "text" : "password"}
                        placeholder={editingStaffId ? "変更する場合のみ入力" : "パスワードを入力または自動生成"}
                        value={staffForm.password}
                        onChange={(e) => setStaffForm(p => ({ ...p, password: e.target.value }))}
                        style={{ paddingRight: 44 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        style={{
                          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                          background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#64748b",
                        }}
                        title={showPassword ? "非表示" : "表示"}
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                    {!editingStaffId && (
                      <button
                        type="button"
                        onClick={() => { const pw = genPassword(); setStaffForm(p => ({ ...p, password: pw })); setShowPassword(true); }}
                        style={{
                          padding: "10px 14px", background: "#f1f5f9", border: "1px solid #e2e8f0",
                          borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#0077b6", cursor: "pointer",
                          whiteSpace: "nowrap", fontFamily: "inherit",
                        }}
                      >
                        🎲 自動生成
                      </button>
                    )}
                  </div>
                  {!editingStaffId && staffForm.password && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>
                      ※ 登録後にこのパスワードをスタッフに伝えてください
                    </div>
                  )}
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
                <div>
                  <label style={labelStyle}>雇用形態</label>
                  <select className="form-input" value={staffForm.employment_type} onChange={(e) => setStaffForm(p => ({ ...p, employment_type: e.target.value }))}>
                    <option value="正社員">正社員</option>
                    <option value="パート">パート</option>
                    <option value="派遣">派遣</option>
                    <option value="業務委託">業務委託</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>電話番号</label>
                  <input className="form-input" type="tel" placeholder="例: 090-0000-0000" value={staffForm.phone} onChange={(e) => setStaffForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>入社日</label>
                  <input className="form-input" type="date" value={staffForm.hire_date} onChange={(e) => setStaffForm(p => ({ ...p, hire_date: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>緊急連絡先</label>
                  <input className="form-input" placeholder="例: 090-0000-0001（配偶者）" value={staffForm.emergency_contact} onChange={(e) => setStaffForm(p => ({ ...p, emergency_contact: e.target.value }))} />
                </div>
                {/* 保有資格 */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>保有資格</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {QUALIFICATION_OPTIONS.map((q) => {
                      const checked = staffForm.qualifications.includes(q);
                      return (
                        <label key={q} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12,
                          padding: "5px 12px", borderRadius: 16,
                          background: checked ? "#dbeafe" : "#f8fafc",
                          border: checked ? "1.5px solid #3b82f6" : "1.5px solid #e2e8f0",
                          color: checked ? "#1d4ed8" : "#475569", fontWeight: checked ? 700 : 400,
                          transition: "all 0.15s" }}>
                          <input type="checkbox" style={{ display: "none" }}
                            checked={checked}
                            onChange={() => setStaffForm(p => ({
                              ...p,
                              qualifications: checked
                                ? p.qualifications.filter((x) => x !== q)
                                : [...p.qualifications, q],
                            }))} />
                          {checked ? "✓ " : ""}{q}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* エラー表示 */}
              {staffError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginTop: 14, fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                  ⚠️ {staffError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button className="btn-primary" onClick={handleSaveStaff}
                  disabled={staffSaving || !staffForm.name.trim() || !staffForm.login_id.trim() || !staffForm.facility_id || (!editingStaffId && !staffForm.password.trim())}
                  style={{ minWidth: 100 }}>
                  {staffSaving ? "保存中..." : editingStaffId ? "✅ 更新する" : "✅ 登録する"}
                </button>
                <button className="btn-secondary" onClick={() => { setShowStaffForm(false); setEditingStaffId(null); setStaffError(""); }}>キャンセル</button>
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
                  <th>雇用形態</th>
                  <th>所属施設</th>
                  <th>保有資格</th>
                  <th>入社日</th>
                  {isManager && <th>操作</th>}
                </tr>
              </thead>
              <tbody>
                {staffList.map((s) => {
                  const fac = DUMMY_FACILITIES.find((f) => f.id === s.facility_id);
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                        {s.phone && <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.phone}</div>}
                      </td>
                      <td style={{ fontSize: 12, color: "#64748b" }}>{getLoginId(s)}</td>
                      <td>
                        <span className={`badge ${s.role === "admin" ? "badge-red" : s.role === "manager" ? "badge-blue" : "badge-green"}`}>
                          {s.role === "admin" ? "本部管理者" : s.role === "manager" ? "管理者" : "職員"}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "#64748b" }}>{s.employment_type ?? "—"}</td>
                      <td style={{ fontSize: 13 }}>{fac?.name ?? "—"}</td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {(s.qualifications ?? []).length > 0
                            ? (s.qualifications ?? []).map((q) => (
                                <span key={q} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#dbeafe", color: "#1d4ed8", fontWeight: 700 }}>{q}</span>
                              ))
                            : <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>
                          }
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: "#64748b" }}>{s.hire_date ?? "—"}</td>
                      {isManager && (
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => handleEditStaff(s)}
                              style={{ padding: "4px 10px", fontSize: 11, borderRadius: 6, border: "1.5px solid #0077b6", background: "white", color: "#0077b6", cursor: "pointer", fontWeight: 600 }}>
                              編集
                            </button>
                            <button onClick={() => handleDeleteStaff(s.id, s.name)}
                              style={{ padding: "4px 10px", fontSize: 11, borderRadius: 6, border: "1.5px solid #ef4444", background: "white", color: "#ef4444", cursor: "pointer", fontWeight: 600 }}>
                              削除
                            </button>
                          </div>
                        </td>
                      )}
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
