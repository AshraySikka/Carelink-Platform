// Floating chat bubble in the bottom right. Behavior depends on role:
// - Hospital partners get a single AI-first support panel: they talk to
//   the assistant (with the same kind of preloaded starter questions
//   every other role gets), and once they've had a bit of back and forth
//   they can ask to be connected with a live customer service agent,
//   picked at random and reused on repeat visits (see connect_agent_view
//   on the backend). There is no separate Messages tab or nav link for
//   this role, everything happens in this one panel. Closing the panel
//   (or collapsing it from the launcher button) while connected to a live
//   agent asks for confirmation first, since ending the chat means the
//   next time they open the bubble they land back on the assistant, not
//   straight into that same live conversation.
// - Family gets the assistant only, no messaging, matching the
//   platform's read only design for that role.
// - Everyone else gets the combined Assistant + Messages panel with two
//   tabs, described in StandardChatBubble below.
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import renderAiText from "../formatAiText.jsx";
import { useToast } from "../toast.jsx";

// Mirrors AiSearch.jsx's starter prompts, so the same questions work the
// same way whether asked from the bubble or the full AI search page. Each
// one is picked to combine the resource library with real operational
// data for that role, rather than a plain lookup, so the first thing
// someone sees the assistant do is genuinely useful.
const STARTER_PROMPTS = {
  customer_service: ["Which referrals are high urgency right now?", "Which clients have concerns flagged that need follow up?"],
  admin: ["How many referrals are still unassigned?", "What does our incident escalation policy say?"],
  manager: ["What change requests are waiting on my approval?", "How many of my team's shifts are today?"],
  field_staff: ["When is my next shift, and where?", "What should I do if a client refuses medication?"],
  client: ["When is my next visit, and who's coming?", "What can I do to prevent falls at home?"],
  family: ["What does the caregiver burnout guide say?", "How can I tell if my loved one needs more support?"],
};

// Same list AiSearch.jsx shows a hospital partner, so the starting point
// is consistent wherever they ask.
const HP_STARTER_PROMPTS = [
  "What information should I have ready before submitting a referral?",
  "How is a referral's urgency decided?",
];

// Shared so every prompt row (starter questions, the assistant-offers-a-
// person nudge) lines up flush left instead of drifting toward center,
// which is what the default row/button styles were doing.
const PROMPT_ROW_STYLE = { padding: "0 12px 10px", gap: 6, flexWrap: "wrap", justifyContent: "flex-start" };
const PROMPT_BTN_STYLE = { textAlign: "left" };

export default function ChatBubble() {
  const { user } = useAuth();
  if (user.role === "hospital_partner") return <HospitalPartnerBubble />;
  return <StandardChatBubble />;
}

// ---------------- Standard: Assistant + Messages tabs ----------------
// Used by everyone except hospital partners. Family sees the Assistant
// tab only (canMessage is false), everyone else gets both tabs.

function StandardChatBubble() {
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
                  <div key={i} className={`chat-msg ${m.mine ? "mine" : "theirs"}`}>
                    {m.mine ? m.body : renderAiText(m.body, `ai-${i}`)}
                  </div>
                ))}
                {aiBusy && <div className="chat-msg theirs muted">Thinking...</div>}
              </div>
              {prompts.length > 0 && aiHistory.length === 1 && (
                <div className="row" style={PROMPT_ROW_STYLE}>
                  {prompts.map((p) => (
                    <button key={p} className="btn outline small" style={PROMPT_BTN_STYLE} onClick={() => sendAi(p)} disabled={aiBusy}>{p}</button>
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

// ---------------- Hospital partner: AI first, then a live agent ----------------
// No tabs, no separate Messages nav item. Starts as a chat with the AI
// assistant, with the same kind of preloaded starter questions every
// other role gets. Once the hospital partner has asked at least two real
// questions, a "Talk to customer service" option appears: the assistant
// gets first crack at helping, and the human handoff is offered rather
// than forced. Accepting it calls connect-agent, which pairs them with a
// random active CS agent (or reuses an existing conversation with any CS
// agent, including one CS may have started from the referral drawer), and
// the same panel switches into a live chat with that person.
//
// Ending that live chat is deliberate: closing or collapsing the panel
// while connected asks for confirmation, since accepting it resets the
// conversation state so the bubble reopens on the assistant, not straight
// back into the live thread. The underlying conversation and its history
// aren't deleted (see docs/USER_GUIDE.md on message retention) and
// reconnecting later picks the same thread back up; this only governs
// whether closing the window silently keeps the live session running.

function HospitalPartnerBubble() {
  const { user, subscribe } = useAuth();
  const toast = useToast();

  const [open, setOpen] = useState(false);

  // Assistant phase.
  const [aiHistory, setAiHistory] = useState([
    { mine: false, body: "Hi, I'm the CareLink assistant. Ask me anything about referrals or the platform, or try one of the starter questions below. I can also connect you with a customer service representative once we've talked a bit." },
  ]);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Live agent phase, once connected.
  const [conversation, setConversation] = useState(null); // { id, agent_name }
  const [messages, setMessages] = useState([]);
  const [liveText, setLiveText] = useState("");
  const bottomRef = useRef(null);

  // Offer the human handoff once the assistant has actually answered a
  // couple of real questions, not the moment the panel opens.
  const userTurns = aiHistory.filter((m) => m.mine).length;
  const canOfferAgent = !conversation && userTurns >= 2 && !aiBusy;

  useEffect(() => {
    if (!conversation) return;
    return subscribe((event) => {
      if (event.kind === "message" && event.conversation_id === conversation.id && event.sender_id !== user.id) {
        setMessages((all) => [...all, event]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiHistory, messages]);

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

  async function connectAgent() {
    setConnecting(true);
    try {
      const data = await api("/messaging/connect-agent/", { method: "POST" });
      const history = await api(`/messaging/conversations/${data.id}/messages/`);
      setMessages(history);
      setConversation({ id: data.id, agent_name: data.agent_name });
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setConnecting(false);
    }
  }

  async function sendLive() {
    const body = liveText.trim();
    if (!body || !conversation) return;
    setLiveText("");
    try {
      const message = await api(`/messaging/conversations/${conversation.id}/messages/`, { method: "POST", body: { body } });
      setMessages((all) => [...all, message]);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  // Closing (or collapsing, from the launcher button) while a live agent
  // chat is active needs confirmation first, since accepting it means the
  // next time this panel opens it starts back on the assistant, not the
  // live conversation. Outside of a live chat, closing is always instant.
  function requestClose() {
    if (conversation) {
      const confirmed = window.confirm("End this chat with customer service? You won't be able to return to it in this session.");
      if (!confirmed) return;
      setConversation(null);
      setMessages([]);
    }
    setOpen(false);
  }

  function toggleOpen() {
    if (open) {
      requestClose();
    } else {
      setOpen(true);
    }
  }

  return (
    <>
      <button className="chat-fab ai" onClick={toggleOpen} aria-label="CareLink support">{"\u{1F4AC}"}</button>
      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <span>{conversation ? `Chatting with ${conversation.agent_name}` : "CareLink Assistant"}</span>
            <button className="btn ghost small" onClick={requestClose}>Close</button>
          </div>

          {!conversation ? (
            <>
              <div className="chat-body">
                {aiHistory.map((m, i) => (
                  <div key={i} className={`chat-msg ${m.mine ? "mine" : "theirs"}`}>
                    {m.mine ? m.body : renderAiText(m.body, `ai-${i}`)}
                  </div>
                ))}
                {aiBusy && <div className="chat-msg theirs muted">Thinking...</div>}
                {canOfferAgent && (
                  <div className="chat-msg theirs">
                    Want to talk to a person instead?
                    <div style={{ marginTop: 8 }}>
                      <button className="btn small" onClick={connectAgent} disabled={connecting}>
                        {connecting ? "Connecting..." : "Talk to customer service"}
                      </button>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              {aiHistory.length === 1 && (
                <div className="row" style={PROMPT_ROW_STYLE}>
                  {HP_STARTER_PROMPTS.map((p) => (
                    <button key={p} className="btn outline small" style={PROMPT_BTN_STYLE} onClick={() => sendAi(p)} disabled={aiBusy}>{p}</button>
                  ))}
                </div>
              )}
              <div className="chat-input">
                <input value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Ask a question..."
                  onKeyDown={(e) => e.key === "Enter" && sendAi()} />
                <button className="btn" onClick={() => sendAi()} disabled={aiBusy}>Send</button>
              </div>
            </>
          ) : (
            <>
              <div className="chat-body">
                <div className="chat-msg theirs muted">You're connected with {conversation.agent_name} from customer service.</div>
                {messages.map((m) => (
                  <div key={m.id} className={`chat-msg ${m.sender_id === user.id ? "mine" : "theirs"}`}>{m.body}</div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="chat-input">
                <input value={liveText} onChange={(e) => setLiveText(e.target.value)} placeholder="Type a message..."
                  onKeyDown={(e) => e.key === "Enter" && sendLive()} />
                <button className="btn" onClick={sendLive}>Send</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
