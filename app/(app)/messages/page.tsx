"use client";
// ==================== 保護者連絡 ====================
// 利用者ごとの連絡帳。施設→保護者へのメッセージ送受信。
// 改善版: テンプレート・写真添付・一斉送信対応

import { useState, useEffect, useRef } from "react";
import { DUMMY_CHILDREN, DUMMY_FACILITIES } from "@/lib/dummy-data";
import { saveRecord, fetchByFacility, supabase, uploadPhoto } from "@/lib/supabase";
import type { MessageRecord } from "@/types";
import { useSession } from "@/hooks/useSession";

function genId() { return crypto.randomUUID(); }
function nowStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function todayISO() { return new Date().toISOString().slice(0,10); }

// ===== テンプレートメッセージ =====
const TEMPLATES = [
  "本日は元気に来所されました。楽しく活動に取り組んでいました。",
  "本日の活動は〇〇でした。積極的に参加されていました。",
  "体調が優れないため、本日は早退されました。ご自宅でゆっくりお休みください。",
  "本日の送迎は予定通りに完了しました。",
  "明日の持ち物についてご確認をお願いします：",
  "次回のイベントについてお知らせです：",
  "保護者面談のお時間をいただけますでしょうか。",
  "おはようございます。本日もよろしくお願いします。",
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
  const [view, setView] = useState<"list" | "thread" | "new" | "broadcast">("list");
  const [loadingDB, setLoadingDB] = useState(false);
  const [sending, setSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // 写真添付用
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // 一斉送信用
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastDone, setBroadcastDone] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Supabase: 初期ロード + Realtime購読
  useEffect(() => {
    if (!session) return;
    setLoadingDB(true);

    fetchByFacility<MessageRecord>(
      "ng_messages",
      session.org_id,
      session.selected_facility_id
    ).then((rows) => {
      setMessages(rows.length > 0 ? rows : []);
      setLoadingDB(false);
    });

    // Realtime購読
    const channel = supabase
      .channel(`messages_${session.selected_facility_id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "ng_messages",
        filter: `facility_id=eq.${session.selected_facility_id}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          setMessages((prev) => {
            const newMsg = payload.new as MessageRecord;
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        } else if (payload.eventType === "UPDATE") {
          setMessages((prev) =>
            prev.map((m) => m.id === (payload.new as MessageRecord).id ? (payload.new as MessageRecord) : m)
          );
        }
      }).subscribe();

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
  const unreadCount = messages.filter((m) => !m.is_read).length;
  const latestByChild = children.map((child) => {
    const msgs = messages.filter((m) => m.child_id === child.id);
    const latest = msgs.sort((a, b) => b.created_at > a.created_at ? 1 : -1)[0];
    const unread = msgs.filter((m) => !m.is_read).length;
    return { child, latest, unread };
  });

  // メッセージ送信（写真対応）
  const handleSend = async () => {
    if (!newBody.trim() || !selChildId) return;
    setSending(true);

    let photoUrl: string | undefined;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop();
      const path = `messages/${session.org_id}/${todayISO()}_${genId()}.${ext}`;
      const url = await uploadPhoto(photoFile, path);
      if (url) photoUrl = url;
    }

    const child = children.find((c) => c.id === selChildId);
    const msg: MessageRecord = {
      id: genId(), org_id: session.org_id,
      facility_id: session.selected_facility_id,
      child_id: selChildId, child_name: child?.name ?? "",
      from_name: session.name, body: newBody,
      photo_url: photoUrl,
      is_read: false, replies: [], created_at: nowStr(),
    };
    await saveRecord("ng_messages", msg as unknown as Record<string, unknown>);
    setMessages((p) => [...p, msg]);
    setNewBody("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setShowTemplates(false);
    setSending(false);
  };

  // 返信
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

  // 既読
  const handleMarkRead = (msgId: string) => {
    setMessages((p) => p.map((m) => {
      if (m.id !== msgId || m.is_read) return m;
      const updated = { ...m, is_read: true, read_at: nowStr() };
      saveRecord("ng_messages", updated as unknown as Record<string, unknown>);
      return updated;
    }));
  };

  // スレッドを開く（既読にする）
  const openThread = (childId: string) => {
    setSelChildId(childId);
    setView("thread");
    setMessages((p) => p.map((m) => {
      if (m.child_id !== childId || m.is_read) return m;
      const updated = { ...m, is_read: true };
      saveRecord("ng_messages", updated as unknown as Record<string, unknown>);
      return updated;
    }));
  };

  // 一斉送信（全保護者へ）
  const handleBroadcast = async () => {
    if (!broadcastBody.trim()) return;
    setBroadcastSending(true);
    await Promise.all(
      children.map((child) => {
        const msg: MessageRecord = {
          id: genId(), org_id: session.org_id,
          facility_id: session.selected_facility_id,
          child_id: child.id, child_name: child.name,
          from_name: session.name,
          body: `【お知らせ】${broadcastBody}`,
          is_read: false, replies: [], created_at: nowStr(),
        };
        return saveRecord("ng_messages", msg as unknown as Record<string, unknown>).then(() => {
          setMessages((p) => [...p, msg]);
        });
      })
    );
    setBroadcastBody("");
    setBroadcastSending(false);
    setBroadcastDone(true);
    setTimeout(() => { setBroadcastDone(false); setView("list"); }, 2000);
  };

  // ===== 一斉送信画面 =====
  if (view === "broadcast") return (
    <div>
      <button onClick={() => setView("list")} style={backBtnStyle}>← 戻る</button>
      <h1 style={{ ...h1Style, margin: "12px 0 20px" }}>📣 全保護者へお知らせ</h1>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ background: "#fff8e1", border: "1px solid #ffd54f", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#7c4d00" }}>
          ⚠️ {fac?.name} の全保護者（{children.length}名）に一斉送信されます
        </div>
        {broadcastDone && (
          <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#166534", fontWeight: 700 }}>
            ✅ {children.length}名の保護者へ送信しました！
          </div>
        )}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>お知らせ内容</label>
          <textarea className="form-input" style={{ minHeight: 120, resize: "vertical" }}
            placeholder="全保護者へのお知らせを入力してください"
            value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} />
        </div>
        {/* テンプレート */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>よく使う文章：</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TEMPLATES.map((t, i) => (
              <button key={i} onClick={() => setBroadcastBody(t)}
                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#dbeafe"; e.currentTarget.style.borderColor = "#93c5fd"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}>
                {t.slice(0, 20)}…
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" disabled={!broadcastBody.trim() || broadcastSending}
            onClick={handleBroadcast}
            style={{ background: "#f59e0b" }}>
            {broadcastSending ? "送信中..." : `📣 ${children.length}名に一斉送信`}
          </button>
          <button className="btn-secondary" onClick={() => setView("list")}>キャンセル</button>
        </div>
      </div>
    </div>
  );

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
        {/* テンプレート */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>💡 よく使う文章（クリックで挿入）：</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TEMPLATES.map((t, i) => (
              <button key={i} onClick={() => setNewBody(t)}
                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer", fontFamily: "inherit" }}>
                {t.slice(0, 20)}…
              </button>
            ))}
          </div>
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
        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexShrink: 0 }}>
          <button onClick={() => setView("list")} style={backBtnStyle}>← 戻る</button>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#0077b6,#00b4d8)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
            {child?.name.slice(0, 1)}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{child?.name}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{child?.parent_name} ／ {fac?.name}</div>
          </div>
        </div>

        {/* メッセージ一覧 */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8 }}>
          {thread.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0", fontSize: 13 }}>まだメッセージがありません</div>
          ) : thread.map((msg) => (
            <div key={msg.id}>
              {/* 施設→右 */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <div style={{ maxWidth: "78%" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", marginBottom: 3 }}>{msg.from_name} ・ {msg.created_at}</div>
                  <div style={{ background: "#0077b6", color: "white", borderRadius: "14px 14px 2px 14px", padding: "10px 14px", fontSize: 13, lineHeight: 1.7 }}>
                    {msg.body}
                  </div>
                  {/* 写真 */}
                  {msg.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={msg.photo_url} alt="添付写真"
                      style={{ maxWidth: "100%", borderRadius: 10, marginTop: 6, border: "2px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }} />
                  )}
                  {/* 既読ステータス */}
                  <div style={{ textAlign: "right", marginTop: 4 }}>
                    {msg.is_read ? (
                      <span style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>✓ 既読{msg.read_at ? ` ${msg.read_at}` : ""}</span>
                    ) : (
                      <button onClick={() => handleMarkRead(msg.id)}
                        style={{ fontSize: 10, color: "#94a3b8", background: "none", border: "1px solid #e2e8f0", borderRadius: 10, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                        未読 → 既読にする
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* 保護者返信→左 */}
              {msg.replies.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "flex-start", marginTop: 6, marginBottom: 4 }}>
                  <div style={{ maxWidth: "78%" }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 3 }}>{child?.parent_name ?? "保護者"}</div>
                    <div style={{ background: "white", border: "1.5px solid #e2e8f0", borderRadius: "14px 14px 14px 2px", padding: "10px 14px", fontSize: 13, lineHeight: 1.7, color: "#1e293b" }}>
                      {r}
                    </div>
                  </div>
                </div>
              ))}
              {/* 返信入力（最新のみ） */}
              {msg.id === thread[thread.length - 1]?.id && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, paddingLeft: 8 }}>
                  <input className="form-input" placeholder="返信を入力（保護者役）..." value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleReply(msg.id)}
                    style={{ flex: 1, background: "#f8fafc" }} />
                  <button className="btn-secondary" onClick={() => handleReply(msg.id)} disabled={!reply.trim()} style={{ flexShrink: 0 }}>返信</button>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 送信エリア */}
        <div style={{ flexShrink: 0, paddingTop: 10, borderTop: "2px solid #e2e8f0" }}>
          {/* テンプレートボタン（展開式） */}
          {showTemplates && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>よく使う文章</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {TEMPLATES.map((t, i) => (
                  <button key={i}
                    onClick={() => { setNewBody(t); setShowTemplates(false); }}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", color: "#475569", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    {t.slice(0, 22)}…
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* 写真プレビュー */}
          {photoPreview && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="プレビュー" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: "2px solid #e2e8f0" }} />
              <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                style={{ fontSize: 11, color: "#dc2626", background: "none", border: "1px solid #fca5a5", borderRadius: 8, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                ✕ 削除
              </button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            {/* テンプレートボタン */}
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "1.5px solid #e2e8f0", background: showTemplates ? "#dbeafe" : "white", color: "#64748b", cursor: "pointer", fontSize: 16 }}
              title="テンプレート">
              💡
            </button>
            {/* 写真添付 */}
            <label style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "1.5px solid #e2e8f0", background: photoFile ? "#dcfce7" : "white", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}
              title="写真を添付">
              📷
              <input type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setPhotoFile(f);
                  setPhotoPreview(URL.createObjectURL(f));
                }} />
            </label>
            {/* テキスト入力 */}
            <textarea className="form-input" placeholder="メッセージを入力... (Shift+Enterで改行)" value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              style={{ flex: 1, minHeight: 44, maxHeight: 100, resize: "none" }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
            {/* 送信ボタン */}
            <button className="btn-primary" onClick={handleSend}
              disabled={!newBody.trim() || sending}
              style={{ flexShrink: 0, alignSelf: "flex-end", padding: "10px 16px" }}>
              {sending ? "…" : "送信"}
            </button>
          </div>
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
        <div style={{ display: "flex", gap: 8 }}>
          {/* 一斉送信ボタン */}
          <button
            onClick={() => setView("broadcast")}
            style={{ padding: "9px 14px", borderRadius: 10, border: "1.5px solid #f59e0b", background: "#fff8e1", color: "#b45309", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            📣 一斉送信
          </button>
          <button className="btn-primary" onClick={() => { setView("new"); setSelChildId(null); setNewBody(""); }}>
            ✉️ 新規連絡
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {latestByChild.map(({ child, latest, unread }) => (
          <div key={child.id} className="card"
            onClick={() => openThread(child.id)}
            style={{ padding: "14px 16px", cursor: "pointer", transition: "box-shadow 0.15s", borderLeft: unread > 0 ? "4px solid #0077b6" : "4px solid transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)")}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#0077b6,#00b4d8)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 18 }}>
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
                {/* 写真アイコン */}
                {latest?.photo_url && (
                  <span style={{ fontSize: 10, color: "#0077b6", marginTop: 2, display: "inline-block" }}>📷 写真あり</span>
                )}
              </div>
              {unread > 0 && (
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#0077b6", color: "white", fontSize: 11, fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
