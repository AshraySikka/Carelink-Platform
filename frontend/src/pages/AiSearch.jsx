// Role scoped AI search. The backend retrieves only data this role can see,
// so answers are grounded in the caller's own slice of the platform.
import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";

const EXAMPLES = {
  customer_service: ["Which referrals are high urgency right now?", "Summarize the newest referrals"],
  admin: ["Which referrals are still new?", "What does the fall prevention guide say?"],
  manager: ["What change requests are pending?", "Summarize this week's schedule"],
  field_staff: ["When is my next shift?", "What does the medication guide say?"],
  client: ["When is my next visit?", "How do I add a family member?"],
  hospital_partner: ["How do I submit a referral?", "What happens after I submit?"],
  family: ["What does the caregiver burnout guide say?"],
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
          <div style={{ marginTop: 16, whiteSpace: "pre-wrap", background: "var(--primary-soft)", padding: 16, borderRadius: 10 }}>
            {answer}
          </div>
        )}
      </div>
    </div>
  );
}
