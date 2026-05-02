"use client";
// ==================== 児童一覧 ====================
// Supabaseから児童データ取得。ダミーデータはフォールバック用。

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { fetchByOrg, normalizeChild } from "@/lib/supabase";
import type { UserSession, Child } from "@/types";
import { useSession } from "@/hooks/useSession";

const DOW_LIST = ["月","火","水","木","金"];
const GRADE_LIST = ["未就学","小1","小2","小3","小4","小5","小6","中1","中2","中3"];

export default function ChildrenPage() {
  const router = useRouter();
  const session = useSession();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDow, setFilterDow] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSchool, setFilterSchool] = useState("");

  // Supabaseから児童データ取得（5秒タイムアウト付き）
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetchByOrg<Child>("ng_children", session.org_id)
      .then((rows) => {
        const active = rows.filter((c) => c.active !== false);
        setChildren(active.length > 0 ? active.map(normalizeChild) : DUMMY_CHILDREN);
      })
      .catch(() => setChildren(DUMMY_CHILDREN))
      .finally(() => setLoading(false));
  }, [session]);

  if (!session) return null;

  // 施設フィルタ
  const baseChildren = children.filter(
    (c) =>
      c.active &&
      (session.role === "admin" || c.facility_id === session.selected_facility_id)
  );

  // 学校一覧を動的生成（重複なし・空白除外）
  const schoolList = Array.from(
    new Set(baseChildren.map((c) => c.school ?? "").filter(Boolean))
  ).sort();

  // 検索・絞り込み
  const filtered = baseChildren.filter((c) => {
    const matchSearch =
      !search ||
      c.name.includes(search) ||
      (c.name_kana ?? "").includes(search);
    const matchDow =
      !filterDow || (c.use_days ?? []).includes(filterDow);
    const matchGrade =
      !filterGrade || c.grade === filterGrade;
    const matchSchool =
      !filterSchool || (c.school ?? "") === filterSchool;
    return matchSearch && matchDow && matchGrade && matchSchool;
  });

  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, flexDirection: "column", gap: 12 }}>
      <div className="spinner" />
      <div style={{ fontSize: 13, color: "#64748b" }}>児童データを読み込み中...</div>
    </div>
  );

  return (
    <div>
      {/* ページヘッダー */}
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
            👦 児童一覧
          </h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
            {fac?.name ?? "全施設"} ／ {filtered.length}名表示
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => router.push("/children/new")}
        >
          ＋ 新規登録
        </button>
      </div>

      {/* 検索・フィルタバー */}
      <div
        className="card"
        style={{
          padding: "14px 16px",
          marginBottom: 16,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* 名前検索 */}
        <input
          className="form-input"
          style={{ flex: "1 1 200px", maxWidth: 300 }}
          placeholder="🔍 名前・ふりがなで検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {/* 曜日フィルタ */}
        <select
          className="form-input"
          style={{ width: "auto", flex: "0 0 auto" }}
          value={filterDow}
          onChange={(e) => setFilterDow(e.target.value)}
        >
          <option value="">曜日 すべて</option>
          {DOW_LIST.map((d) => (
            <option key={d} value={d}>{d}曜日</option>
          ))}
        </select>
        {/* 学年フィルタ */}
        <select
          className="form-input"
          style={{ width: "auto", flex: "0 0 auto" }}
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value)}
        >
          <option value="">学年 すべて</option>
          {GRADE_LIST.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        {/* 学校フィルタ */}
        <select
          className="form-input"
          style={{ width: "auto", flex: "0 0 auto" }}
          value={filterSchool}
          onChange={(e) => setFilterSchool(e.target.value)}
        >
          <option value="">学校 すべて</option>
          {schoolList.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {/* リセット */}
        {(search || filterDow || filterGrade || filterSchool) && (
          <button
            className="btn-secondary"
            onClick={() => { setSearch(""); setFilterDow(""); setFilterGrade(""); setFilterSchool(""); }}
            style={{ padding: "8px 14px", fontSize: 12 }}
          >
            ✕ リセット
          </button>
        )}
      </div>

      {/* 児童カードグリッド */}
      {filtered.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "48px",
            textAlign: "center",
            color: "#94a3b8",
            fontSize: 14,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>😔</div>
          該当する児童が見つかりません
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {filtered.map((child) => (
            <ChildCard
              key={child.id}
              child={child}
              onClick={() => router.push(`/children/${child.id}`)}
              facilityName={DUMMY_FACILITIES.find((f) => f.id === child.facility_id)?.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 児童カードコンポーネント
function ChildCard({
  child, onClick, facilityName,
}: {
  child: Child;
  onClick: () => void;
  facilityName?: string;
}) {
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
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: "16px",
        cursor: "pointer",
        transition: "box-shadow 0.15s, transform 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* アバター */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: child.gender === "女"
            ? "linear-gradient(135deg,#db2777,#f472b6)"
            : "linear-gradient(135deg,#0077b6,#00b4d8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          color: "white",
          fontWeight: 800,
          marginBottom: 10,
        }}
      >
        {child.name.slice(0, 1)}
      </div>

      {/* 名前 */}
      <div style={{ fontWeight: 800, fontSize: 15, color: "#0a2540", marginBottom: 2 }}>
        {child.name}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
        {child.name_kana}
      </div>

      {/* 情報 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {child.grade && (
          <span className="badge badge-blue">{child.grade}</span>
        )}
        {child.gender && (
          <span className={`badge ${child.gender === "女" ? "badge-purple" : "badge-blue"}`}>
            {child.gender}
          </span>
        )}
        <span style={{ fontSize: 11, color: "#64748b" }}>{age}歳</span>
      </div>

      {/* 利用曜日 */}
      {Array.isArray(child.use_days) && child.use_days.length > 0 && (
        <div style={{ display: "flex", gap: 3, marginBottom: 8, flexWrap: "wrap" }}>
          {["月","火","水","木","金"].map((d) => (
            <span
              key={d}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                background: child.use_days!.includes(d) ? "#0077b6" : "#f1f5f9",
                color: child.use_days!.includes(d) ? "white" : "#94a3b8",
              }}
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {/* 学校名 */}
      {child.school && (
        <div style={{ fontSize: 11, color: "#0077b6", marginBottom: 6, fontWeight: 600 }}>
          🏫 {child.school}
        </div>
      )}

      {/* 施設・送迎 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>{facilityName}</span>
        {child.has_transport && (
          <span className="badge badge-green">🚌 送迎</span>
        )}
      </div>
    </div>
  );
}
