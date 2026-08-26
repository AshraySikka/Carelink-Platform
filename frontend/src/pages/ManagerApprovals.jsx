// Manager: the shift change approval queue.
// Approve does NOT move the shift's time by itself. It marks the request
// approved and notifies customer service with full detail (what changed,
// who approved it) so a real person applies it on the Change requests
// screen. Decline notifies the field staff member who asked; the shift
// never moved off its original time either way.
import { useEffect, useState } from "react";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";

function isSameDay(isoString) {
  return new Date(isoString).toDateString() === new Date().toDateString();
}

export default function ManagerApprovals() {
  const { subscribe } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [notes, setNotes] = useState({});

  function load() {
    api("/change-requests/").then(setRequests).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refreshes automatically if a new request comes in while this page is open.
  useEffect(() => {
    return subscribe((event) => {
      if (event.kind === "notification" && event.category === "approvals") load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(id, decision) {
    try {
      await api(`/change-requests/${id}/decide/`, { method: "POST", body: { decision, note: notes[id] || "" } });
      toast(decision === "approved"
        ? "Approved. Customer service has been notified to update the schedule."
        : "Declined. The staff member has been notified.", "success");
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  return (
    <div>
      <h1>Approvals</h1>
      <p className="sub">Shift change requests from your team waiting on your decision.</p>

      <div className="stack" style={{ marginBottom: 28 }}>
        {pending.map((r) => {
          const sameDay = r.shift_detail && isSameDay(r.shift_detail.start_time);
          return (
            <div key={r.id} className="card" style={{ marginBottom: 0 }}>
              <div className="row between">
                <div>
                  <strong>{r.requested_by_name}</strong> <StatusBadge value={r.status} />
                  {r.request_type === "cancel" && <span className="badge danger">Cancellation</span>}
                  {sameDay && <span className="badge danger">Same day</span>}
                  <div className="small">
                    Shift: {r.shift_detail ? `${r.shift_detail.client_name}, ${new Date(r.shift_detail.start_time).toLocaleString()}` : `#${r.shift}`}
                  </div>
                  <div className="small"><strong>Reason:</strong> {r.reason}</div>
                  {r.requested_start_time && (
                    <div className="muted small">Requested new time: {new Date(r.requested_start_time).toLocaleString()}
                      {r.requested_end_time && ` to ${new Date(r.requested_end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</div>
                  )}
                </div>
              </div>
              <label>Note (optional, shared with the outcome)</label>
              <input value={notes[r.id] || ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => decide(r.id, "approved")}>Approve</button>
                <button className="btn danger" onClick={() => decide(r.id, "declined")}>Decline</button>
              </div>
            </div>
          );
        })}
        {pending.length === 0 && <div className="card muted">Nothing waiting for approval. Enjoy the quiet.</div>}
      </div>

      <h2>Decided</h2>
      <div className="card tight">
        <table>
          <thead><tr><th>Staff</th><th>Reason</th><th>Outcome</th><th>Decided by</th><th>Decided</th></tr></thead>
          <tbody>
            {decided.map((r) => (
              <tr key={r.id}>
                <td>{r.requested_by_name}{r.request_type === "cancel" && <span className="badge danger" style={{ marginLeft: 6 }}>Cancellation</span>}</td>
                <td className="muted small">{r.reason}</td>
                <td><StatusBadge value={r.status} /></td>
                <td className="muted small">{r.decided_by_name || "-"}</td>
                <td className="muted small">{r.decided_at ? new Date(r.decided_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
            {decided.length === 0 && <tr><td colSpan={5} className="muted center">No decisions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
