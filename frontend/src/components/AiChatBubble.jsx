// The floating AI assistant, bottom right. Asks the agent backed endpoint,
// which can call database tools, search the resource library, and search
// the web, and keeps a short local conversation that it also sends back
// with each question so follow ups like "what about tomorrow" still work.
import { useState } from "react";
import { api } from "../api";

const GREETING = { mine: false, body: "Hi, I am the CareLink assistant. Ask me how to do anything here, for example: how do I clock in, or where do I add a family member." };

export default function AiChatBubble() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([GREETING]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const question = text.trim();
    if (!question || busy) return;
    setText("");
    const priorTurns = history;
    setHistory((h) => [...h, { mine: true, body: question }]);
    setBusy(true);
    try {
      const data = await api("/integrations/ai/chat/", {
        method: "POST",
        body: { question, history: priorTurns },
      });
      setHistory((h) => [...h, { mine: false, body: data.answer }]);
    } catch (error) {
      setHistory((h) => [...h, { mine: false, body: error.message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="chat-fab ai" onClick={() => setOpen(!open)} aria-label="AI assistant">{"\u2728"}</button>
      {open && (
        <div className="chat-panel">
          <div className="chat-head">CareLink Assistant <button className="btn ghost small" onClick={() => setOpen(false)}>Close</button></div>
          <div className="chat-body">
            {history.map((m, i) => (
              <div key={i} className={`chat-msg ${m.mine ? "mine" : "theirs"}`}>{m.body}</div>
            ))}
            {busy && <div className="chat-msg theirs muted">Thinking...</div>}
          </div>
          <div className="chat-input">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question..."
              onKeyDown={(e) => e.key === "Enter" && send()} />
            <button className="btn" onClick={send} disabled={busy}>Send</button>
          </div>
        </div>
      )}
    </>
  );
}
