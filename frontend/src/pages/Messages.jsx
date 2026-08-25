// Full messaging page: conversation list, live thread, and the new chat
// picker that only shows people this user is permitted to contact.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import Modal from "../components/Modal.jsx";
import { useToast } from "../toast.jsx";

export default function Messages() {
  const { user, subscribe } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(params.get("c") ? Number(params.get("c")) : null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [contacts, setContacts] = useState([]);
  const bottomRef = useRef(null);

  function loadConversations() {
    api("/messaging/conversations/").then(setConversations).catch(() => {});
  }

  useEffect(loadConversations, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the thread whenever the active conversation changes.
  useEffect(() => {
    if (!activeId) return;
    api(`/messaging/conversations/${activeId}/messages/`).then((data) => {
      setMessages(data);
      // Tell the floating messages bubble the unread counts changed.
      window.dispatchEvent(new Event("carelink:conversations"));
    }).catch(() => {});
    setParams({ c: String(activeId) }, { replace: true });
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Live delivery: append messages for the open thread, refresh the list otherwise.
  useEffect(() => {
    return subscribe((event) => {
      if (event.kind !== "message") return;
      if (event.conversation_id === activeId && event.sender_id !== user.id) {
        setMessages((all) => [...all, event]);
      }
      loadConversations();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // The picker searches only eligible contacts, enforced again server side.
  useEffect(() => {
    if (!pickerOpen) return;
    api(`/messaging/contacts/?q=${encodeURIComponent(contactQuery)}`).then(setContacts).catch(() => {});
  }, [pickerOpen, contactQuery]);

  async function startConversation(contact) {
    try {
      const data = await api("/messaging/conversations/", { method: "POST", body: { user_id: contact.id } });
      setPickerOpen(false);
      setActiveId(data.id);
      loadConversations();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || !activeId) return;
    setText("");
    try {
      const message = await api(`/messaging/conversations/${activeId}/messages/`, { method: "POST", body: { body } });
      setMessages((all) => [...all, message]);
      loadConversations();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div>
      <div className="row between">
        <div>
          <h1>Messages</h1>
          <p className="sub">Direct, realtime chat with the people your role works with.</p>
        </div>
        <button className="btn" onClick={() => setPickerOpen(true)}>New chat</button>
      </div>

      <div className="messages-layout">
        <div className="card tight conv-list">
          {conversations.map((c) => (
            <div key={c.id} className={`conv-item ${c.id === activeId ? "active" : ""}`} onClick={() => setActiveId(c.id)}>
              <div className="row between">
                <strong>{c.other_user?.full_name || "Conversation"}</strong>
                {c.unread_count > 0 && <span className="badge danger">{c.unread_count}</span>}
              </div>
              <div className="muted small">{c.other_user?.role?.replaceAll("_", " ")}</div>
              {c.last_message && <div className="muted small">{c.last_message.mine ? "You: " : ""}{c.last_message.body}</div>}
            </div>
          ))}
          {conversations.length === 0 && <div className="conv-item muted">No conversations yet.</div>}
        </div>

        <div className="card tight thread">
          {active ? (
            <>
              <div className="chat-head">{active.other_user?.full_name}</div>
              <div className="thread-body">
                {messages.map((m) => (
                  <div key={m.id} className={`chat-msg ${m.sender_id === user.id ? "mine" : "theirs"}`}>
                    {m.body}
                    <div style={{ fontSize: "0.68rem", opacity: 0.7, marginTop: 2 }}>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
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
            <div className="muted center" style={{ margin: "auto", padding: 30 }}>
              Pick a conversation, or start a new chat.
            </div>
          )}
        </div>
      </div>

      {pickerOpen && (
        <Modal title="New chat" onClose={() => setPickerOpen(false)}>
          <p className="muted small">You can only see people your role is allowed to message. For example, clients see caregivers they have had visits with.</p>
          <input placeholder="Search by name..." value={contactQuery} onChange={(e) => setContactQuery(e.target.value)} autoFocus />
          <div className="stack" style={{ marginTop: 12 }}>
            {contacts.map((c) => (
              <div key={c.id} className="conv-item" onClick={() => startConversation(c)}>
                <strong>{c.full_name}</strong>
                <div className="muted small">{c.role.replaceAll("_", " ")}</div>
              </div>
            ))}
            {contacts.length === 0 && <div className="muted small">No matching contacts.</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
