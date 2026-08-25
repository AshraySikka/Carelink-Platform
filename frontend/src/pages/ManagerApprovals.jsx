// Manager: the shift change approval queue.
// Approve notifies customer service to action the schedule change.
// Decline notifies the field staff member who asked.
import { useEffect, useState } from "react";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../toast.jsx";

export default function ManagerApprovals() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [notes, setNotes] = useState({});

  function load() {
    api("/change-requests/").then(setRequests).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        {pending.map((r) => (
          <div key={r.id} className="card" style={{ marginBottom: 0 }}>
            <div className="row between">
              <div>
                <strong>{r.requested_by_name}</strong> <StatusBadge value={r.status} />
                <div className="small">
                  Shift: {r.shift_detail ? `${r.shift_detail.client_name}, ${new Date(r.shift_detail.start_time).toLocaleString()}` : `#${r.shift}`}
                </div>
                <div className="small"><strong>Reason:</strong> {r.reason}</div>
                {r.requested_start_time && (
                  <div className="muted small">Preferred: {new Date(r.requested_start_time).toLocaleString()}
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
        ))}
        {pending.length === 0 && <div className="card muted">Nothing waiting for approval. Enjoy the quiet.</div>}
      </div>

      <h2>Decided</h2>
      <div className="card tight">
        <table>
          <thead><tr><th>Staff</th><th>Reason</th><th>Outcome</th><th>Decided</th></tr></thead>
          <tbody>
            {decided.map((r) => (
              <tr key={r.id}>
                <td>{r.requested_by_name}</td>
                <td className="muted small">{r.reason}</td>
                <td><StatusBadge value={r.status} /></td>
                <td className="muted small">{r.decided_at ? new Date(r.decided_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
