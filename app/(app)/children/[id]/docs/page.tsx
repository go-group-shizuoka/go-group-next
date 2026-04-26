"use client";
// ==================== 書類管理ページ ====================
// フェイスシート（表・裏）とアセスメントシートの入力・保存・印刷

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { supabase, saveRecord } from "@/lib/supabase";
import type { Child } from "@/types";

// ==================== 型定義 ====================

type TabKey = "facesheet_front" | "facesheet_back" | "assessment" | "plan_draft" | "plan_final";

// 家族構成（1行分）
type FamilyMember = {
  relationship: string;
  name: string;
  dob: string;
  workplace: string;
  notes: string;
};

// フェイスシート（表）
type FacesheetFront = {
  id: string;
  child_id: string;
  entry_date: string;
  homeroom_teacher: string;
  address: string;
  emergency_contact: string;
  family_members: FamilyMember[];
  disability_name: string;
  recipient_number: string;
  therapy_notebook_date: string;
  physical_disability_number: string;
  growth_history: string;
  health_history: string;
  home_situation: string;
  school_situation: string;
};

// フェイスシート（裏）
type FacesheetBack = {
  id: string;
  child_id: string;
  health_insurance_number: string;
  emergency_ambulance: string;
  emergency_family_contact: string;
  family_doctor: string;
  diagnosis_detail: string;
  medications: string;
  disability_notes: string;
  normal_temperature: string;
  current_symptoms: string;
  personality: string;
  likes: string;
  dislikes: string;
  greeting: string;
  language: string[];
  eating: string;
  safety_awareness: string;
  walking_disability: string;
  problem_behavior: string[];
  problem_behavior_other: string;
  communication: string;
  dressing: string;
  toileting: string;
  other_habits: string;
  tidiness: string;
  grooming: string;
  hypersensitivity: string[];
  hypersensitivity_other: string;
  rule_understanding: string;
  allergies: string;
};

// 支援目標の1行
type PlanGoal = {
  goal: string;        // 目標内容
  period: string;      // 達成期間（3ヶ月など）
  achievement: string; // 達成状況（記録時に使用）
};

// 支援内容の1行
type PlanSupportItem = {
  target: string;    // 支援目標
  method: string;    // 支援内容・方法
  frequency: string; // 支援量・頻度
  staff: string;     // 担当者
};

// 個別支援計画（原案）
type SupportPlanDraft = {
  id: string;
  child_id: string;
  org_id: string;
  plan_start: string;
  plan_end: string;
  // 意向確認
  child_wish: string;      // 本人の意向
  family_wish: string;     // 家族の意向
  // 支援方針
  support_policy: string;  // 総合的な支援の方針
  priority_issue: string;  // 解決すべき課題
  // 目標
  long_term_goal: string;
  long_term_period: string;
  short_term_goals: PlanGoal[];       // JSON
  // 支援内容テーブル
  support_items: PlanSupportItem[];   // JSON
  // 説明・同意
  explained_date: string;
  agreed_date: string;
  parent_signature: string;
  // 作成
  author: string;
  manager: string;
  created_date: string;
  updated_at: string;
};

// 個別支援計画（本書）= 原案と同じ構造 + 署名欄など
type SupportPlanFinal = SupportPlanDraft & {
  manager_confirmed_date: string; // 管理者確認日
  next_monitoring_date: string;   // 次回モニタリング予定日
  effective_start: string;        // 有効期間（開始）
  effective_end: string;          // 有効期間（終了）
};

// アセスメントシート
type Assessment = {
  id: string;
  child_id: string;
  facility_request: string;
  parent_wish: string;
  child_wish: string;
  health_life_good: string;
  health_life_concern: string;
  motor_sensory_good: string;
  motor_sensory_concern: string;
  cognitive_behavior_good: string;
  cognitive_behavior_concern: string;
  language_comm_good: string;
  language_comm_concern: string;
  social_good: string;
  social_concern: string;
  other_good: string;
  other_concern: string;
  parent_name: string;
  created_date: string;
};

// ==================== デフォルト値 ====================

function defaultFamilyMembers(): FamilyMember[] {
  return Array.from({ length: 5 }, () => ({
    relationship: "", name: "", dob: "", workplace: "", notes: "",
  }));
}

function defaultFront(childId: string): FacesheetFront {
  return {
    id: `fs_${childId}`,
    child_id: childId,
    entry_date: "",
    homeroom_teacher: "",
    address: "",
    emergency_contact: "",
    family_members: defaultFamilyMembers(),
    disability_name: "",
    recipient_number: "",
    therapy_notebook_date: "",
    physical_disability_number: "",
    growth_history: "",
    health_history: "",
    home_situation: "",
    school_situation: "",
  };
}

function defaultBack(childId: string): FacesheetBack {
  return {
    id: `fsb_${childId}`,
    child_id: childId,
    health_insurance_number: "",
    emergency_ambulance: "",
    emergency_family_contact: "",
    family_doctor: "",
    diagnosis_detail: "",
    medications: "",
    disability_notes: "",
    normal_temperature: "",
    current_symptoms: "",
    personality: "",
    likes: "",
    dislikes: "",
    greeting: "",
    language: [],
    eating: "",
    safety_awareness: "",
    walking_disability: "",
    problem_behavior: [],
    problem_behavior_other: "",
    communication: "",
    dressing: "",
    toileting: "",
    other_habits: "",
    tidiness: "",
    grooming: "",
    hypersensitivity: [],
    hypersensitivity_other: "",
    rule_understanding: "",
    allergies: "",
  };
}

function defaultPlanDraft(childId: string, orgId: string): SupportPlanDraft {
  return {
    id: `pd_${childId}`,
    child_id: childId,
    org_id: orgId,
    plan_start: "",
    plan_end: "",
    child_wish: "",
    family_wish: "",
    support_policy: "",
    priority_issue: "",
    long_term_goal: "",
    long_term_period: "1年",
    short_term_goals: [
      { goal: "", period: "3ヶ月", achievement: "" },
      { goal: "", period: "3ヶ月", achievement: "" },
      { goal: "", period: "6ヶ月", achievement: "" },
    ],
    support_items: [
      { target: "", method: "", frequency: "毎日", staff: "" },
      { target: "", method: "", frequency: "週3回以上", staff: "" },
    ],
    explained_date: "",
    agreed_date: "",
    parent_signature: "",
    author: "",
    manager: "",
    created_date: "",
    updated_at: "",
  };
}

function defaultPlanFinal(childId: string, orgId: string): SupportPlanFinal {
  return {
    ...defaultPlanDraft(childId, orgId),
    id: `pf_${childId}`,
    manager_confirmed_date: "",
    next_monitoring_date: "",
    effective_start: "",
    effective_end: "",
  };
}

function defaultAssessment(childId: string): Assessment {
  return {
    id: `as_${childId}`,
    child_id: childId,
    facility_request: "",
    parent_wish: "",
    child_wish: "",
    health_life_good: "",
    health_life_concern: "",
    motor_sensory_good: "",
    motor_sensory_concern: "",
    cognitive_behavior_good: "",
    cognitive_behavior_concern: "",
    language_comm_good: "",
    language_comm_concern: "",
    social_good: "",
    social_concern: "",
    other_good: "",
    other_concern: "",
    parent_name: "",
    created_date: "",
  };
}

// ==================== タブ定義 ====================

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "facesheet_front", label: "フェイスシート（表）",    icon: "📋" },
  { key: "facesheet_back",  label: "フェイスシート（裏）",    icon: "📄" },
  { key: "assessment",      label: "アセスメントシート",      icon: "📊" },
  { key: "plan_draft",      label: "個別支援計画（原案）",    icon: "📝" },
  { key: "plan_final",      label: "個別支援計画（本書）",    icon: "📘" },
];

// ==================== ページ本体 ====================

export default function DocsPage() {
  const session = useSession();
  const router = useRouter();
  const params = useParams();
  const childId = params.id as string;

  const [tab, setTab] = useState<TabKey>("facesheet_front");
  const [savingMsg, setSavingMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const [front, setFront] = useState<FacesheetFront>(() => defaultFront(childId));
  const [back, setBack]   = useState<FacesheetBack>(() => defaultBack(childId));
  const [assessment, setAssessment] = useState<Assessment>(() => defaultAssessment(childId));
  const [planDraft, setPlanDraft] = useState<SupportPlanDraft>(() => defaultPlanDraft(childId, ""));
  const [planFinal, setPlanFinal] = useState<SupportPlanFinal>(() => defaultPlanFinal(childId, ""));

  // 児童情報：まずダミーデータから探し、なければDBから取得
  const [child, setChild] = useState<Child | undefined>(DUMMY_CHILDREN.find((c) => c.id === childId));
  const fac = child ? DUMMY_FACILITIES.find((f) => f.id === child.facility_id) : undefined;

  // セッションチェック（未ログインならログイン画面へ）
  useEffect(() => {
    if (session === null && typeof window !== "undefined") {
      const raw = localStorage.getItem("gg_session");
      if (!raw) router.push("/login");
    }
  }, [session, router]);

  // Supabaseからデータ読み込み
  useEffect(() => {
    async function loadData() {
      setLoading(true);

      // ダミーデータにない場合はDBから児童情報を取得
      if (!DUMMY_CHILDREN.find((c) => c.id === childId)) {
        const { data: dbChild } = await supabase
          .from("ng_children")
          .select("*")
          .eq("id", childId)
          .limit(1);
        if (dbChild && dbChild.length > 0) setChild(dbChild[0] as Child);
      }

      const [fsRes, asRes] = await Promise.all([
        supabase.from("ng_facesheets").select("*").eq("child_id", childId),
        supabase.from("ng_assessments").select("*").eq("child_id", childId),
      ]);

      if (fsRes.data && fsRes.data.length > 0) {
        const row = fsRes.data[0] as Record<string, unknown>;
        // family_membersがJSON文字列のケースを考慮してパース
        let fm = row.family_members;
        if (typeof fm === "string") {
          try { fm = JSON.parse(fm); } catch { fm = defaultFamilyMembers(); }
        }
        if (!Array.isArray(fm) || fm.length < 5) fm = defaultFamilyMembers();

        setFront({
          id: `fs_${childId}`,
          child_id: childId,
          entry_date: String(row.entry_date ?? ""),
          homeroom_teacher: String(row.homeroom_teacher ?? ""),
          address: String(row.address ?? ""),
          emergency_contact: String(row.emergency_contact ?? ""),
          family_members: fm as FamilyMember[],
          disability_name: String(row.disability_name ?? ""),
          recipient_number: String(row.recipient_number ?? ""),
          therapy_notebook_date: String(row.therapy_notebook_date ?? ""),
          physical_disability_number: String(row.physical_disability_number ?? ""),
          growth_history: String(row.growth_history ?? ""),
          health_history: String(row.health_history ?? ""),
          home_situation: String(row.home_situation ?? ""),
          school_situation: String(row.school_situation ?? ""),
        });

        const backRow = row as Record<string, unknown>;
        setBack({
          id: `fsb_${childId}`,
          child_id: childId,
          health_insurance_number: String(backRow.health_insurance_number ?? ""),
          emergency_ambulance: String(backRow.emergency_ambulance ?? ""),
          emergency_family_contact: String(backRow.emergency_family_contact ?? ""),
          family_doctor: String(backRow.family_doctor ?? ""),
          diagnosis_detail: String(backRow.diagnosis_detail ?? ""),
          medications: String(backRow.medications ?? ""),
          disability_notes: String(backRow.disability_notes ?? ""),
          normal_temperature: String(backRow.normal_temperature ?? ""),
          current_symptoms: String(backRow.current_symptoms ?? ""),
          personality: String(backRow.personality ?? ""),
          likes: String(backRow.likes ?? ""),
          dislikes: String(backRow.dislikes ?? ""),
          greeting: String(backRow.greeting ?? ""),
          language: Array.isArray(backRow.language) ? (backRow.language as string[]) : [],
          eating: String(backRow.eating ?? ""),
          safety_awareness: String(backRow.safety_awareness ?? ""),
          walking_disability: String(backRow.walking_disability ?? ""),
          problem_behavior: Array.isArray(backRow.problem_behavior) ? (backRow.problem_behavior as string[]) : [],
          problem_behavior_other: String(backRow.problem_behavior_other ?? ""),
          communication: String(backRow.communication ?? ""),
          dressing: String(backRow.dressing ?? ""),
          toileting: String(backRow.toileting ?? ""),
          other_habits: String(backRow.other_habits ?? ""),
          tidiness: String(backRow.tidiness ?? ""),
          grooming: String(backRow.grooming ?? ""),
          hypersensitivity: Array.isArray(backRow.hypersensitivity) ? (backRow.hypersensitivity as string[]) : [],
          hypersensitivity_other: String(backRow.hypersensitivity_other ?? ""),
          rule_understanding: String(backRow.rule_understanding ?? ""),
          allergies: String(backRow.allergies ?? ""),
        });
      }

      if (asRes.data && asRes.data.length > 0) {
        const row = asRes.data[0] as Record<string, unknown>;
        setAssessment({
          id: `as_${childId}`,
          child_id: childId,
          facility_request: String(row.facility_request ?? ""),
          parent_wish: String(row.parent_wish ?? ""),
          child_wish: String(row.child_wish ?? ""),
          health_life_good: String(row.health_life_good ?? ""),
          health_life_concern: String(row.health_life_concern ?? ""),
          motor_sensory_good: String(row.motor_sensory_good ?? ""),
          motor_sensory_concern: String(row.motor_sensory_concern ?? ""),
          cognitive_behavior_good: String(row.cognitive_behavior_good ?? ""),
          cognitive_behavior_concern: String(row.cognitive_behavior_concern ?? ""),
          language_comm_good: String(row.language_comm_good ?? ""),
          language_comm_concern: String(row.language_comm_concern ?? ""),
          social_good: String(row.social_good ?? ""),
          social_concern: String(row.social_concern ?? ""),
          other_good: String(row.other_good ?? ""),
          other_concern: String(row.other_concern ?? ""),
          parent_name: String(row.parent_name ?? ""),
          created_date: String(row.created_date ?? ""),
        });
      }

      const [drafts, finals] = await Promise.all([
        supabase.from("ng_plan_drafts").select("*").eq("child_id", childId),
        supabase.from("ng_plan_finals").select("*").eq("child_id", childId),
      ]);
      if (drafts.data && drafts.data.length > 0) {
        const row = drafts.data[0] as Record<string, unknown>;
        setPlanDraft({
          ...defaultPlanDraft(childId, String(row.org_id ?? "")),
          ...row,
          short_term_goals: (() => { try { return typeof row.short_term_goals === "string" ? JSON.parse(row.short_term_goals) : (row.short_term_goals ?? []); } catch { return []; } })(),
          support_items: (() => { try { return typeof row.support_items === "string" ? JSON.parse(row.support_items) : (row.support_items ?? []); } catch { return []; } })(),
        } as SupportPlanDraft);
      }
      if (finals.data && finals.data.length > 0) {
        const row = finals.data[0] as Record<string, unknown>;
        setPlanFinal({
          ...defaultPlanFinal(childId, String(row.org_id ?? "")),
          ...row,
          short_term_goals: (() => { try { return typeof row.short_term_goals === "string" ? JSON.parse(row.short_term_goals) : (row.short_term_goals ?? []); } catch { return []; } })(),
          support_items: (() => { try { return typeof row.support_items === "string" ? JSON.parse(row.support_items) : (row.support_items ?? []); } catch { return []; } })(),
        } as SupportPlanFinal);
      }

      setLoading(false);
    }
    loadData();
  }, [childId]);

  if (!child) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>😔</div>
        <p style={{ color: "#64748b" }}>児童が見つかりません</p>
        <button className="btn-secondary" onClick={() => router.back()} style={{ marginTop: 16 }}>
          ← 戻る
        </button>
      </div>
    );
  }

  // 保存処理
  const handleSave = async () => {
    setSavingMsg("保存中...");
    const now = new Date().toISOString();
    try {
      if (tab === "facesheet_front" || tab === "facesheet_back") {
        // フェイスシート表・裏は1レコードにまとめて保存
        await saveRecord("ng_facesheets", {
          ...(front as unknown as Record<string, unknown>),
          ...(back as unknown as Record<string, unknown>),
          id: `fs_${childId}`,
          child_id: childId,
        });
      } else if (tab === "plan_draft") {
        await saveRecord("ng_plan_drafts", {
          ...planDraft,
          short_term_goals: JSON.stringify(planDraft.short_term_goals),
          support_items: JSON.stringify(planDraft.support_items),
          updated_at: now,
        } as unknown as Record<string, unknown>);
      } else if (tab === "plan_final") {
        await saveRecord("ng_plan_finals", {
          ...planFinal,
          short_term_goals: JSON.stringify(planFinal.short_term_goals),
          support_items: JSON.stringify(planFinal.support_items),
          updated_at: now,
        } as unknown as Record<string, unknown>);
      } else {
        await saveRecord("ng_assessments", assessment as unknown as Record<string, unknown>);
      }
      setSavingMsg("✓ 保存しました");
      setTimeout(() => setSavingMsg(""), 3000);
    } catch {
      setSavingMsg("⚠️ 保存に失敗しました");
      setTimeout(() => setSavingMsg(""), 4000);
    }
  };

  // 年齢計算
  const age = (() => {
    const dob = new Date(child.dob);
    const today = new Date();
    let a = today.getFullYear() - dob.getFullYear();
    if (
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
    ) a--;
    return a;
  })();

  return (
    <div>
      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; }
          body { font-size: 11px; }
          .print-table { width: 100%; border-collapse: collapse; }
          .print-table th, .print-table td {
            border: 1px solid #333;
            padding: 4px 8px;
            font-size: 11px;
            vertical-align: top;
          }
          .print-table th { background: #f0f0f0; font-weight: bold; white-space: nowrap; }
          .print-box { border: 1px solid #333; min-height: 60px; padding: 4px 8px; margin-bottom: 8px; font-size: 11px; }
          .print-title { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 12px; }
          .print-subtitle { font-size: 12px; font-weight: bold; margin: 10px 0 4px; border-bottom: 1px solid #333; }
          .print-row { display: flex; gap: 0; margin-bottom: 4px; }
          .print-label { font-weight: bold; min-width: 120px; font-size: 11px; }
          .print-value { font-size: 11px; flex: 1; }
          @page { margin: 12mm; }
        }
        @media screen {
          .print-area { display: none; }
        }
      `}</style>

      {/* 戻るボタン（印刷時非表示） */}
      <div className="no-print">
        <button
          onClick={() => router.push(`/children/${childId}`)}
          style={{ display: "flex", alignItems: "center", gap: 6, color: "#0077b6", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 16, fontFamily: "inherit" }}
        >
          ← 児童詳細に戻る
        </button>

        {/* 児童情報ヘッダー */}
        <div style={{ background: "linear-gradient(135deg, #0a2540, #0077b6)", borderRadius: 14, padding: "16px 20px", color: "white", display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, flexShrink: 0 }}>
            {child.name.slice(0, 1)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{child.name} <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 400 }}>書類管理</span></div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{child.name_kana}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>{child.grade}</span>
              <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>{age}歳</span>
              <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>{fac?.name}</span>
            </div>
          </div>
        </div>

        {/* 保存メッセージ */}
        {savingMsg && (
          <div style={{
            background: savingMsg.includes("✓") ? "#dcfce7" : savingMsg.includes("⚠️") ? "#fef9c3" : "#dbeafe",
            color: savingMsg.includes("✓") ? "#166534" : savingMsg.includes("⚠️") ? "#713f12" : "#1d4ed8",
            borderRadius: 8, padding: "10px 16px", marginBottom: 12, fontSize: 13, fontWeight: 600,
          }}>
            {savingMsg}
          </div>
        )}

        {/* タブバー */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 16px", borderRadius: 20,
                border: tab === t.key ? "none" : "1.5px solid #e2e8f0",
                background: tab === t.key ? "#0077b6" : "white",
                color: tab === t.key ? "white" : "#64748b",
                fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                fontFamily: "inherit", transition: "all 0.15s",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ローディング */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: 13 }}>読み込み中...</div>
        ) : (
          <>
            {/* フォームエリア */}
            {tab === "facesheet_front" && (
              <FacesheetFrontForm front={front} onChange={setFront} />
            )}
            {tab === "facesheet_back" && (
              <FacesheetBackForm back={back} onChange={setBack} />
            )}
            {tab === "assessment" && (
              <AssessmentForm assessment={assessment} onChange={setAssessment} />
            )}
            {tab === "plan_draft" && (
              <SupportPlanForm
                plan={planDraft}
                onChange={setPlanDraft}
                isDraft={true}
              />
            )}
            {tab === "plan_final" && (
              <SupportPlanForm
                plan={planFinal}
                onChange={setPlanFinal as (v: SupportPlanDraft) => void}
                isDraft={false}
                finalProps={{
                  manager_confirmed_date: planFinal.manager_confirmed_date,
                  next_monitoring_date: planFinal.next_monitoring_date,
                  effective_start: planFinal.effective_start,
                  effective_end: planFinal.effective_end,
                  onChangeFinal: (field: keyof SupportPlanFinal, val: string) =>
                    setPlanFinal({ ...planFinal, [field]: val }),
                }}
              />
            )}

            {/* 保存・印刷ボタン */}
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button
                onClick={() => window.print()}
                className="btn-secondary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                🖨️ 印刷
              </button>
              <button
                onClick={handleSave}
                className="btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                💾 保存する
              </button>
            </div>
          </>
        )}
      </div>

      {/* ==================== 印刷エリア ==================== */}
      <div className="print-area">
        {tab === "facesheet_front" && (
          <PrintFront front={front} child={child} fac={fac} age={age} />
        )}
        {tab === "facesheet_back" && (
          <PrintBack back={back} child={child} />
        )}
        {tab === "assessment" && (
          <PrintAssessment assessment={assessment} child={child} />
        )}
        {tab === "plan_draft" && (
          <PrintSupportPlan plan={planDraft} child={child} fac={fac} isDraft={true} />
        )}
        {tab === "plan_final" && (
          <PrintSupportPlan plan={planFinal} child={child} fac={fac} isDraft={false} />
        )}
      </div>
    </div>
  );
}

// ==================== ユーティリティコンポーネント ====================

/** セクションカード */
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "16px 20px", marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0077b6", marginBottom: 12, borderBottom: "1.5px solid #e2e8f0", paddingBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

/** 入力行ラベル */
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

/** ラジオボタン（ボタン形式） */
function RadioButtons({ value, options, onChange }: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={{
            padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            border: value === opt ? "none" : "1.5px solid #cbd5e1",
            background: value === opt ? "#0077b6" : "white",
            color: value === opt ? "white" : "#475569",
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/** チェックボックス（ボタン形式） */
function CheckButtons({ values, options, onChange }: {
  values: string[];
  options: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    const next = values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt];
    onChange(next);
  };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((opt) => {
        const active = values.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              border: active ? "none" : "1.5px solid #cbd5e1",
              background: active ? "#0077b6" : "white",
              color: active ? "white" : "#475569",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ==================== フェイスシート（表）フォーム ====================

function FacesheetFrontForm({ front, onChange }: { front: FacesheetFront; onChange: (v: FacesheetFront) => void }) {
  const set = (field: keyof FacesheetFront, val: string) => onChange({ ...front, [field]: val });

  const setFamilyMember = (idx: number, field: keyof FamilyMember, val: string) => {
    const members = front.family_members.map((m, i) => i === idx ? { ...m, [field]: val } : m);
    onChange({ ...front, family_members: members });
  };

  return (
    <>
      <SectionCard title="基本情報">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <FormRow label="記入日">
            <input className="form-input" type="date" value={front.entry_date} onChange={(e) => set("entry_date", e.target.value)} />
          </FormRow>
          <FormRow label="担任名">
            <input className="form-input" value={front.homeroom_teacher} placeholder="担任の先生の名前" onChange={(e) => set("homeroom_teacher", e.target.value)} />
          </FormRow>
        </div>
        <FormRow label="現住所（〒含む）">
          <input className="form-input" value={front.address} placeholder="〒000-0000 ○○市…" onChange={(e) => set("address", e.target.value)} />
        </FormRow>
        <FormRow label="緊急連絡先">
          <input className="form-input" value={front.emergency_contact} placeholder="例: 父 090-0000-0000" onChange={(e) => set("emergency_contact", e.target.value)} />
        </FormRow>
      </SectionCard>

      <SectionCard title="家族構成">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["続柄", "氏名", "生年月日", "勤務先（学校）", "家族の様子・配慮"].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", border: "1px solid #e2e8f0", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {front.family_members.map((m, i) => (
                <tr key={i}>
                  <td style={{ border: "1px solid #e2e8f0", padding: 4 }}>
                    <input className="form-input" value={m.relationship} placeholder="父/母/兄/姉…" onChange={(e) => setFamilyMember(i, "relationship", e.target.value)} style={{ minWidth: 60 }} />
                  </td>
                  <td style={{ border: "1px solid #e2e8f0", padding: 4 }}>
                    <input className="form-input" value={m.name} onChange={(e) => setFamilyMember(i, "name", e.target.value)} style={{ minWidth: 80 }} />
                  </td>
                  <td style={{ border: "1px solid #e2e8f0", padding: 4 }}>
                    <input className="form-input" type="date" value={m.dob} onChange={(e) => setFamilyMember(i, "dob", e.target.value)} style={{ minWidth: 120 }} />
                  </td>
                  <td style={{ border: "1px solid #e2e8f0", padding: 4 }}>
                    <input className="form-input" value={m.workplace} onChange={(e) => setFamilyMember(i, "workplace", e.target.value)} style={{ minWidth: 100 }} />
                  </td>
                  <td style={{ border: "1px solid #e2e8f0", padding: 4 }}>
                    <input className="form-input" value={m.notes} onChange={(e) => setFamilyMember(i, "notes", e.target.value)} style={{ minWidth: 120 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="障害・手帳情報">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <FormRow label="障害名">
            <input className="form-input" value={front.disability_name} placeholder="例: 自閉スペクトラム症" onChange={(e) => set("disability_name", e.target.value)} />
          </FormRow>
          <FormRow label="受給者証番号">
            <input className="form-input" value={front.recipient_number} onChange={(e) => set("recipient_number", e.target.value)} />
          </FormRow>
          <FormRow label="療育手帳交付日">
            <input className="form-input" type="date" value={front.therapy_notebook_date} onChange={(e) => set("therapy_notebook_date", e.target.value)} />
          </FormRow>
          <FormRow label="身体障害者番号">
            <input className="form-input" value={front.physical_disability_number} onChange={(e) => set("physical_disability_number", e.target.value)} />
          </FormRow>
        </div>
      </SectionCard>

      <SectionCard title="生育歴・健康・生活状況">
        <FormRow label="生育歴">
          <textarea className="form-input" style={{ minHeight: 80, resize: "vertical" }} value={front.growth_history} onChange={(e) => set("growth_history", e.target.value)} />
        </FormRow>
        <FormRow label="健康面・通院歴・諸検査">
          <textarea className="form-input" style={{ minHeight: 80, resize: "vertical" }} value={front.health_history} onChange={(e) => set("health_history", e.target.value)} />
        </FormRow>
        <FormRow label="家庭での様子">
          <textarea className="form-input" style={{ minHeight: 80, resize: "vertical" }} value={front.home_situation} onChange={(e) => set("home_situation", e.target.value)} />
        </FormRow>
        <FormRow label="通学状況">
          <textarea className="form-input" style={{ minHeight: 60, resize: "vertical" }} value={front.school_situation} onChange={(e) => set("school_situation", e.target.value)} />
        </FormRow>
      </SectionCard>
    </>
  );
}

// ==================== フェイスシート（裏）フォーム ====================

function FacesheetBackForm({ back, onChange }: { back: FacesheetBack; onChange: (v: FacesheetBack) => void }) {
  const set = <K extends keyof FacesheetBack>(field: K, val: FacesheetBack[K]) =>
    onChange({ ...back, [field]: val });

  return (
    <>
      <SectionCard title="緊急時連絡情報">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <FormRow label="健康保険番号">
            <input className="form-input" value={back.health_insurance_number} onChange={(e) => set("health_insurance_number", e.target.value)} />
          </FormRow>
          <FormRow label="平熱（度）">
            <input className="form-input" value={back.normal_temperature} placeholder="例: 36.5" onChange={(e) => set("normal_temperature", e.target.value)} />
          </FormRow>
        </div>
        <FormRow label="緊急時搬送（救急車の場合の連絡先）">
          <input className="form-input" value={back.emergency_ambulance} onChange={(e) => set("emergency_ambulance", e.target.value)} />
        </FormRow>
        <FormRow label="ご家族連絡先">
          <input className="form-input" value={back.emergency_family_contact} onChange={(e) => set("emergency_family_contact", e.target.value)} />
        </FormRow>
        <FormRow label="かかりつけ病院">
          <input className="form-input" value={back.family_doctor} placeholder="病院名・電話番号" onChange={(e) => set("family_doctor", e.target.value)} />
        </FormRow>
      </SectionCard>

      <SectionCard title="医療情報">
        <FormRow label="診断名">
          <input className="form-input" value={back.diagnosis_detail} onChange={(e) => set("diagnosis_detail", e.target.value)} />
        </FormRow>
        <FormRow label="内服薬">
          <textarea className="form-input" style={{ minHeight: 60, resize: "vertical" }} value={back.medications} onChange={(e) => set("medications", e.target.value)} />
        </FormRow>
        <FormRow label="障害の注意点">
          <textarea className="form-input" style={{ minHeight: 60, resize: "vertical" }} value={back.disability_notes} onChange={(e) => set("disability_notes", e.target.value)} />
        </FormRow>
        <FormRow label="アレルギー（薬名）">
          <input className="form-input" value={back.allergies} onChange={(e) => set("allergies", e.target.value)} />
        </FormRow>
      </SectionCard>

      <SectionCard title="現在の状況・性格">
        <FormRow label="現在の症状・行動の特徴">
          <textarea className="form-input" style={{ minHeight: 80, resize: "vertical" }} value={back.current_symptoms} onChange={(e) => set("current_symptoms", e.target.value)} />
        </FormRow>
        <FormRow label="性格（こだわり）">
          <textarea className="form-input" style={{ minHeight: 60, resize: "vertical" }} value={back.personality} onChange={(e) => set("personality", e.target.value)} />
        </FormRow>
        <FormRow label="好きなこと">
          <input className="form-input" value={back.likes} onChange={(e) => set("likes", e.target.value)} />
        </FormRow>
        <FormRow label="苦手なこと">
          <input className="form-input" value={back.dislikes} onChange={(e) => set("dislikes", e.target.value)} />
        </FormRow>
      </SectionCard>

      <SectionCard title="特徴と生活習慣">
        <FormRow label="あいさつ">
          <RadioButtons value={back.greeting} options={["自分からできる", "できない"]} onChange={(v) => set("greeting", v)} />
        </FormRow>
        <FormRow label="言語">
          <CheckButtons values={back.language} options={["ことば", "単語", "サイン", "なし"]} onChange={(v) => set("language", v)} />
        </FormRow>
        <FormRow label="食事">
          <RadioButtons value={back.eating} options={["できる", "一部介助", "全介助"]} onChange={(v) => set("eating", v)} />
        </FormRow>
        <FormRow label="安全意識">
          <RadioButtons value={back.safety_awareness} options={["できる", "一部できる", "できない"]} onChange={(v) => set("safety_awareness", v)} />
        </FormRow>
        <FormRow label="歩行障害">
          <RadioButtons value={back.walking_disability} options={["ある", "なし"]} onChange={(v) => set("walking_disability", v)} />
        </FormRow>
        <FormRow label="問題行動">
          <CheckButtons values={back.problem_behavior} options={["大声", "多動", "異食行動"]} onChange={(v) => set("problem_behavior", v)} />
          <input className="form-input" style={{ marginTop: 6 }} value={back.problem_behavior_other} placeholder="その他" onChange={(e) => set("problem_behavior_other", e.target.value)} />
        </FormRow>
        <FormRow label="コミュニケーション">
          <RadioButtons value={back.communication} options={["とれる", "とれない", "時々"]} onChange={(v) => set("communication", v)} />
        </FormRow>
        <FormRow label="衣服の着脱">
          <RadioButtons value={back.dressing} options={["できる", "一部介助", "全介助"]} onChange={(v) => set("dressing", v)} />
        </FormRow>
        <FormRow label="排泄">
          <RadioButtons value={back.toileting} options={["できる", "一部介助", "全介助"]} onChange={(v) => set("toileting", v)} />
        </FormRow>
        <FormRow label="整理整頓">
          <RadioButtons value={back.tidiness} options={["できる", "一部介助", "全介助"]} onChange={(v) => set("tidiness", v)} />
        </FormRow>
        <FormRow label="身だしなみ">
          <RadioButtons value={back.grooming} options={["できる", "一部介助", "全介助"]} onChange={(v) => set("grooming", v)} />
        </FormRow>
        <FormRow label="過敏性">
          <CheckButtons values={back.hypersensitivity} options={["聴覚", "視覚", "触覚", "味覚"]} onChange={(v) => set("hypersensitivity", v)} />
          <input className="form-input" style={{ marginTop: 6 }} value={back.hypersensitivity_other} placeholder="その他" onChange={(e) => set("hypersensitivity_other", e.target.value)} />
        </FormRow>
        <FormRow label="ルールの理解">
          <RadioButtons value={back.rule_understanding} options={["できる", "一部できる", "できない"]} onChange={(v) => set("rule_understanding", v)} />
        </FormRow>
        <FormRow label="その他（生活習慣）">
          <input className="form-input" value={back.other_habits} onChange={(e) => set("other_habits", e.target.value)} />
        </FormRow>
      </SectionCard>
    </>
  );
}

// ==================== アセスメントシートフォーム ====================

function AssessmentForm({ assessment, onChange }: { assessment: Assessment; onChange: (v: Assessment) => void }) {
  const set = (field: keyof Assessment, val: string) => onChange({ ...assessment, [field]: val });

  // 6領域のデータ定義
  const domains: { label: string; goodField: keyof Assessment; concernField: keyof Assessment }[] = [
    { label: "健康・生活",               goodField: "health_life_good",          concernField: "health_life_concern" },
    { label: "運動・感覚",               goodField: "motor_sensory_good",         concernField: "motor_sensory_concern" },
    { label: "認知・行動",               goodField: "cognitive_behavior_good",    concernField: "cognitive_behavior_concern" },
    { label: "言語・コミュニケーション", goodField: "language_comm_good",         concernField: "language_comm_concern" },
    { label: "人間性・社会性",           goodField: "social_good",                concernField: "social_concern" },
    { label: "その他",                   goodField: "other_good",                 concernField: "other_concern" },
  ];

  return (
    <>
      <SectionCard title="要望・願い">
        <FormRow label="施設への要望">
          <textarea className="form-input" style={{ minHeight: 70, resize: "vertical" }} value={assessment.facility_request} onChange={(e) => set("facility_request", e.target.value)} />
        </FormRow>
        <FormRow label="保護者の願い">
          <textarea className="form-input" style={{ minHeight: 70, resize: "vertical" }} value={assessment.parent_wish} onChange={(e) => set("parent_wish", e.target.value)} />
        </FormRow>
        <FormRow label="本人の願い">
          <textarea className="form-input" style={{ minHeight: 70, resize: "vertical" }} value={assessment.child_wish} onChange={(e) => set("child_wish", e.target.value)} />
        </FormRow>
      </SectionCard>

      <SectionCard title="6領域アセスメント">
        {domains.map((domain) => (
          <div key={domain.label} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0a2540", marginBottom: 8 }}>■ {domain.label}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <FormRow label="良いところ（興味・関心）">
                <textarea className="form-input" style={{ minHeight: 60, resize: "vertical" }}
                  value={String(assessment[domain.goodField])}
                  onChange={(e) => set(domain.goodField, e.target.value)} />
              </FormRow>
              <FormRow label="気になるところ">
                <textarea className="form-input" style={{ minHeight: 60, resize: "vertical" }}
                  value={String(assessment[domain.concernField])}
                  onChange={(e) => set(domain.concernField, e.target.value)} />
              </FormRow>
            </div>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="作成情報">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <FormRow label="保護者氏名">
            <input className="form-input" value={assessment.parent_name} placeholder="保護者のお名前" onChange={(e) => set("parent_name", e.target.value)} />
          </FormRow>
          <FormRow label="作成日">
            <input className="form-input" type="date" value={assessment.created_date} onChange={(e) => set("created_date", e.target.value)} />
          </FormRow>
        </div>
      </SectionCard>
    </>
  );
}

// ==================== 印刷コンポーネント ====================

type ChildType = typeof DUMMY_CHILDREN[number];
type FacType = typeof DUMMY_FACILITIES[number] | undefined;

/** フェイスシート（表）印刷レイアウト */
function PrintFront({ front, child, fac, age }: { front: FacesheetFront; child: ChildType; fac: FacType; age: number }) {
  const entryYear  = front.entry_date ? new Date(front.entry_date).getFullYear() : "　　";
  const entryMonth = front.entry_date ? new Date(front.entry_date).getMonth() + 1 : "　";
  const entryDay   = front.entry_date ? new Date(front.entry_date).getDate() : "　";

  return (
    <div>
      <div className="print-title">フェイスシート</div>
      <div style={{ textAlign: "right", fontSize: 11, marginBottom: 8 }}>
        記入日：{entryYear}年{entryMonth}月{entryDay}日
      </div>

      <table className="print-table" style={{ marginBottom: 10 }}>
        <tbody>
          <tr>
            <th style={{ width: 100 }}>氏名</th>
            <td style={{ width: 160 }}>{child.name}</td>
            <th style={{ width: 100 }}>ふりがな</th>
            <td>{child.name_kana}</td>
          </tr>
          <tr>
            <th>性別</th>
            <td>{child.gender}</td>
            <th>生年月日</th>
            <td>{child.dob}（{age}歳）</td>
          </tr>
          <tr>
            <th>学年</th>
            <td>{child.grade}</td>
            <th>担任名</th>
            <td>{front.homeroom_teacher}</td>
          </tr>
          <tr>
            <th>所属施設</th>
            <td>{fac?.name}</td>
            <th></th>
            <td></td>
          </tr>
        </tbody>
      </table>

      <table className="print-table" style={{ marginBottom: 10 }}>
        <tbody>
          <tr>
            <th style={{ width: 100 }}>現住所</th>
            <td>{front.address}</td>
          </tr>
          <tr>
            <th>緊急連絡先</th>
            <td>{front.emergency_contact}</td>
          </tr>
        </tbody>
      </table>

      <div className="print-subtitle">家族構成</div>
      <table className="print-table" style={{ marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={{ width: 60 }}>続柄</th>
            <th style={{ width: 100 }}>氏名</th>
            <th style={{ width: 100 }}>生年月日</th>
            <th style={{ width: 120 }}>勤務先（学校）</th>
            <th>家族の様子・配慮事項</th>
          </tr>
        </thead>
        <tbody>
          {front.family_members.map((m, i) => (
            <tr key={i}>
              <td>{m.relationship}</td>
              <td>{m.name}</td>
              <td>{m.dob}</td>
              <td>{m.workplace}</td>
              <td>{m.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="print-table" style={{ marginBottom: 10 }}>
        <tbody>
          <tr>
            <th style={{ width: 140 }}>障害名</th>
            <td>{front.disability_name}</td>
            <th style={{ width: 140 }}>受給者証番号</th>
            <td>{front.recipient_number}</td>
          </tr>
          <tr>
            <th>療育手帳交付日</th>
            <td>{front.therapy_notebook_date}</td>
            <th>身体障害者番号</th>
            <td>{front.physical_disability_number}</td>
          </tr>
        </tbody>
      </table>

      <div className="print-subtitle">生育歴</div>
      <div className="print-box" style={{ minHeight: 70 }}>{front.growth_history}</div>

      <div className="print-subtitle">健康面・通院歴・諸検査</div>
      <div className="print-box" style={{ minHeight: 70 }}>{front.health_history}</div>

      <div className="print-subtitle">家庭での様子</div>
      <div className="print-box" style={{ minHeight: 60 }}>{front.home_situation}</div>

      <div className="print-subtitle">通学状況</div>
      <div className="print-box" style={{ minHeight: 50 }}>{front.school_situation}</div>
    </div>
  );
}

/** フェイスシート（裏）印刷レイアウト */
function PrintBack({ back, child }: { back: FacesheetBack; child: ChildType }) {
  // チェック項目の表示用ヘルパー（選択済みに○）
  const checkMark = (values: string[], opt: string) => values.includes(opt) ? "○" : "　";
  const radioMark = (value: string, opt: string) => value === opt ? "○" : "　";

  return (
    <div>
      <div className="print-title">フェイスシート（裏）</div>

      <table className="print-table" style={{ marginBottom: 10 }}>
        <tbody>
          <tr>
            <th style={{ width: 100 }}>氏名</th>
            <td colSpan={3}>{child.name}</td>
          </tr>
        </tbody>
      </table>

      <div className="print-subtitle">緊急時連絡方法（健康保険番号：{back.health_insurance_number}）</div>
      <table className="print-table" style={{ marginBottom: 10 }}>
        <tbody>
          <tr>
            <th style={{ width: 140 }}>緊急時搬送</th>
            <td>{back.emergency_ambulance}</td>
            <th style={{ width: 100 }}>ご家族連絡先</th>
            <td>{back.emergency_family_contact}</td>
          </tr>
          <tr>
            <th>かかりつけ病院</th>
            <td>{back.family_doctor}</td>
            <th>平熱</th>
            <td>{back.normal_temperature} 度</td>
          </tr>
          <tr>
            <th>診断名</th>
            <td>{back.diagnosis_detail}</td>
            <th>内服薬</th>
            <td>{back.medications}</td>
          </tr>
          <tr>
            <th>障害の注意点</th>
            <td colSpan={3}>{back.disability_notes}</td>
          </tr>
          <tr>
            <th>アレルギー</th>
            <td colSpan={3}>{back.allergies}</td>
          </tr>
        </tbody>
      </table>

      <div className="print-subtitle">現在の症状・行動の特徴</div>
      <div className="print-box" style={{ minHeight: 50 }}>{back.current_symptoms}</div>

      <div className="print-subtitle">特徴と生活習慣</div>
      <table className="print-table" style={{ marginBottom: 10 }}>
        <tbody>
          <tr>
            <th style={{ width: 120 }}>あいさつ</th>
            <td>
              {radioMark(back.greeting, "自分からできる")} 自分からできる
              {radioMark(back.greeting, "できない")} できない
            </td>
          </tr>
          <tr>
            <th>言語</th>
            <td>
              {checkMark(back.language, "ことば")} ことば
              {checkMark(back.language, "単語")} 単語
              {checkMark(back.language, "サイン")} サイン
              {checkMark(back.language, "なし")} なし
            </td>
          </tr>
          <tr>
            <th>食事</th>
            <td>
              {radioMark(back.eating, "できる")} できる
              {radioMark(back.eating, "一部介助")} 一部介助
              {radioMark(back.eating, "全介助")} 全介助
            </td>
          </tr>
          <tr>
            <th>安全意識</th>
            <td>
              {radioMark(back.safety_awareness, "できる")} できる
              {radioMark(back.safety_awareness, "一部できる")} 一部できる
              {radioMark(back.safety_awareness, "できない")} できない
            </td>
          </tr>
          <tr>
            <th>歩行障害</th>
            <td>
              {radioMark(back.walking_disability, "ある")} ある
              {radioMark(back.walking_disability, "なし")} なし
            </td>
          </tr>
          <tr>
            <th>問題行動</th>
            <td>
              {checkMark(back.problem_behavior, "大声")} 大声
              {checkMark(back.problem_behavior, "多動")} 多動
              {checkMark(back.problem_behavior, "異食行動")} 異食行動
              {back.problem_behavior_other && `　その他: ${back.problem_behavior_other}`}
            </td>
          </tr>
          <tr>
            <th>コミュニケーション</th>
            <td>
              {radioMark(back.communication, "とれる")} とれる
              {radioMark(back.communication, "とれない")} とれない
              {radioMark(back.communication, "時々")} 時々
            </td>
          </tr>
          <tr>
            <th>衣服の着脱</th>
            <td>
              {radioMark(back.dressing, "できる")} できる
              {radioMark(back.dressing, "一部介助")} 一部介助
              {radioMark(back.dressing, "全介助")} 全介助
            </td>
          </tr>
          <tr>
            <th>排泄</th>
            <td>
              {radioMark(back.toileting, "できる")} できる
              {radioMark(back.toileting, "一部介助")} 一部介助
              {radioMark(back.toileting, "全介助")} 全介助
            </td>
          </tr>
          <tr>
            <th>整理整頓</th>
            <td>
              {radioMark(back.tidiness, "できる")} できる
              {radioMark(back.tidiness, "一部介助")} 一部介助
              {radioMark(back.tidiness, "全介助")} 全介助
            </td>
          </tr>
          <tr>
            <th>身だしなみ</th>
            <td>
              {radioMark(back.grooming, "できる")} できる
              {radioMark(back.grooming, "一部介助")} 一部介助
              {radioMark(back.grooming, "全介助")} 全介助
            </td>
          </tr>
          <tr>
            <th>過敏性</th>
            <td>
              {checkMark(back.hypersensitivity, "聴覚")} 聴覚
              {checkMark(back.hypersensitivity, "視覚")} 視覚
              {checkMark(back.hypersensitivity, "触覚")} 触覚
              {checkMark(back.hypersensitivity, "味覚")} 味覚
              {back.hypersensitivity_other && `　その他: ${back.hypersensitivity_other}`}
            </td>
          </tr>
          <tr>
            <th>ルールの理解</th>
            <td>
              {radioMark(back.rule_understanding, "できる")} できる
              {radioMark(back.rule_understanding, "一部できる")} 一部できる
              {radioMark(back.rule_understanding, "できない")} できない
            </td>
          </tr>
          <tr>
            <th>その他（生活習慣）</th>
            <td>{back.other_habits}</td>
          </tr>
        </tbody>
      </table>

      <div className="print-subtitle">性格・好き嫌い</div>
      <table className="print-table">
        <tbody>
          <tr>
            <th style={{ width: 120 }}>性格（こだわり）</th>
            <td>{back.personality}</td>
          </tr>
          <tr>
            <th>好きなこと</th>
            <td>{back.likes}</td>
          </tr>
          <tr>
            <th>苦手なこと</th>
            <td>{back.dislikes}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ==================== 個別支援計画フォーム ====================

const PERIOD_OPTIONS = ["1ヶ月", "2ヶ月", "3ヶ月", "4ヶ月", "5ヶ月", "6ヶ月", "1年"];
const FREQ_OPTIONS = ["毎日", "週3回以上", "週1〜2回", "月数回", "随時", "その都度"];

type FinalProps = {
  manager_confirmed_date: string;
  next_monitoring_date: string;
  effective_start: string;
  effective_end: string;
  onChangeFinal: (field: keyof SupportPlanFinal, val: string) => void;
};

function SupportPlanForm({
  plan,
  onChange,
  isDraft,
  finalProps,
}: {
  plan: SupportPlanDraft;
  onChange: (v: SupportPlanDraft) => void;
  isDraft: boolean;
  finalProps?: FinalProps;
}) {
  const set = (field: keyof SupportPlanDraft, val: string) =>
    onChange({ ...plan, [field]: val });

  const setGoal = (i: number, field: keyof PlanGoal, val: string) => {
    const goals = [...plan.short_term_goals];
    goals[i] = { ...goals[i], [field]: val };
    onChange({ ...plan, short_term_goals: goals });
  };

  const addGoal = () =>
    onChange({ ...plan, short_term_goals: [...plan.short_term_goals, { goal: "", period: "3ヶ月", achievement: "" }] });

  const removeGoal = (i: number) =>
    onChange({ ...plan, short_term_goals: plan.short_term_goals.filter((_, idx) => idx !== i) });

  const setItem = (i: number, field: keyof PlanSupportItem, val: string) => {
    const items = [...plan.support_items];
    items[i] = { ...items[i], [field]: val };
    onChange({ ...plan, support_items: items });
  };

  const addItem = () =>
    onChange({ ...plan, support_items: [...plan.support_items, { target: "", method: "", frequency: "毎日", staff: "" }] });

  const removeItem = (i: number) =>
    onChange({ ...plan, support_items: plan.support_items.filter((_, idx) => idx !== i) });

  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 };
  const sec = (title: string, children: React.ReactNode) => (
    <div className="card" style={{ padding: "16px 20px", marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0077b6", marginBottom: 12, borderBottom: "1.5px solid #e2e8f0", paddingBottom: 8 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <>
      {/* タイトル */}
      <div style={{ textAlign: "center", marginBottom: 16, padding: "14px 20px", background: "linear-gradient(135deg,#0a2540,#0077b6)", borderRadius: 12, color: "white" }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>
          {isDraft ? "📝 個別支援計画書（原案）" : "📘 個別支援計画書（本書）"}
        </div>
      </div>

      {/* 計画期間 */}
      {sec("計画期間",
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <label style={lbl}>開始日</label>
            <input className="form-input" type="date" value={plan.plan_start} onChange={(e) => set("plan_start", e.target.value)} />
          </div>
          <div style={{ color: "#64748b", fontWeight: 600, marginTop: 16 }}>〜</div>
          <div>
            <label style={lbl}>終了日</label>
            <input className="form-input" type="date" value={plan.plan_end} onChange={(e) => set("plan_end", e.target.value)} />
          </div>
        </div>
      )}

      {/* 意向確認 */}
      {sec("意向確認",
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>本人の意向・希望</label>
            <textarea className="form-input" style={{ minHeight: 70, resize: "vertical" }}
              placeholder="本人が希望していること・やりたいこと"
              value={plan.child_wish} onChange={(e) => set("child_wish", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>家族の意向・希望</label>
            <textarea className="form-input" style={{ minHeight: 70, resize: "vertical" }}
              placeholder="保護者が希望していること・お子さんに身につけてほしいこと"
              value={plan.family_wish} onChange={(e) => set("family_wish", e.target.value)} />
          </div>
        </>
      )}

      {/* 支援方針 */}
      {sec("支援方針・優先課題",
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>総合的な支援の方針</label>
            <textarea className="form-input" style={{ minHeight: 80, resize: "vertical" }}
              placeholder="支援全体の方向性・大切にすること"
              value={plan.support_policy} onChange={(e) => set("support_policy", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>解決すべき課題（優先ニーズ）</label>
            <textarea className="form-input" style={{ minHeight: 60, resize: "vertical" }}
              placeholder="現時点で最も重要な支援課題"
              value={plan.priority_issue} onChange={(e) => set("priority_issue", e.target.value)} />
          </div>
        </>
      )}

      {/* 長期目標 */}
      {sec("長期目標",
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={lbl}>長期目標</label>
            <textarea className="form-input" style={{ minHeight: 70, resize: "vertical" }}
              placeholder="計画期間全体で達成を目指す目標"
              value={plan.long_term_goal} onChange={(e) => set("long_term_goal", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>期間</label>
            <select className="form-input" value={plan.long_term_period} onChange={(e) => set("long_term_period", e.target.value)}>
              {PERIOD_OPTIONS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* 短期目標 */}
      {sec("短期目標",
        <>
          {plan.short_term_goals.map((g, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#0077b6", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 24 }}>{i + 1}</div>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8 }}>
                <div>
                  <label style={lbl}>目標内容</label>
                  <input className="form-input" value={g.goal} placeholder={`短期目標${i + 1}`}
                    onChange={(e) => setGoal(i, "goal", e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>期間</label>
                  <select className="form-input" style={{ width: 100 }} value={g.period} onChange={(e) => setGoal(i, "period", e.target.value)}>
                    {PERIOD_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
                {!isDraft && (
                  <div>
                    <label style={lbl}>達成状況</label>
                    <select className="form-input" style={{ width: 110 }} value={g.achievement} onChange={(e) => setGoal(i, "achievement", e.target.value)}>
                      <option value="">未評価</option>
                      <option value="達成">達成</option>
                      <option value="概ね達成">概ね達成</option>
                      <option value="一部達成">一部達成</option>
                      <option value="未達成">未達成</option>
                      <option value="継続">継続</option>
                    </select>
                  </div>
                )}
              </div>
              {plan.short_term_goals.length > 1 && (
                <button onClick={() => removeGoal(i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, marginTop: 20, flexShrink: 0 }}>✕</button>
              )}
            </div>
          ))}
          <button className="btn-secondary" onClick={addGoal} style={{ fontSize: 12, padding: "6px 14px" }}>＋ 短期目標を追加</button>
        </>
      )}

      {/* 支援内容 */}
      {sec("支援内容・具体的な取り組み",
        <>
          <div style={{ overflowX: "auto", marginBottom: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["支援目標", "支援内容・方法", "頻度", "担当", ""].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", border: "1px solid #e2e8f0", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.support_items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ border: "1px solid #e2e8f0", padding: 6 }}>
                      <input className="form-input" value={item.target} placeholder="支援目標"
                        onChange={(e) => setItem(i, "target", e.target.value)} style={{ minWidth: 120 }} />
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: 6 }}>
                      <textarea className="form-input" value={item.method} placeholder="具体的な支援内容・方法"
                        onChange={(e) => setItem(i, "method", e.target.value)} style={{ minWidth: 180, minHeight: 60, resize: "vertical" }} />
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: 6 }}>
                      <select className="form-input" value={item.frequency} onChange={(e) => setItem(i, "frequency", e.target.value)} style={{ minWidth: 90 }}>
                        {FREQ_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                      </select>
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: 6 }}>
                      <input className="form-input" value={item.staff} placeholder="担当者"
                        onChange={(e) => setItem(i, "staff", e.target.value)} style={{ minWidth: 80 }} />
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: 6, textAlign: "center" }}>
                      {plan.support_items.length > 1 && (
                        <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-secondary" onClick={addItem} style={{ fontSize: 12, padding: "6px 14px" }}>＋ 行を追加</button>
        </>
      )}

      {/* 説明・同意 */}
      {sec("説明・同意確認",
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={lbl}>説明日</label>
            <input className="form-input" type="date" value={plan.explained_date} onChange={(e) => set("explained_date", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>同意日</label>
            <input className="form-input" type="date" value={plan.agreed_date} onChange={(e) => set("agreed_date", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>保護者氏名</label>
            <input className="form-input" value={plan.parent_signature} placeholder="保護者氏名（自署）"
              onChange={(e) => set("parent_signature", e.target.value)} />
          </div>
        </div>
      )}

      {/* 本書専用：管理者確認・有効期間 */}
      {!isDraft && finalProps && sec("管理者確認・有効期間",
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={lbl}>有効期間（開始）</label>
            <input className="form-input" type="date" value={finalProps.effective_start} onChange={(e) => finalProps.onChangeFinal("effective_start", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>有効期間（終了）</label>
            <input className="form-input" type="date" value={finalProps.effective_end} onChange={(e) => finalProps.onChangeFinal("effective_end", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>管理者確認日</label>
            <input className="form-input" type="date" value={finalProps.manager_confirmed_date} onChange={(e) => finalProps.onChangeFinal("manager_confirmed_date", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>次回モニタリング予定日</label>
            <input className="form-input" type="date" value={finalProps.next_monitoring_date} onChange={(e) => finalProps.onChangeFinal("next_monitoring_date", e.target.value)} />
          </div>
        </div>
      )}

      {/* 作成情報 */}
      {sec("作成情報",
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={lbl}>担当者</label>
            <input className="form-input" value={plan.author} placeholder="担当職員名"
              onChange={(e) => set("author", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>管理者</label>
            <input className="form-input" value={plan.manager} placeholder="管理者名"
              onChange={(e) => set("manager", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>作成日</label>
            <input className="form-input" type="date" value={plan.created_date}
              onChange={(e) => set("created_date", e.target.value)} />
          </div>
        </div>
      )}
    </>
  );
}

// ==================== 個別支援計画 印刷レイアウト ====================

function PrintSupportPlan({ plan, child, fac, isDraft }: {
  plan: SupportPlanDraft;
  child: typeof DUMMY_CHILDREN[number];
  fac: typeof DUMMY_FACILITIES[number] | undefined;
  isDraft: boolean;
}) {
  return (
    <div>
      <div className="print-title">
        個別支援計画書{isDraft ? "（原案）" : "（本書）"}　{fac?.name}
      </div>

      <table className="print-table" style={{ marginBottom: 10 }}>
        <tbody>
          <tr>
            <th style={{ width: 100 }}>利用者氏名</th>
            <td style={{ width: 160 }}>{child.name}</td>
            <th style={{ width: 80 }}>生年月日</th>
            <td>{child.dob}</td>
          </tr>
          <tr>
            <th>学年</th>
            <td>{child.grade}</td>
            <th>所属施設</th>
            <td>{fac?.name}</td>
          </tr>
          <tr>
            <th>計画期間</th>
            <td colSpan={3}>{plan.plan_start} 〜 {plan.plan_end}</td>
          </tr>
        </tbody>
      </table>

      <div className="print-subtitle">意向確認</div>
      <table className="print-table" style={{ marginBottom: 10 }}>
        <tbody>
          <tr>
            <th style={{ width: 140 }}>本人の意向・希望</th>
            <td>{plan.child_wish}</td>
          </tr>
          <tr>
            <th>家族の意向・希望</th>
            <td>{plan.family_wish}</td>
          </tr>
        </tbody>
      </table>

      <div className="print-subtitle">支援方針</div>
      <div className="print-box">{plan.support_policy}</div>

      <div className="print-subtitle">解決すべき課題</div>
      <div className="print-box" style={{ minHeight: 40 }}>{plan.priority_issue}</div>

      <div className="print-subtitle">長期目標（期間：{plan.long_term_period}）</div>
      <div className="print-box">{plan.long_term_goal}</div>

      <div className="print-subtitle">短期目標</div>
      <table className="print-table" style={{ marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={{ width: 30 }}>No.</th>
            <th>目標内容</th>
            <th style={{ width: 70 }}>期間</th>
            {!isDraft && <th style={{ width: 90 }}>達成状況</th>}
          </tr>
        </thead>
        <tbody>
          {plan.short_term_goals.map((g, i) => (
            <tr key={i}>
              <td style={{ textAlign: "center" }}>{i + 1}</td>
              <td>{g.goal}</td>
              <td>{g.period}</td>
              {!isDraft && <td>{g.achievement}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="print-subtitle">支援内容</div>
      <table className="print-table" style={{ marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={{ width: 120 }}>支援目標</th>
            <th>支援内容・方法</th>
            <th style={{ width: 80 }}>頻度</th>
            <th style={{ width: 80 }}>担当</th>
          </tr>
        </thead>
        <tbody>
          {plan.support_items.map((item, i) => (
            <tr key={i}>
              <td>{item.target}</td>
              <td>{item.method}</td>
              <td>{item.frequency}</td>
              <td>{item.staff}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="print-table" style={{ marginBottom: 10 }}>
        <tbody>
          <tr>
            <th style={{ width: 120 }}>説明日</th>
            <td>{plan.explained_date}</td>
            <th style={{ width: 120 }}>同意日</th>
            <td>{plan.agreed_date}</td>
          </tr>
          <tr>
            <th>保護者氏名</th>
            <td>{plan.parent_signature}</td>
            <th>担当者</th>
            <td>{plan.author}</td>
          </tr>
          <tr>
            <th>管理者</th>
            <td>{plan.manager}</td>
            <th>作成日</th>
            <td>{plan.created_date}</td>
          </tr>
        </tbody>
      </table>

      {!isDraft && (
        <table className="print-table">
          <tbody>
            <tr>
              <th style={{ width: 160 }}>有効期間</th>
              <td>{(plan as SupportPlanFinal).effective_start} 〜 {(plan as SupportPlanFinal).effective_end}</td>
            </tr>
            <tr>
              <th>管理者確認日</th>
              <td>{(plan as SupportPlanFinal).manager_confirmed_date}</td>
            </tr>
            <tr>
              <th>次回モニタリング予定</th>
              <td>{(plan as SupportPlanFinal).next_monitoring_date}</td>
            </tr>
            <tr>
              <th>管理者署名欄</th>
              <td style={{ minHeight: 40 }}></td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

/** アセスメントシート印刷レイアウト */
function PrintAssessment({ assessment, child }: { assessment: Assessment; child: ChildType }) {
  const domains = [
    { label: "健康・生活",               good: assessment.health_life_good,          concern: assessment.health_life_concern },
    { label: "運動・感覚",               good: assessment.motor_sensory_good,         concern: assessment.motor_sensory_concern },
    { label: "認知・行動",               good: assessment.cognitive_behavior_good,    concern: assessment.cognitive_behavior_concern },
    { label: "言語・コミュニケーション", good: assessment.language_comm_good,         concern: assessment.language_comm_concern },
    { label: "人間性・社会性",           good: assessment.social_good,                concern: assessment.social_concern },
    { label: "その他",                   good: assessment.other_good,                 concern: assessment.other_concern },
  ];

  return (
    <div>
      <div className="print-title">アセスメントシート　GO GROUP</div>

      <table className="print-table" style={{ marginBottom: 10 }}>
        <tbody>
          <tr>
            <th style={{ width: 80 }}>氏名</th>
            <td style={{ width: 160 }}>{child.name}</td>
            <th style={{ width: 60 }}>性別</th>
            <td style={{ width: 60 }}>{child.gender}</td>
            <th style={{ width: 60 }}>学年</th>
            <td>{child.grade}</td>
          </tr>
        </tbody>
      </table>

      <div className="print-subtitle">施設への要望</div>
      <div className="print-box" style={{ minHeight: 50 }}>{assessment.facility_request}</div>

      <table className="print-table" style={{ marginBottom: 10 }}>
        <tbody>
          <tr>
            <th style={{ width: 140 }}>保護者の願い</th>
            <td>{assessment.parent_wish}</td>
          </tr>
          <tr>
            <th>本人の願い</th>
            <td>{assessment.child_wish}</td>
          </tr>
        </tbody>
      </table>

      <div className="print-subtitle">6領域アセスメント</div>
      <table className="print-table" style={{ marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={{ width: 140 }}>領域</th>
            <th>良いところ（興味・関心）</th>
            <th>気になるところ</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) => (
            <tr key={d.label}>
              <th>{d.label}</th>
              <td style={{ minHeight: 40 }}>{d.good}</td>
              <td style={{ minHeight: 40 }}>{d.concern}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="print-table">
        <tbody>
          <tr>
            <th style={{ width: 120 }}>保護者氏名</th>
            <td style={{ width: 200 }}>{assessment.parent_name}</td>
            <th style={{ width: 80 }}>作成日</th>
            <td>{assessment.created_date}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
