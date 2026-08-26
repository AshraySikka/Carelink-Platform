// Shared visit change request flow for clients: pick Reschedule or Cancel,
// choose a reason from the list (Other lets them add detail), and send.
// A couple of reasons mean this needs immediate attention rather than a
// queued request, so picking one blocks submission and points to
// Emergency request instead.
import { useState } from "react";
import { api } from "../api";
import Modal from "./Modal.jsx";
import { BLOCKED_REASON_CODES, REASON_OPTIONS } from "../changeReasons.js";
import { useToast } from "../toast.jsx";

export default function RequestChangeModal({ shift, onClose, onSent, onEmergency }) {
  const toast = useToast();
  const [type, setType] = useState(null); // "reschedule" or "cancel"
  const [reasonCode, setReasonCode] = useState("");
  const [otherText, setOtherText] = useState("");
  const [busy, setBusy] = useState(false);

  const blocked = reasonCode && BLOCKED_REASON_CODES.has(reasonCode);

  async function submit(e) {
    e.preventDefault();
    if (!reasonCode || blocked) return;
    setBusy(true);
    try {
      await api("/change-requests/", {
        method: "POST",
        body: { shift: shift.id, request_type: type, reason_code: reasonCode, reason_other: otherText.trim() },
      });
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
          <label>Reason</label>
          <select required value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
            <option value="">Select a reason...</option>
            {REASON_OPTIONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>

          {blocked ? (
            <div className="small" style={{ background: "var(--danger-soft)", padding: 10, borderRadius: 8, marginTop: 10 }}>
              This needs immediate attention, not a queued request. Please use Emergency request so customer
              service is alerted right away.
              <div style={{ marginTop: 8 }}>
                <button type="button" className="btn danger small" onClick={() => { onClose(); onEmergency?.(); }}>
                  Go to Emergency request
                </button>
              </div>
            </div>
          ) : (
            <>
              {reasonCode === "other" && (
                <>
                  <label>Please describe</label>
                  <textarea rows={3} value={otherText} onChange={(e) => setOtherText(e.target.value)} placeholder="Tell us what's going on..." />
                </>
              )}
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn" disabled={busy || !reasonCode}>{busy ? "Sending..." : `Send ${type} request`}</button>
                <button type="button" className="btn ghost" onClick={() => setType(null)}>Back</button>
              </div>
            </>
          )}
        </form>
      )}
    </Modal>
  );
}
