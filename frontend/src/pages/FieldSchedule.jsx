// Field staff: schedule, geofenced clock in and out, on my way, change
// requests routed to their manager, and clinical documentation.
import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../toast.jsx";

function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000 }
    );
  });
}

export default function FieldSchedule() {
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [changeFor, setChangeFor] = useState(null);
  const [changeForm, setChangeForm] = useState({ reason: "", requested_start_time: "", requested_end_time: "" });
  const [docFor, setDocFor] = useState(null);
  const [docNotes, setDocNotes] = useState("");
  const [docFile, setDocFile] = useState(null);

  function load() {
    api("/shifts/").then(setShifts).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function clockIn(shift, override = false) {
    const position = await getPosition();
    try {
      await api(`/shifts/${shift.id}/clock-in/`, { method: "POST", body: { ...(position || {}), override } });
      toast("Clocked in.", "success");
      load();
    } catch (error) {
      if (error.message.includes("override")) {
        if (confirm(error.message + "\n\nClock in anyway?")) return clockIn(shift, true);
      } else {
        toast(error.message, "error");
      }
    }
  }

  async function simple(shift, action, message) {
    try {
      await api(`/shifts/${shift.id}/${action}/`, { method: "POST", body: {} });
      toast(message, "success");
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function fileChange(e) {
    e.preventDefault();
    try {
      await api("/change-requests/", {
        method: "POST",
        body: {
          shift: changeFor.id,
          reason: changeForm.reason,
          requested_start_time: changeForm.requested_start_time || null,
          requested_end_time: changeForm.requested_end_time || null,
        },
      });
      toast("Change request sent to your manager for approval.", "success");
      setChangeFor(null);
      setChangeForm({ reason: "", requested_start_time: "", requested_end_time: "" });
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function saveDoc(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append("shift", docFor.id);
    formData.append("notes", docNotes);
    if (docFile) formData.append("file", docFile);
    try {
      await api("/clinical-docs/", { method: "POST", formData });
      toast("Documentation saved.", "success");
      setDocFor(null); setDocNotes(""); setDocFile(null);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  const now = new Date();
  const upcoming = shifts.filter((s) => new Date(s.end_time) >= now && !s.clock_out_at);
  const past = shifts.filter((s) => new Date(s.end_time) < now || s.clock_out_at);

  return (
    <div>
      <h1>My schedule</h1>
      <p className="sub">Clock in opens 15 minutes before each shift, within 100 meters of the client address.</p>

      <h2>Upcoming</h2>
      <div className="stack" style={{ marginBottom: 24 }}>
        {upcoming.map((s) => (
          <div key={s.id} className="card" style={{ marginBottom: 0 }}>
            <div className="row between">
              <div>
                <strong>{s.client_name}</strong> <StatusBadge value={s.status} />
                <div className="small">{new Date(s.start_time).toLocaleString()} to {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                <div className="muted small">{s.location}</div>
                {s.status === "change_requested" && <div className="muted small">Awaiting manager decision: {s.change_request_note}</div>}
              </div>
              <div className="row">
                {!s.clock_in_at && !s.on_my_way_at && <button className="btn outline small" onClick={() => simple(s, "on-my-way", "The client has been told you are on the way.")}>On my way</button>}
                {!s.clock_in_at && <button className="btn small" onClick={() => clockIn(s)}>Clock in</button>}
                {s.clock_in_at && !s.clock_out_at && <button className="btn small" onClick={() => simple(s, "clock-out", "Clocked out. Nice work.")}>Clock out</button>}
                {!s.clock_in_at && s.status !== "change_requested" && <button className="btn outline small" onClick={() => setChangeFor(s)}>Request change</button>}
              </div>
            </div>
          </div>
        ))}
        {upcoming.length === 0 && <div className="card muted">No upcoming shifts.</div>}
      </div>

      <h2>Past</h2>
      <div className="card tight">
        <table>
          <thead><tr><th>Client</th><th>When</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {past.slice(0, 20).map((s) => (
              <tr key={s.id}>
                <td>{s.client_name}</td>
                <td className="muted small">{new Date(s.start_time).toLocaleString()}</td>
                <td><StatusBadge value={s.status} /></td>
                <td><button className="btn outline small" onClick={() => setDocFor(s)}>Add documentation</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {changeFor && (
        <Modal title="Request a shift change" onClose={() => setChangeFor(null)}>
          <p className="muted small">Your manager will be notified and can approve or decline. If approved, customer service updates the schedule.</p>
          <form onSubmit={fileChange}>
            <label>Reason</label>
            <textarea rows={3} required value={changeForm.reason} onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })} />
            <div className="grid2">
              <div>
                <label>Preferred new start (optional)</label>
                <input type="datetime-local" value={changeForm.requested_start_time} onChange={(e) => setChangeForm({ ...changeForm, requested_start_time: e.target.value })} />
              </div>
              <div>
                <label>Preferred new end (optional)</label>
                <input type="datetime-local" value={changeForm.requested_end_time} onChange={(e) => setChangeForm({ ...changeForm, requested_end_time: e.target.value })} />
              </div>
            </div>
            <button className="btn" style={{ marginTop: 14 }}>Send to manager</button>
          </form>
        </Modal>
      )}

      {docFor && (
        <Modal title={`Documentation for ${docFor.client_name}`} onClose={() => setDocFor(null)}>
          <form onSubmit={saveDoc}>
            <label>Visit notes</label>
            <textarea rows={4} required value={docNotes} onChange={(e) => setDocNotes(e.target.value)} />
            <label>Attach a file (optional)</label>
            <input type="file" onChange={(e) => setDocFile(e.target.files[0])} />
            <button className="btn" style={{ marginTop: 14 }}>Save</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
