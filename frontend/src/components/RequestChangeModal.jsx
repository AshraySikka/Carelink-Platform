// Shared visit change request flow for clients: pick Reschedule or Cancel,
// add an optional note, and send. Notifies both the assigned field staff
// and the customer service team on the backend.
import { useState } from "react";
import { api } from "../api";
import Modal from "./Modal.jsx";
import { useToast } from "../toast.jsx";

export default function RequestChangeModal({ shift, onClose, onSent }) {
  const toast = useToast();
  const [type, setType] = useState(null); // "reschedule" or "cancel"
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const prefix = type === "cancel" ? "Cancellation requested" : "Reschedule requested";
    const reason = `${prefix}: ${note.trim() || "No additional details provided."}`;
    try {
      await api("/change-requests/", { method: "POST", body: { shift: shift.id, reason } });
      toast("Request sent to your care team.", "success");
      onSent?.();
      onClose();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Request a visit change" onClose={onClose}>
      {!type ? (
        <div className="stack">
          <p className="muted small">What would you like to do with this visit?</p>
          <button className="btn outline" onClick={() => setType("reschedule")}>Reschedule</button>
          <button className="btn outline" onClick={() => setType("cancel")}>Cancel visit</button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p className="muted small">
            {type === "cancel" ? "Cancelling this visit." : "Requesting a new time for this visit."}
            {" "}Your caregiver and the care team will be notified.
          </p>
          <label>Note (optional)</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={type === "cancel" ? "Let us know why, if you can." : "Preferred day or time, if you have one."} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" disabled={busy}>{busy ? "Sending..." : `Send ${type} request`}</button>
            <button type="button" className="btn ghost" onClick={() => setType(null)}>Back</button>
          </div>
        </form>
      )}
    </Modal>
  );
}