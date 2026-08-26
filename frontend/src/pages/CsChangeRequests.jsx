// Customer service (and admin/manager): every shift change request, with
// full detail and status. Approving a request never moves the shift's time
// by itself, this page is where a real person applies it, with the manager's
// approval and the staff member's requested time both right there to copy.
// Cancellation requests apply directly, since there is no "new time" to fill in.
import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../auth.jsx";
import { fromLocalInputValue, toLocalInputValue } from "../dateInput.js";
import { useToast } from "../toast.jsx";

const FILTERS = ["all", "pending", "approved", "declined"];

function isSameDay(isoString) {
  return new Date(isoString).toDateString() === new Date().toDateString();
}

export default function CsChangeRequests() {
  const { subscribe } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("all");
  const [applying, setApplying] = useState(null);
  const [form, setForm] = useState({ start_time: "", end_time: "", notes: "" });

  function load() {
    api("/change-requests/").then(setRequests).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refreshes automatically when a manager decides a request while this
  // page is open, instead of waiting for a manual reload.
  useEffect(() => {
    return subscribe((event) => {
      if (event.kind === "notification" && event.category === "approvals") load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openApply(request) {
    setApplying(request);
    setForm({
      start_time: toLocalInputValue(request.requested_start_time || request.shift_detail?.start_time),
      end_time: toLocalInputValue(request.requested_end_time || request.shift_detail?.end_time),
      notes: request.shift_detail?.notes || "",
    });
  }

  async function applyToShift(e) {
    e.preventDefault();
    try {
      await api(`/shifts/${applying.shift}/`, {
        method: "PATCH",
        body: { start_time: fromLocalInputValue(form.start_time), end_time: fromLocalInputValue(form.end_time), notes: form.notes, status: "scheduled" },
      });
      toast("Shift updated. The staff member and client have been notified.", "success");
      setApplying(null);
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function cancelShift(request) {
    if (!confirm(`Cancel the ${request.shift_detail ? new Date(request.shift_detail.start_time).toLocaleDateString() : "shift"} with ${request.shift_detail?.client_name || "this client"}?`)) return;
    try {
      await api(`/shifts/${request.shift}/`, {
        method: "PATCH",
        body: { status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: request.reason },
      });
      toast("Shift cancelled. The staff member and client have been notified.", "success");
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  const visible = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div>
      <h1>Change requests</h1>
      <p className="sub">Every shift change request, and what to do about it. Approved requests still need the schedule updated here.</p>

      <div className="row" style={{ marginBottom: 16, gap: 8 }}>
        {FILTERS.map((f) => (
          <button key={f} className={`pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="stack">
        {visible.map((r) => {
          const sameDay = r.shift_detail && isSameDay(r.shift_detail.start_time);
          return (
            <div key={r.id} className="card" style={{ marginBottom: 0 }}>
              <div className="row between">
                <div>
                  <strong>{r.requested_by_name}</strong> <StatusBadge value={r.status} />
                  {r.request_type === "cancel" && <span className="badge danger">Cancellation</span>}
                  {sameDay && r.status === "pending" && <span className="badge danger">Same day</span>}
                  <div className="small">
                    Shift: {r.shift_detail ? `${r.shift_detail.client_name}, ${new Date(r.shift_detail.start_time).toLocaleString()}` : `#${r.shift}`}
                  </div>
                  <div className="small"><strong>Reason:</strong> {r.reason}</div>
                  {r.requested_start_time && (
                    <div className="muted small">Requested new time: {new Date(r.requested_start_time).toLocaleString()}
                      {r.requested_end_time && ` to ${new Date(r.requested_end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</div>
                  )}
                  {r.status !== "pending" && (
                    <div className="muted small">{r.status === "approved" ? "Approved" : "Declined"} by {r.decided_by_name || "-"} on {r.decided_at ? new Date(r.decided_at).toLocaleString() : "-"}
                      {r.decision_note && ` \u00b7 Note: ${r.decision_note}`}</div>
                  )}
                </div>
                {r.status === "approved" && (
                  r.request_type === "cancel"
                    ? <button className="btn danger small" onClick={() => cancelShift(r)}>Cancel shift</button>
                    : <button className="btn small" onClick={() => openApply(r)}>Update shift</button>
                )}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && <div className="card muted">Nothing here yet.</div>}
      </div>

      {applying && (
        <Modal title="Update shift" onClose={() => setApplying(null)}>
          <p className="muted small">{applying.requested_by_name}, {applying.shift_detail?.client_name}</p>
          <form onSubmit={applyToShift}>
            <div className="grid2">
              <div>
                <label>Start</label>
                <input type="datetime-local" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div>
                <label>End</label>
                <input type="datetime-local" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <label>Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button className="btn" style={{ marginTop: 14, width: "100%" }}>Save and notify</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
