// One floating chat bubble per role, combining the AI assistant and real
// messaging into a single panel with two tabs instead of two separate
// bubbles. The assistant tab is grounded in the resource library exactly
// like the dedicated AI search page, with the same starter prompts per
// role. The messages tab is the conversation list, an open thread, and a
// "New chat" picker scoped to whoever this role is allowed to message
// (for a client, that is every caregiver they have ever had a shift with,
// past or future; for a hospital partner it also offers Connect with an
// agent, which pairs them with a random customer service agent and reuses
// that same conversation on repeat visits). Family gets assistant only, no
// messaging tab, matching the platform's read only design for that role.
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";

// Mirrors AiSearch.jsx's starter prompts, so the same questions work the
// same way whether asked from the bubble or the full AI search page.
const STARTER_PROMPTS = {
  customer_service: ["Which referrals are high urgency right now?", "Summarize the newest referrals"],
  admin: ["Which referrals are still new?", "What does the fall prevention guide say?"],
  manager: ["What change requests are pending?", "Summarize this week's schedule"],
  field_staff: ["When is my next shift?", "What does the medication guide say?"],
  client: ["When is my next visit?", "How do I add a family member?"],
  hospital_partner: ["How do I submit a referral?", "What happens after I submit?"],
  family: ["What does the caregiver burnout guide say?"],
};

export default function ChatBubble() {
  const { user, subscribe } = useAuth();
  const toast = useToast();
  const canMessage = user.role !== "family";

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("assistant"); // "assistant" | "messages"

  // Assistant tab state.
  const [aiHistory, setAiHistory] = useState([
    { mine: false, body: "Hi, I am the CareLink assistant. Ask me anything, or try one of the starter questions below." },
  ]);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  // Messages tab state. view is "list", "thread", or "picker" (new chat).
  const [view, setView] = useState("list");
  const [conversations, setConversations] = useState([]);
  const [thread, setThread] = useState(null); // { id, other_user }
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [contacts, setContacts] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const bottomRef = useRef(null);

  function loadConversations() {
    if (!canMessage) return;
    api("/messaging/conversations/").then(setConversations).catch(() => {});
  }

  function openThread(conversationId, otherUserHint) {
    setOpen(true);
    setTab("messages");
    setView("thread");
    const known = conversations.find((c) => c.id === conversationId);
    setThread({ id: conversationId, other_user: known?.other_user || otherUserHint || null });
    api(`/messaging/conversations/${conversationId}/messages/`).then((data) => {
      setMessages(data);
      window.dispatchEvent(new Event("carelink:conversations"));
    }).catch(() => {});
  }

  useEffect(() => {
    if (!canMessage) return;
    loadConversations();
    const onOpenThread = (event) => openThread(event.detail.conversationId, event.detail.otherUser);
    window.addEventListener("carelink:conversations", loadConversations);
    window.addEventListener("carelink:open-thread", onOpenThread);
    const unsubscribe = subscribe((event) => {
      if (event.kind !== "message") return;
      if (event.sender_id !== user.id) loadConversations();
      if (thread && event.conversation_id === thread.id && event.sender_id !== user.id) {
        setMessages((all) => [...all, event]);
      }
    });
    return () => {
      window.removeEventListener("carelink:conversations", loadConversations);
      window.removeEventListener("carelink:open-thread", onOpenThread);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (view !== "picker") return;
    api(`/messaging/contacts/?q=${encodeURIComponent(contactQuery)}`).then(setContacts).catch(() => {});
  }, [view, contactQuery]);

  async function sendAi(preset) {
    const question = (preset ?? aiText).trim();
    if (!question || aiBusy) return;
    setAiText("");
    setAiHistory((h) => [...h, { mine: true, body: question }]);
    setAiBusy(true);
    try {
      const data = await api("/integrations/ai/chat/", { method: "POST", body: { question } });
      setAiHistory((h) => [...h, { mine: false, body: data.answer }]);
    } catch (error) {
      setAiHistory((h) => [...h, { mine: false, body: error.message }]);
    } finally {
      setAiBusy(false);
    }
  }

  async function startConversation(contact) {
    try {
      const data = await api("/messaging/conversations/", { method: "POST", body: { user_id: contact.id } });
      loadConversations();
      openThread(data.id, contact);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function connectAgent() {
    setConnecting(true);
    try {
      const data = await api("/messaging/connect-agent/", { method: "POST" });
      loadConversations();
      openThread(data.id, { full_name: data.agent_name });
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setConnecting(false);
    }
  }

  async function sendMessage() {
    const body = msgText.trim();
    if (!body || !thread) return;
    setMsgText("");
    try {
      const message = await api(`/messaging/conversations/${thread.id}/messages/`, { method: "POST", body: { body } });
      setMessages((all) => [...all, message]);
      loadConversations();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  const unread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const prompts = STARTER_PROMPTS[user.role] || [];

  return (
    <>
      <button className="chat-fab ai" onClick={() => setOpen(!open)} aria-label="CareLink chat">
        {"\u{1F4AC}"}
        {canMessage && tab !== "messages" && unread > 0 && <span className="bell-dot">{unread}</span>}
      </button>
      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            {canMessage ? (
              <div className="tabbar" style={{ flex: 1, marginRight: 8 }}>
                <button className={`tab ${tab === "assistant" ? "active" : ""}`} onClick={() => setTab("assistant")}>Assistant</button>
                <button className={`tab ${tab === "messages" ? "active" : ""}`} onClick={() => { setTab("messages"); setView("list"); }}>
                  Messages{unread > 0 ? ` (${unread})` : ""}
                </button>
              </div>
            ) : (
              <span>CareLink Assistant</span>
            )}
            <button className="btn ghost small" onClick={() => setOpen(false)}>Close</button>
          </div>

          {tab === "assistant" && (
            <>
              <div className="chat-body">
                {aiHistory.map((m, i) => (
                  <div key={i} className={`chat-msg ${m.mine ? "mine" : "theirs"}`}>{m.body}</div>
                ))}
                {aiBusy && <div className="chat-msg theirs muted">Thinking...</div>}
              </div>
              {prompts.length > 0 && aiHistory.length === 1 && (
                <div className="row" style={{ padding: "0 12px 10px", gap: 6, flexWrap: "wrap" }}>
                  {prompts.map((p) => (
                    <button key={p} className="btn outline small" onClick={() => sendAi(p)} disabled={aiBusy}>{p}</button>
                  ))}
                </div>
              )}
              <div className="chat-input">
                <input value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Ask a question..."
                  onKeyDown={(e) => e.key === "Enter" && sendAi()} />
                <button className="btn" onClick={() => sendAi()} disabled={aiBusy}>Send</button>
              </div>
            </>
          )}

          {canMessage && tab === "messages" && view === "list" && (
            <>
              <div className="chat-body">
                {user.role === "hospital_partner" && (
                  <button className="btn small" style={{ width: "100%" }} onClick={connectAgent} disabled={connecting}>
                    {connecting ? "Connecting..." : "Connect with an agent"}
                  </button>
                )}
                {conversations.length === 0 && <div className="muted small">No conversations yet.</div>}
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
              <div style={{ padding: "0 12px 12px" }}>
                <button className="btn outline small" style={{ width: "100%" }} onClick={() => { setView("picker"); setContactQuery(""); }}>
                  + New chat
                </button>
              </div>
            </>
          )}

          {canMessage && tab === "messages" && view === "picker" && (
            <>
              <div className="chat-head">
                <button className="btn ghost small" onClick={() => setView("list")}>{"\u2190"} Back</button>
                <span style={{ flex: 1, textAlign: "center" }}>New chat</span>
              </div>
              <div className="chat-body">
                <input placeholder="Search by name..." value={contactQuery} onChange={(e) => setContactQuery(e.target.value)} autoFocus />
                {contacts.length === 0 && (
                  <div className="muted small">
                    {user.role === "client"
                      ? "No caregivers to message yet. They will show up here once a visit is scheduled with them."
                      : "No matching contacts."}
                  </div>
                )}
                {contacts.map((c) => (
                  <div key={c.id} className="conv-item" onClick={() => startConversation(c)}>
                    <strong>{c.full_name}</strong>
                    <div className="muted small">{c.role.replaceAll("_", " ")}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {canMessage && tab === "messages" && view === "thread" && thread && (
            <>
              <div className="chat-head">
                <button className="btn ghost small" onClick={() => setView("list")}>{"\u2190"} Back</button>
                <span style={{ flex: 1, textAlign: "center" }}>{thread.other_user?.full_name || "Conversation"}</span>
              </div>
              <div className="chat-body">
                {messages.map((m) => (
                  <div key={m.id} className={`chat-msg ${m.sender_id === user.id ? "mine" : "theirs"}`}>{m.body}</div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="chat-input">
                <input value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="Type a message..."
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
                <button className="btn" onClick={sendMessage}>Send</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
