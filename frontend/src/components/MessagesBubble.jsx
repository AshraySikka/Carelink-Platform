// Quick messages bubble, bottom left. Shows the conversation list by
// default, with a live unread badge. Other pages (like the referral drawer's
// "Chat with hospital" button) can open a specific thread directly inside
// this bubble by dispatching a carelink:open-thread window event.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";

export default function MessagesBubble() {
  const { subscribe, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [thread, setThread] = useState(null); // { id, other_user } when viewing a single chat
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  function load() {
    api("/messaging/conversations/").then(setConversations).catch(() => {});
  }

  function openThread(conversationId, otherUserHint) {
    setOpen(true);
    const known = conversations.find((c) => c.id === conversationId);
    setThread({ id: conversationId, other_user: known?.other_user || otherUserHint || null });
    api(`/messaging/conversations/${conversationId}/messages/`).then((data) => {
      setMessages(data);
      window.dispatchEvent(new Event("carelink:conversations"));
    }).catch(() => {});
  }

  useEffect(() => {
    load();
    window.addEventListener("carelink:conversations", load);
    const onOpenThread = (event) => openThread(event.detail.conversationId, event.detail.otherUser);
    window.addEventListener("carelink:open-thread", onOpenThread);
    const unsubscribe = subscribe((event) => {
      if (event.kind !== "message") return;
      if (event.sender_id !== user.id) load();
      if (thread && event.conversation_id === thread.id && event.sender_id !== user.id) {
        setMessages((all) => [...all, event]);
      }
    });
    return () => {
      window.removeEventListener("carelink:conversations", load);
      window.removeEventListener("carelink:open-thread", onOpenThread);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = text.trim();
    if (!body || !thread) return;
    setText("");
    try {
      const message = await api(`/messaging/conversations/${thread.id}/messages/`, { method: "POST", body: { body } });
      setMessages((all) => [...all, message]);
      load();
    } catch {
      // The full Messages page surfaces send errors; the bubble stays quiet.
    }
  }

  const unread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <>
      <button className="chat-fab msgs" onClick={() => setOpen(!open)} aria-label="Messages">
        {"\u{1F4AC}"}
        {unread > 0 && <span className="bell-dot">{unread}</span>}
      </button>
      {open && (
        <div className="chat-panel left">
          {thread ? (
            <>
              <div className="chat-head">
                <button className="btn ghost small" onClick={() => setThread(null)}>{"\u2190"} Back</button>
                <span style={{ flex: 1, textAlign: "center" }}>{thread.other_user?.full_name || "Conversation"}</span>
                <button className="btn ghost small" onClick={() => setOpen(false)}>Close</button>
              </div>
              <div className="chat-body">
                {messages.map((m) => (
                  <div key={m.id} className={`chat-msg ${m.sender_id === user.id ? "mine" : "theirs"}`}>{m.body}</div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="chat-input">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..."
                  onKeyDown={(e) => e.key === "Enter" && send()} />
                <button className="btn" onClick={send}>Send</button>
              </div>
            </>
          ) : (
            <>
              <div className="chat-head">Messages <button className="btn ghost small" onClick={() => { setOpen(false); navigate("/messages"); }}>Open all</button></div>
              <div className="chat-body">
                {conversations.length === 0 && <div className="muted small">No conversations yet. Open Messages to start one.</div>}
                {conversations.map((c) => (
                  <div key={c.id} className="conv-item" onClick={() => openThread(c.id, c.other_user)}>
                    <div className="row between">
                      <strong>{c.other_user?.full_name || "Conversation"}</strong>
                      {c.unread_count > 0 && <span className="badge danger">{c.unread_count}</span>}
                    </div>
                    {c.last_message && <div className="muted small">{c.last_message.mine ? "You: " : ""}{c.last_message.body}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}