"use client";
// ==================== ダッシュボード ====================
// 今日の状況をSupabaseのリアルデータで表示

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DUMMY_FACILITIES, DUMMY_CHILDREN } from "@/lib/dummy-data";
import { fetchByDate, fetchByFacility } from "@/lib/supabase";
import type { UserSession, AttendanceRecord, ActivityRecord, Child } from "@/types";
import { useSession } from "@/hooks/useSession";

function getTodayDow(): string {
  return ["日","月","火","水","木","金","土"][new Date().getDay()];
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function getTodayDisplay(): string {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${getTodayDow()}）`;
}

export default function DashboardPage() {
  const router = useRouter();
  const session = useSession();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [dbChildren, setDbChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  // Supabaseからリアルデータ取得
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    Promise.all([
      fetchByDate<AttendanceRecord>("ng_attendance", session.org_id, session.selected_facility_id, todayISO()),
      fetchByDate<ActivityRecord>("ng_activities", session.org_id, session.selected_facility_id, todayISO()),
      fetchByFacility<Child>("ng_children", session.org_id, session.selected_facility_id),
    ]).then(([att, act, children]) => {
      setAttendance(att);
      setActivities(act);
      if (children.length > 0) setDbChildren(children.filter((c) => c.active));
      setLoading(false);
    });
  }, [session]);

  if (!session) return null;

  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);
  const todayDow = getTodayDow();

  // 児童リスト：Supabaseにあればそちら、なければダミー
  const allChildren = dbChildren.length > 0 ? dbChildren : DUMMY_CHILDREN.filter(
    (c) => c.facility_id === session.selected_facility_id && c.active
  );
  const todayScheduled = allChildren.filter((c) => (c.use_days ?? []).includes(todayDow));

  // リアルタイム集計
  const arrivedCount = attendance.filter((a) => a.status === "来所" && a.arrive_time).length;
  const absentCount  = attendance.filter((a) => a.status === "欠席").length;
  const leftCount    = attendance.filter((a) => a.depart_time).length;

  const shortcuts = [
    { icon: "📋", label: "入退室記録",  href: "/attendance",   color: "#0077b6", desc: "来所・退所・体温" },
    { icon: "👦", label: "児童一覧",    href: "/children",     color: "#0096c7", desc: "利用者情報" },
    { icon: "📸", label: "活動記録",    href: "/activities",   color: "#00b4d8", desc: "活動・写真" },
    { icon: "💬", label: "保護者連絡",  href: "/messages",     color: "#7c3aed", desc: "メッセージ" },
    { icon: "📓", label: "業務日報",    href: "/daily-report", color: "#059669", desc: "日報作成" },
    { icon: "📋", label: "支援計画",    href: "/support-plan", color: "#d97706", desc: "個別支援計画" },
  ];

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0a2540", letterSpacing: "-0.02em" }}>
          {fac?.name ?? "GO GROUP"}
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
          {getTodayDisplay()} ｜ ようこそ、{session.name}さん
        </div>
      </div>

      {/* リアルタイム サマリーカード */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
        <SummaryCard icon="📅" label="来所予定"  value={`${todayScheduled.length}名`} color="#0077b6" sub={`${todayDow}曜登録`} />
        {loading ? (
          <SummaryCard icon="📋" label="来所済"   value="..."  color="#059669" sub="読み込み中" />
        ) : (
          <SummaryCard icon="📋" label="来所済"   value={`${arrivedCount}名`} color="#059669" sub="本日来所" />
        )}
        <SummaryCard icon="🚌" label="送迎あり"  value={`${todayScheduled.filter((c) => c.has_transport).length}名`} color="#0096c7" sub="本日送迎対象" />
        {loading ? (
          <SummaryCard icon="📸" label="活動記録"  value="..."  color="#d97706" sub="読み込み中" />
        ) : (
          <SummaryCard icon="📸" label="活動記録"  value={`${activities.length}件`} color="#d97706" sub="本日登録" />
        )}
      </div>

      {/* 本日の状況バー（入退室） */}
      {!loading && attendance.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0a2540", marginBottom: 10 }}>
            📊 本日の入退室状況
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "来所済", count: arrivedCount, color: "#059669", bg: "#dcfce7" },
              { label: "退所済", count: leftCount,    color: "#0077b6", bg: "#dbeafe" },
              { label: "欠席",   count: absentCount,  color: "#94a3b8", bg: "#f1f5f9" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ padding: "3px 10px", borderRadius: 12, background: item.bg, color: item.color, fontWeight: 700, fontSize: 12 }}>
                  {item.label} {item.count}名
                </span>
              </div>
            ))}
          </div>

          {/* 入退室バー */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
            {attendance.map((rec) => (
              <div key={rec.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                <div style={{ width: 80, fontWeight: 600, color: "#1e293b", flexShrink: 0 }}>{rec.child_name}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {rec.arrive_time && (
                    <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>
                      来所 {rec.arrive_time}
                    </span>
                  )}
                  {rec.depart_time && (
                    <span style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>
                      退所 {rec.depart_time}
                    </span>
                  )}
                  {rec.status === "欠席" && (
                    <span style={{ background: "#f1f5f9", color: "#64748b", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>欠席</span>
                  )}
                  {rec.temperature && (
                    <span style={{ background: "#fef9c3", color: "#854d0e", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>
                      🌡️ {rec.temperature}℃
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ショートカット */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 12 }}>QUICK ACCESS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {shortcuts.map((s) => (
            <button key={s.href} onClick={() => router.push(s.href)}
              style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 12px", textAlign: "center", cursor: "pointer", transition: "box-shadow 0.15s, transform 0.1s", fontFamily: "inherit" }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 今日の来所予定リスト */}
      {todayScheduled.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0a2540", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            📋 本日の来所予定 ({todayDow}曜)
            <span className="badge badge-blue">{todayScheduled.length}名</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {todayScheduled.map((child) => {
              const rec = attendance.find((a) => a.child_id === child.id || a.child_name === child.name);
              return (
                <div key={child.id}
                  onClick={() => router.push(`/children/${child.id}`)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#0077b6,#00b4d8)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                    {child.name.slice(0, 1)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{child.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{child.grade} ／ {child.diagnosis}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {rec ? (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: rec.status === "来所" ? "#dcfce7" : rec.status === "欠席" ? "#f1f5f9" : "#fef9c3", color: rec.status === "来所" ? "#166534" : rec.status === "欠席" ? "#64748b" : "#854d0e", fontWeight: 700 }}>
                        {rec.status === "来所" ? `✓ ${rec.arrive_time ?? "来所"}` : rec.status}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>未記録</span>
                    )}
                    {child.has_transport && <span className="badge badge-blue">🚌</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color, sub }: { icon: string; label: string; value: string; color: string; sub: string }) {
  return (
    <div className="card" style={{ padding: "16px", borderLeft: `4px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>
    </div>
  );
}
