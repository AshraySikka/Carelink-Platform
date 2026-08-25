// Quick messages bubble, bottom left. Live unread badge that also refreshes
// when the Messages page reads a thread (via the carelink:conversations event).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";

export default function MessagesBubble() {
  const { subscribe, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);

  function load() {
    api("/messaging/conversations/").then(setConversations).catch(() => {});
  }

  useEffect(() => {
    load();
    // Refresh when a thread is read anywhere in the app, so the unread
    // badge clears the moment you open a conversation.
    window.addEventListener("carelink:conversations", load);
    const unsubscribe = subscribe((event) => {
      if (event.kind === "message" && event.sender_id !== user.id) load();
    });
    return () => {
      window.removeEventListener("carelink:conversations", load);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <>
      <button className="chat-fab msgs" onClick={() => setOpen(!open)} aria-label="Messages">
        {"\u{1F4AC}"}
        {unread > 0 && <span className="bell-dot">{unread}</span>}
      </button>
      {open && (
        <div className="chat-panel left">
          <div className="chat-head">Messages <button className="btn ghost small" onClick={() => { setOpen(false); navigate("/messages"); }}>Open all</button></div>
          <div className="chat-body">
            {conversations.length === 0 && <div className="muted small">No conversations yet. Open Messages to start one.</div>}
            {conversations.map((c) => (
              <div key={c.id} className="conv-item" onClick={() => { setOpen(false); navigate(`/messages?c=${c.id}`); }}>
                <div className="row between">
                  <strong>{c.other_user?.full_name || "Conversation"}</strong>
                  {c.unread_count > 0 && <span className="badge danger">{c.unread_count}</span>}
                </div>
                {c.last_message && <div className="muted small">{c.last_message.mine ? "You: " : ""}{c.last_message.body}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}