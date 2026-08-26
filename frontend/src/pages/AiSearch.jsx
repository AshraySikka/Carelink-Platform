// Role scoped AI search. The backend retrieves only data this role can see,
// so answers are grounded in the caller's own slice of the platform.
import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import renderAiText from "../formatAiText.jsx";
import { useToast } from "../toast.jsx";

// Kept identical to ChatBubble.jsx's STARTER_PROMPTS, so the same starter
// questions work the same way whether asked from here or the chat bubble.
const EXAMPLES = {
  customer_service: ["Which referrals are high urgency right now?", "Which clients have concerns flagged that need follow up?"],
  admin: ["How many referrals are still unassigned?", "What does our incident escalation policy say?"],
  manager: ["What change requests are waiting on my approval?", "How many of my team's shifts are today?"],
  field_staff: ["When is my next shift, and where?", "What should I do if a client refuses medication?"],
  client: ["When is my next visit, and who's coming?", "What can I do to prevent falls at home?"],
  hospital_partner: ["What information should I have ready before submitting a referral?", "How is a referral's urgency decided?"],
  family: ["What does the caregiver burnout guide say?", "How can I tell if my loved one needs more support?"],
};

export default function AiSearch() {
  const { user } = useAuth();
  const toast = useToast();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(q) {
    const text = (q || question).trim();
    if (!text) return;
    setQuestion(text);
    setBusy(true);
    setAnswer("");
    try {
      const data = await api("/integrations/ai/search/", { method: "POST", body: { question: text } });
      setAnswer(data.answer);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>AI search</h1>
      <p className="sub">Ask in plain language. Answers use only the data your role is allowed to see.</p>
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="row">
          <input style={{ flex: 1 }} value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about your CareLink data..."
            onKeyDown={(e) => e.key === "Enter" && ask()} />
          <button className="btn" onClick={() => ask()} disabled={busy}>{busy ? "Searching..." : "Search"}</button>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {(EXAMPLES[user.role] || []).map((e) => (
            <button key={e} className="btn outline small" onClick={() => ask(e)}>{e}</button>
          ))}
        </div>
        {answer && (
          <div style={{ marginTop: 16, background: "var(--primary-soft)", padding: 16, borderRadius: 10 }}>
            {renderAiText(answer, "search-answer")}
          </div>
        )}
      </div>
    </div>
  );
}
