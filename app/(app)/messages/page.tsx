"use client";
// ==================== 保護者連絡 ====================
// 利用者ごとの連絡帳。施設→保護者へのメッセージ送受信。

import { useState, useEffect, useRef } from "react";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { saveRecord, fetchByFacility, supabase } from "@/lib/supabase";
import type { UserSession, MessageRecord } from "@/types";
import { useSession } from "@/hooks/useSession";

function genId() { return crypto.randomUUID(); }
function nowStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

const DUMMY_MESSAGES: MessageRecord[] = [
  {
    id: "m1", org_id: "org_1", facility_id: "f1",
    child_id: "c1", child_name: "山本 こうた",
    from_name: "田中 美穂",
    body: "本日は元気に来所されました。午後は運動遊びを楽しみ、笑顔が多く見られました。帰りの送迎もスムーズでした。",
    is_read: false, replies: [], created_at: "2026/04/22 17:30",
  },
  {
    id: "m2", org_id: "org_1", facility_id: "f1",
    child_id: "c2", child_name: "鈴木 はるか",
    from_name: "田中 美穂",
    body: "本日は学習支援に集中して取り組めました。最後まで頑張る姿が印象的でした。",
    is_read: true, replies: ["ありがとうございます！家でも頑張ると言っていました😊"], created_at: "2026/04/21 17:45",
  },
];

const h1Style: React.CSSProperties = { fontSize: 20, fontWeight: 800, color: "#0a2540", margin: 0, display: "flex", alignItems: "center" };
const backBtnStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, color: "#0077b6", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 };

export default function MessagesPage() {
  const session = useSession();
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [selChildId, setSelChildId] = useState<string | null>(null);
  const [newBody, setNewBody] = useState("");
  const [reply, setReply] = useState("");
  const [view, setView] = useState<"list" | "thread" | "new">("list");
  const [loadingDB, setLoadingDB] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Supabase: 初期ロード + Realtime購読
  useEffect(() => {
    if (!session) return;
    setLoadingDB(true);

    // ① 初期データ取得
    fetchByFacility<MessageRecord>(
      "ng_messages",
      session.org_id,
      session.selected_facility_id
    ).then((rows) => {
      setMessages(rows);
      setLoadingDB(false);
    });

    // ② Realtime購読（この施設のメッセージをリアルタイム監視）
    const channel = supabase
      .channel(`messages_${session.selected_facility_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ng_messages",
          filter: `facility_id=eq.${session.selected_facility_id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            // 自分が送ったもの（既にstateにある）は重複しない
            setMessages((prev) => {
              const newMsg = payload.new as MessageRecord;
              if (prev.find((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === (payload.new as MessageRecord).id
                  ? (payload.new as MessageRecord)
                  : m
              )
            );
          }
        }
      )
      .subscribe();

    // クリーンアップ
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selChildId, messages]);

  if (!session) return null;
  if (loadingDB) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <span className="spinner" />
    </div>
  );

  const fac = DUMMY_FACILITIES.find((f) => f.id === session.selected_facility_id);
  const children = DUMMY_CHILDREN.filter((c) => c.active && c.facility_id === session.selected_facility_id);
  const thread = messages.filter((m) => m.child_id === selChildId).sort((a, b) => a.created_at > b.created_at ? 1 : -1);
  const unreadCount = messages.filter((m) => m.facility_id === session.selected_facility_id && !m.is_read).length;
  const latestByChild = children.map((child) => {
    const msgs = messages.filter((m) => m.child_id === child.id);
    const latest = msgs.sort((a, b) => b.created_at > a.created_at ? 1 : -1)[0];
    const unread = msgs.filter((m) => !m.is_read).length;
    return { child, latest, unread };
  });

  const handleSend = () => {
    if (!newBody.trim() || !selChildId) return;
    const child = children.find((c) => c.id === selChildId);
    const msg: MessageRecord = {
      id: genId(), org_id: session.org_id,
      facility_id: session.selected_facility_id,
      child_id: selChildId, child_name: child?.name ?? "",
      from_name: session.name, body: newBody,
      is_read: false, replies: [], created_at: nowStr(),
    };
    // Supabaseに保存
    saveRecord("ng_messages", msg as unknown as Record<string, unknown>);
    setMessages((p) => [...p, msg]);
    setNewBody("");
  };

  const handleReply = (msgId: string) => {
    if (!reply.trim()) return;
    const newReplyText = reply;
    setMessages((p) => p.map((m) => {
      if (m.id !== msgId) return m;
      const updated = { ...m, replies: [...m.replies, newReplyText], is_read: true, read_at: nowStr() };
      saveRecord("ng_messages", updated as unknown as Record<string, unknown>);
      return updated;
    }));
    setReply("");
  };

  // 既読にする（保護者が確認した想定）
  const handleMarkRead = (msgId: string) => {
    setMessages((p) => p.map((m) => {
      if (m.id !== msgId || m.is_read) return m;
      const updated = { ...m, is_read: true, read_at: nowStr() };
      saveRecord("ng_messages", updated as unknown as Record<string, unknown>);
      return updated;
    }));
  };

  const openThread = (childId: string) => {
    setSelChildId(childId);
    setView("thread");
    setMessages((p) => p.map((m) => {
      if (m.child_id !== childId || m.is_read) return m;
      const updated = { ...m, is_read: true };
      // 既読をSupabaseに保存
      saveRecord("ng_messages", updated as unknown as Record<string, unknown>);
      return updated;
    }));
  };

  // ===== 新規作成 =====
  if (view === "new") return (
    <div>
      <button onClick={() => setView("list")} style={backBtnStyle}>← 戻る</button>
      <h1 style={{ ...h1Style, margin: "12px 0 20px" }}>✉️ 新規連絡作成</h1>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>宛先（児童）</label>
          <select className="form-input" value={selChildId ?? ""} onChange={(e) => setSelChildId(e.target.value)}>
            <option value="">選択してください</option>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>メッセージ</label>
          <textarea className="form-input" style={{ minHeight: 120, resize: "vertical" }}
            placeholder="保護者へのメッセージを入力してください"
            value={newBody} onChange={(e) => setNewBody(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" disabled={!selChildId || !newBody.trim()}
            onClick={() => { handleSend(); setView("list"); setSelChildId(null); }}>
            送信する
          </button>
          <button className="btn-secondary" onClick={() => setView("list")}>キャンセル</button>
        </div>
      </div>
    </div>
  );

  // ===== スレッド =====
  if (view === "thread" && selChildId) {
    const child = children.find((c) => c.id === selChildId);
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexShrink: 0 }}>
          <button onClick={() => setView("list")} style={backBtnStyle}>← 戻る</button>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#0077b6,#00b4d8)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
            {child?.name.slice(0, 1)}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{child?.name}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{child?.parent_name} ／ {fac?.name}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8 }}>
          {thread.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0", fontSize: 13 }}>まだメッセージがありません</div>
          ) : thread.map((msg) => (
            <div key={msg.id}>
              {/* 施設→右 */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <div style={{ maxWidth: "75%" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", marginBottom: 3 }}>{msg.from_name} ・ {msg.created_at}</div>
                  <div style={{ background: "#0077b6", color: "white", borderRadius: "12px 12px 2px 12px", padding: "10px 14px", fontSize: 13, lineHeight: 1.7 }}>
                    {msg.body}
                  </div>
                  {/* 既読ステータス */}
                  <div style={{ textAlign: "right", marginTop: 4, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                    {msg.is_read ? (
                      <span style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>
                        ✓ 既読{msg.read_at ? ` ${msg.read_at}` : ""}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarkRead(msg.id)}
                        style={{ fontSize: 10, color: "#94a3b8", background: "none", border: "1px solid #e2e8f0", borderRadius: 10, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        未読 → 既読にする
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* 保護者返信→左 */}
              {msg.replies.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "flex-start", marginTop: 6, marginBottom: 4 }}>
                  <div style={{ maxWidth: "75%" }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 3 }}>{child?.parent_name ?? "保護者"}</div>
                    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px 12px 12px 2px", padding: "10px 14px", fontSize: 13, lineHeight: 1.7, color: "#1e293b" }}>
                      {r}
                    </div>
                  </div>
                </div>
              ))}
              {/* 返信入力（最新のみ） */}
              {msg.id === thread[thread.length - 1]?.id && (
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <input className="form-input" placeholder="返信を入力（保護者役）..." value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleReply(msg.id)}
                    style={{ flex: 1 }} />
                  <button className="btn-primary" onClick={() => handleReply(msg.id)} disabled={!reply.trim()} style={{ flexShrink: 0 }}>返信</button>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 新規送信欄 */}
        <div style={{ flexShrink: 0, paddingTop: 12, borderTop: "1px solid #e2e8f0", display: "flex", gap: 8 }}>
          <textarea className="form-input" placeholder="施設からのメッセージを入力..." value={newBody}
            onChange={(e) => setNewBody(e.target.value)} style={{ flex: 1, minHeight: 56, maxHeight: 120, resize: "none" }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
          <button className="btn-primary" onClick={handleSend} disabled={!newBody.trim()} style={{ flexShrink: 0, alignSelf: "flex-end" }}>送信</button>
        </div>
      </div>
    );
  }

  // ===== 一覧 =====
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={h1Style}>
            💬 保護者連絡
            {unreadCount > 0 && <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>{unreadCount}件未読</span>}
          </h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{fac?.name} ／ {children.length}名</p>
        </div>
        <button className="btn-primary" onClick={() => { setView("new"); setSelChildId(null); setNewBody(""); }}>✉️ 新規連絡</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {latestByChild.map(({ child, latest, unread }) => (
          <div key={child.id} className="card"
            onClick={() => openThread(child.id)}
            style={{ padding: "14px 16px", cursor: "pointer", transition: "box-shadow 0.15s", borderLeft: unread > 0 ? "3px solid #0077b6" : "3px solid transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)")}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#0077b6,#00b4d8)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 18 }}>
                {child.name.slice(0, 1)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: unread > 0 ? 800 : 600, fontSize: 14 }}>{child.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0, marginLeft: 8 }}>{latest?.created_at ?? ""}</div>
                </div>
                <div style={{ fontSize: 12, color: unread > 0 ? "#1e293b" : "#94a3b8", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: unread > 0 ? 600 : 400 }}>
                  {latest ? latest.body.slice(0, 50) + (latest.body.length > 50 ? "…" : "") : "メッセージなし"}
                </div>
              </div>
              {unread > 0 && (
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#0077b6", color: "white", fontSize: 11, fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {unread}
                </div>
              )}
            </div>
          </div>
        ))}
        {children.length === 0 && (
          <div className="card" style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>利用者が登録されていません</div>
        )}
      </div>
    </div>
  );
}
