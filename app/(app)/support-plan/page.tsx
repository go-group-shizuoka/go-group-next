"use client";
// ==================== 個別支援計画 ====================
// 児童ごとの個別支援計画を作成・編集・保存する

import { useState, useEffect } from "react";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { saveRecord, fetchByFacility } from "@/lib/supabase";
import type { SupportPlan, Child } from "@/types";
import { useSession } from "@/hooks/useSession";
import { todayISO } from "@/lib/utils";

function genId() { return crypto.randomUUID(); }

// 半年後の日付
function halfYearLater() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

// 短期目標の型
type ShortGoal = { goal: string; period: string };
// 支援項目の型
type SupportItem = { category: string; content: string; frequency: string };

const SUPPORT_CATEGORIES = ["コミュニケーション","社会性","日常生活","運動・感覚","学習","情緒・行動","その他"];
const FREQUENCY_OPTIONS = ["毎日","週3回以上","週1〜2回","月数回","随時"];

// JSON.parse のラッパー（破損データでもクラッシュしない）
function safeParseGoals(s: string): ShortGoal[] {
  try { return JSON.parse(s); } catch { return []; }
}
function safeParseItems(s: string): SupportItem[] {
  try { return JSON.parse(s); } catch { return []; }
}

export default function SupportPlanPage() {
  const session = useSession();
  const [plans, setPlans] = useState<SupportPlan[]>([]);
  const [dbChildren, setDbChildren] = useState<Child[]>([]);
  const [loadingDB, setLoadingDB] = useState(false);
  const [view, setView] = useState<"list" | "edit">("list");
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState<SupportPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  // Supabaseから個別支援計画と児童リストを読み込む
  useEffect(() => {
    if (!session) return;
    setLoadingDB(true);
    Promise.all([
      fetchByFacility<SupportPlan>("ng_support_plans", session.org_id, session.selected_facility_id),
      fetchByFacility<Child>("ng_children", session.org_id, session.selected_facility_id),
    ]).then(([planRows, childrenRows]) => {
      setPlans(planRows);
      if (childrenRows.length > 0) setDbChildren(childrenRows.filter((c) => c.active));
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
  const todayDow = ["日","月","火","水","木","金","土"][new Date().getDay()];

  // この施設の在籍児童（Supabase優先、なければダミー）
  const facilityChildren = dbChildren.length > 0
    ? dbChildren
    : DUMMY_CHILDREN.filter((c) => c.active && c.facility_id === session.selected_facility_id);

  // 計画を開く（既存 or 新規）
  const openPlan = (childId: string) => {
    const child = facilityChildren.find((c) => c.id === childId)!;
    const existing = plans.find((p) => p.child_id === childId);
    if (existing) {
      setEditPlan(existing);
    } else {
      // 新規作成
      const newPlan: SupportPlan = {
        id: genId(),
        org_id: session.org_id,
        facility_id: session.selected_facility_id,
        child_id: childId,
        child_name: child.name,
        plan_start: todayISO(),
        plan_end: halfYearLater(),
        long_term_goal: "",
        short_term_goals: JSON.stringify([
          { goal: "", period: "3ヶ月" },
          { goal: "", period: "3ヶ月" },
          { goal: "", period: "6ヶ月" },
        ] as ShortGoal[]),
        support_items: JSON.stringify([
          { category: "コミュニケーション", content: "", frequency: "毎日" },
          { category: "社会性", content: "", frequency: "週3回以上" },
          { category: "日常生活", content: "", frequency: "毎日" },
        ] as SupportItem[]),
        created_by: session.name,
        created_at: new Date().toISOString(),
      };
      setEditPlan(newPlan);
    }
    setSelectedChild(childId);
    setView("edit");
  };

  // 保存
  const handleSave = async () => {
    if (!editPlan) return;
    setSaving(true);
    await saveRecord("ng_support_plans", {
      ...editPlan,
      updated_at: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
    setPlans((prev) => [
      editPlan,
      ...prev.filter((p) => p.child_id !== editPlan.child_id),
    ]);
    setSaving(false);
    setSavedMsg("✓ 保存しました");
    setTimeout(() => setSavedMsg(""), 3000);
  };

  // 短期目標の更新
  const updateShortGoal = (index: number, field: keyof ShortGoal, val: string) => {
    if (!editPlan) return;
    const goals: ShortGoal[] = safeParseGoals(editPlan.short_term_goals);
    goals[index] = { ...goals[index], [field]: val };
    setEditPlan({ ...editPlan, short_term_goals: JSON.stringify(goals) });
  };

  // 支援項目の更新
  const updateSupportItem = (index: number, field: keyof SupportItem, val: string) => {
    if (!editPlan) return;
    const items: SupportItem[] = safeParseItems(editPlan.support_items);
    items[index] = { ...items[index], [field]: val };
    setEditPlan({ ...editPlan, support_items: JSON.stringify(items) });
  };

  const addShortGoal = () => {
    if (!editPlan) return;
    const goals: ShortGoal[] = safeParseGoals(editPlan.short_term_goals);
    setEditPlan({ ...editPlan, short_term_goals: JSON.stringify([...goals, { goal: "", period: "3ヶ月" }]) });
  };

  const removeShortGoal = (i: number) => {
    if (!editPlan) return;
    const goals: ShortGoal[] = safeParseGoals(editPlan.short_term_goals);
    setEditPlan({ ...editPlan, short_term_goals: JSON.stringify(goals.filter((_, idx) => idx !== i)) });
  };

  const addSupportItem = () => {
    if (!editPlan) return;
    const items: SupportItem[] = safeParseItems(editPlan.support_items);
    setEditPlan({ ...editPlan, support_items: JSON.stringify([...items, { category: "その他", content: "", frequency: "毎日" }]) });
  };

  const removeSupportItem = (i: number) => {
    if (!editPlan) return;
    const items: SupportItem[] = safeParseItems(editPlan.support_items);
    setEditPlan({ ...editPlan, support_items: JSON.stringify(items.filter((_, idx) => idx !== i)) });
  };

  // ===== 編集画面 =====
  if (view === "edit" && editPlan) {
    const selectedChildData = facilityChildren.find((c) => c.id === selectedChild);
    const shortGoals: ShortGoal[] = safeParseGoals(editPlan.short_term_goals);
    const supportItems: SupportItem[] = safeParseItems(editPlan.support_items);

    return (
      <div>
        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <button onClick={() => setView("list")} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0077b6", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
            ← 一覧に戻る
          </button>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {savedMsg && <span className="badge badge-green">{savedMsg}</span>}
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "💾 保存する"}
            </button>
          </div>
        </div>

        <div id="print-area">
          {/* 計画タイトル */}
          <div className="card" style={{ padding: "20px 24px", marginBottom: 16, borderLeft: "4px solid #0077b6" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0a2540", marginBottom: 4 }}>
              📋 個別支援計画書
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              {fac?.name} ／ {selectedChildData?.name}（{selectedChildData?.grade}）
            </div>
          </div>

          {/* 計画期間 */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <SectionTitle>計画期間</SectionTitle>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <label style={labelStyle}>開始日</label>
                <input className="form-input" type="date" style={{ width: "auto" }} value={editPlan.plan_start} onChange={(e) => setEditPlan({ ...editPlan, plan_start: e.target.value })} />
              </div>
              <div style={{ color: "#64748b", fontWeight: 600 }}>〜</div>
              <div>
                <label style={labelStyle}>終了日</label>
                <input className="form-input" type="date" style={{ width: "auto" }} value={editPlan.plan_end} onChange={(e) => setEditPlan({ ...editPlan, plan_end: e.target.value })} />
              </div>
            </div>
          </div>

          {/* 長期目標 */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <SectionTitle>長期目標（計画期間全体）</SectionTitle>
            <textarea
              className="form-input"
              style={{ minHeight: 80, resize: "vertical" }}
              placeholder="例: 集団活動に参加しながら、友達との関わりを増やすことができる"
              value={editPlan.long_term_goal}
              onChange={(e) => setEditPlan({ ...editPlan, long_term_goal: e.target.value })}
            />
          </div>

          {/* 短期目標 */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <SectionTitle>短期目標</SectionTitle>
              <button className="btn-secondary" onClick={addShortGoal} style={{ padding: "5px 12px", fontSize: 12 }}>＋ 追加</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shortGoals.map((g, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#0077b6", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 10 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      className="form-input"
                      placeholder={`短期目標${i + 1}（例: 名前を呼ばれたら返事ができる）`}
                      value={g.goal}
                      onChange={(e) => updateShortGoal(i, "goal", e.target.value)}
                      style={{ marginBottom: 4 }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>達成期間:</span>
                      <select className="form-input" style={{ width: "auto", padding: "4px 8px", fontSize: 12 }} value={g.period} onChange={(e) => updateShortGoal(i, "period", e.target.value)}>
                        {["1ヶ月","2ヶ月","3ヶ月","4ヶ月","5ヶ月","6ヶ月"].map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  {shortGoals.length > 1 && (
                    <button onClick={() => removeShortGoal(i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, padding: "8px 4px", flexShrink: 0 }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 支援項目 */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <SectionTitle>支援項目・具体的な取り組み</SectionTitle>
              <button className="btn-secondary" onClick={addSupportItem} style={{ padding: "5px 12px", fontSize: 12 }}>＋ 追加</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {supportItems.map((item, i) => (
                <div key={i} className="card" style={{ padding: "14px 16px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={labelStyle}>支援カテゴリ</label>
                      <select className="form-input" style={{ padding: "6px 10px" }} value={item.category} onChange={(e) => updateSupportItem(i, "category", e.target.value)}>
                        {SUPPORT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={labelStyle}>頻度</label>
                      <select className="form-input" style={{ padding: "6px 10px" }} value={item.frequency} onChange={(e) => updateSupportItem(i, "frequency", e.target.value)}>
                        {FREQUENCY_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                    {supportItems.length > 1 && (
                      <button onClick={() => removeSupportItem(i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, alignSelf: "flex-end", padding: "0 4px" }}>✕</button>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>具体的な支援内容</label>
                    <textarea
                      className="form-input"
                      style={{ minHeight: 60, resize: "vertical" }}
                      placeholder="例: 活動前に活動内容を視覚的に提示し、見通しを持って参加できるよう支援する"
                      value={item.content}
                      onChange={(e) => updateSupportItem(i, "content", e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 作成者・日付 */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>作成者: <span style={{ color: "#0a2540", fontWeight: 600 }}>{editPlan.created_by}</span></div>
              <div style={{ fontSize: 12, color: "#64748b" }}>施設: <span style={{ color: "#0a2540", fontWeight: 600 }}>{fac?.name}</span></div>
              <div style={{ fontSize: 12, color: "#64748b" }}>計画期間: <span style={{ color: "#0a2540", fontWeight: 600 }}>{editPlan.plan_start} 〜 {editPlan.plan_end}</span></div>
            </div>
          </div>
        </div>

        {/* 下部保存ボタン */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={() => window.print()}>🖨️ 印刷</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "💾 保存する"}
          </button>
        </div>
      </div>
    );
  }

  // ===== 一覧画面 =====
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0 }}>📋 個別支援計画</h1>
        <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{fac?.name} ／ {todayISO()}</p>
      </div>

      {/* 児童カード一覧 */}
      {facilityChildren.length === 0 ? (
        <div className="card" style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👦</div>
          この施設に在籍児童がいません
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {facilityChildren.map((child) => {
            const plan = plans.find((p) => p.child_id === child.id);
            const isExpired = plan && plan.plan_end < todayISO();
            const isExpiringSoon = plan && !isExpired && plan.plan_end <= (() => {
              const d = new Date(); d.setDate(d.getDate() + 30);
              return d.toISOString().slice(0, 10);
            })();

            return (
              <div key={child.id} className="card" style={{ padding: 16, cursor: "pointer", transition: "box-shadow 0.15s" }}
                onClick={() => openPlan(child.id)}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)")}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#0077b6,#00b4d8)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 20, flexShrink: 0 }}>
                    {child.name.slice(0, 1)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0a2540" }}>{child.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{child.grade} ／ {(child.use_days ?? []).join("・")}曜</div>
                  </div>
                </div>

                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                  {plan ? (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span className={`badge ${isExpired ? "badge-red" : isExpiringSoon ? "badge-yellow" : "badge-green"}`}>
                          {isExpired ? "⚠️ 期限切れ" : isExpiringSoon ? "⚡ 更新まもなく" : "✓ 計画あり"}
                        </span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{plan.plan_start} 〜 {plan.plan_end}</span>
                      </div>
                      {plan.long_term_goal && (
                        <div style={{ fontSize: 12, color: "#475569", marginTop: 6, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          🎯 {plan.long_term_goal}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="badge badge-gray">未作成</span>
                      <span style={{ fontSize: 12, color: "#0077b6", fontWeight: 600 }}>＋ 作成する →</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 統計サマリー */}
      {facilityChildren.length > 0 && (
        <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "在籍", val: facilityChildren.length, color: "#0077b6", bg: "#dbeafe" },
            { label: "計画あり", val: plans.filter((p) => p.facility_id === session.selected_facility_id).length, color: "#059669", bg: "#dcfce7" },
            { label: "未作成", val: facilityChildren.filter((c) => !plans.find((p) => p.child_id === c.id)).length, color: "#f59e0b", bg: "#fef9c3" },
          ].map((s) => (
            <div key={s.label} className="card" style={{ padding: "12px 20px", background: s.bg, border: "none", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</span>
              <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 共通スタイル
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: "#0077b6", marginBottom: 12, letterSpacing: "0.06em" }}>
      {children}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4,
};
