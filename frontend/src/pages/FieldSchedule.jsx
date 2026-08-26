// Field staff workspace: List, Calendar, Availability, and Documentation
// tabs, with a red Emergency button always available top right.
import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../auth.jsx";
import NewsFeed from "../components/NewsFeed.jsx";
import { fromLocalInputValue } from "../dateInput.js";
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

const TABS = [["list", "List"], ["calendar", "Calendar"], ["availability", "Availability"], ["documentation", "Documentation"], ["emergencies", "Emergencies"]];

export default function FieldSchedule() {
  const toast = useToast();
  const [tab, setTab] = useState("list");
  const [shifts, setShifts] = useState([]);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  // Lets "Log documentation" on a past visit jump straight to the
  // Documentation tab with that shift already selected.
  const [docPresetShiftId, setDocPresetShiftId] = useState(null);

  const { subscribe } = useAuth();

  function loadShifts() {
    api("/shifts/").then(setShifts).catch(() => {});
  }
  useEffect(loadShifts, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keeps the schedule live: if customer service updates a shift's time
  // while this page is already open, it reloads instead of showing the
  // time it had when the page first loaded.
  useEffect(() => {
    return subscribe((event) => {
      if (event.kind === "notification" && (event.category === "schedule" || event.category === "approvals")) loadShifts();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goDocument(shiftId) {
    setDocPresetShiftId(shiftId);
    setTab("documentation");
  }

  return (
    <div>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="tabbar">
          {TABS.map(([key, label]) => (
            <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
        <button className="btn danger" onClick={() => setEmergencyOpen(true)}>{"\u{1F6A8}"} Emergency</button>
      </div>

      <h1>Your schedule</h1>
      <p className="sub">Confirm shifts, clock in/out, and log visit details.</p>

      {tab === "list" && <ListTab shifts={shifts} reload={loadShifts} onDocument={goDocument} />}
      {tab === "calendar" && <CalendarTab shifts={shifts} />}
      {tab === "availability" && <AvailabilityTab />}
      {tab === "documentation" && <DocumentationTab shifts={shifts} presetShiftId={docPresetShiftId} clearPreset={() => setDocPresetShiftId(null)} />}
      {tab === "emergencies" && <EmergenciesTab />}

      {emergencyOpen && <EmergencyModal shifts={shifts} onClose={() => setEmergencyOpen(false)} />}
    </div>
  );
}

// ---------------- List tab ----------------

function ListTab({ shifts, reload, onDocument }) {
  const toast = useToast();
  const [changeFor, setChangeFor] = useState(null);
  const [changeForm, setChangeForm] = useState({ reason: "", requested_start_time: "", requested_end_time: "" });

  async function clockIn(shift, override = false) {
    const position = await getPosition();
    try {
      await api(`/shifts/${shift.id}/clock-in/`, { method: "POST", body: { ...(position || {}), override } });
      toast("Clocked in.", "success");
      reload();
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
      reload();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  // On my way is only allowed on the calendar day of the shift, and also
  // posts a real chat message to the client, so this opens that thread in
  // the messages bubble right after sending.
  async function sendOnMyWay(shift) {
    try {
      const data = await api(`/shifts/${shift.id}/on-my-way/`, { method: "POST", body: {} });
      toast("The client has been told you are on the way.", "success");
      if (data.conversation_id) {
        window.dispatchEvent(new CustomEvent("carelink:open-thread", { detail: { conversationId: data.conversation_id, otherUser: { full_name: shift.client_name } } }));
      }
      reload();
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
          requested_start_time: fromLocalInputValue(changeForm.requested_start_time),
          requested_end_time: fromLocalInputValue(changeForm.requested_end_time),
        },
      });
      toast("Change request sent to your manager for approval.", "success");
      setChangeFor(null);
      setChangeForm({ reason: "", requested_start_time: "", requested_end_time: "" });
      reload();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  const now = new Date();
  const upcoming = shifts.filter((s) => new Date(s.end_time) >= now && !s.clock_out_at);
  const past = shifts.filter((s) => new Date(s.end_time) < now || s.clock_out_at).slice(0, 15);

  return (
    <div>
      <NewsFeed />

      <div className="section-label" style={{ marginTop: 20 }}>Upcoming</div>
      <div className="card tight" style={{ padding: upcoming.length ? 0 : 20 }}>
        {upcoming.length === 0 && <div className="muted center">No upcoming shifts.</div>}
        {upcoming.map((s) => (
          <div key={s.id} className="staff-details" style={{ margin: 12, borderRadius: 10 }}>
            <div className="row between">
              <div>
                <strong>{s.client_name}</strong> <StatusBadge value={s.status} />
                <div className="small">{new Date(s.start_time).toLocaleString()} to {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                <div className="muted small">{s.location}</div>
                {s.status === "change_requested" && <div className="muted small">Awaiting manager decision: {s.change_request_note}</div>}
              </div>
              <div className="row">
                {!s.clock_in_at && !s.on_my_way_at && (
                  new Date(s.start_time).toDateString() === new Date().toDateString()
                    ? <button className="btn outline small" onClick={() => sendOnMyWay(s)}>On my way</button>
                    : <button className="btn outline small" disabled title="Available on the day of the shift">On my way</button>
                )}
                {!s.clock_in_at && <button className="btn small" onClick={() => clockIn(s)}>Clock in</button>}
                {s.clock_in_at && !s.clock_out_at && <button className="btn small" onClick={() => simple(s, "clock-out", "Clocked out. Nice work.")}>Clock out</button>}
                {!s.clock_in_at && s.status !== "change_requested" && <button className="btn outline small" onClick={() => setChangeFor(s)}>Request change</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {past.length > 0 && (
        <>
          <div className="section-label">Past visits</div>
          <div className="card tight">
            <table>
              <thead><tr><th>Client</th><th>When</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {past.map((s) => (
                  <tr key={s.id}>
                    <td>{s.client_name}</td>
                    <td className="muted small">{new Date(s.start_time).toLocaleString()}</td>
                    <td><StatusBadge value={s.status} /></td>
                    <td><button className="btn outline small" onClick={() => onDocument(s.id)}>Log documentation</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

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
    </div>
  );
}

// ---------------- Calendar tab ----------------

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_CLASS = {
  scheduled: "cal-scheduled", confirmed: "cal-confirmed", in_progress: "cal-progress",
  completed: "cal-completed", change_requested: "cal-changereq",
};

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function CalendarTab({ shifts }) {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));

  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + i);
    return d;
  });

  const byDate = {};
  for (const s of shifts) {
    const key = new Date(s.start_time).toDateString();
    (byDate[key] = byDate[key] || []).push(s);
  }

  const rangeLabel = `${days[0].toLocaleDateString([], { month: "short", day: "numeric" })} - ${days[27].toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div>
      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="row">
          <button className="btn outline small" onClick={() => setAnchor((a) => { const d = new Date(a); d.setDate(d.getDate() - 28); return d; })}>{"\u2039"}</button>
          <button className="btn outline small" onClick={() => setAnchor((a) => { const d = new Date(a); d.setDate(d.getDate() + 28); return d; })}>{"\u203A"}</button>
          <button className="btn outline small" onClick={() => setAnchor(startOfWeek(new Date()))}>Today</button>
        </div>
        <div className="muted">{rangeLabel}</div>
      </div>

      <div className="cal-grid">
        {WEEKDAYS.map((d) => <div key={d} className="cal-headcell muted small">{d}</div>)}
        {days.map((d) => {
          const items = byDate[d.toDateString()] || [];
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div key={d.toISOString()} className={`cal-cell ${isToday ? "cal-today" : ""}`}>
              <div className="cal-daynum">{d.getDate()}</div>
              {items.map((s) => (
                <div key={s.id} className={`cal-shift ${STATUS_CLASS[s.status] || ""}`}>
                  <div>{new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  <div>{s.client_name}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="row cal-legend">
        <span><i className="cal-dot cal-scheduled" /> Scheduled</span>
        <span><i className="cal-dot cal-confirmed" /> Confirmed</span>
        <span><i className="cal-dot cal-progress" /> In progress</span>
        <span><i className="cal-dot cal-completed" /> Completed</span>
        <span><i className="cal-dot cal-changereq" /> Change requested</span>
      </div>
    </div>
  );
}

// ---------------- Availability tab ----------------

const DAY_KEYS = [["sun", "Sunday"], ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"]];

function AvailabilityTab() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [schedule, setSchedule] = useState(user.availability_schedule || {});
  const [notes, setNotes] = useState(user.availability_notes || "");
  const [minHours, setMinHours] = useState(user.min_weekly_hours || 20);
  const [busy, setBusy] = useState(false);

  function toggleDay(key) {
    setSchedule((s) => ({ ...s, [key]: s[key] ? null : { from: "08:00 AM", to: "04:00 PM", note: "" } }));
  }

  function updateDay(key, field, value) {
    setSchedule((s) => ({ ...s, [key]: { ...(s[key] || {}), [field]: value } }));
  }

  async function save() {
    setBusy(true);
    try {
      const updated = await api("/auth/me/", {
        method: "PATCH",
        body: { availability_schedule: schedule, availability_notes: notes, min_weekly_hours: Number(minHours) || null },
      });
      setUser(updated);
      toast("Availability saved.", "success");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <h2>Weekly availability</h2>
      <p className="sub">Tap the days you're available, then set the time range for each. Schedulers use this when assigning you to clients.</p>

      <div className="staff-details" style={{ marginBottom: 20 }}>
        <label style={{ margin: 0 }}>Minimum weekly hours</label>
        <input type="number" min="0" style={{ maxWidth: 120 }} value={minHours} onChange={(e) => setMinHours(e.target.value)} />
      </div>

      <div className="muted small" style={{ textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Available days</div>
      <div className="row" style={{ marginBottom: 20 }}>
        {DAY_KEYS.map(([key, label]) => (
          <button key={key} className={`day-toggle ${schedule[key] ? "on" : ""}`} onClick={() => toggleDay(key)}>{label.slice(0, 3)}</button>
        ))}
      </div>

      <div className="stack">
        {DAY_KEYS.filter(([key]) => schedule[key]).map(([key, label]) => (
          <div key={key} className="staff-details">
            <div className="grid3">
              <div>
                <div className="muted small">{label}</div>
              </div>
              <div>
                <label className="small">From</label>
                <input value={schedule[key]?.from || ""} onChange={(e) => updateDay(key, "from", e.target.value)} placeholder="08:00 AM" />
              </div>
              <div>
                <label className="small">To</label>
                <input value={schedule[key]?.to || ""} onChange={(e) => updateDay(key, "to", e.target.value)} placeholder="04:00 PM" />
              </div>
            </div>
            <label className="small">Note (optional)</label>
            <input value={schedule[key]?.note || ""} onChange={(e) => updateDay(key, "note", e.target.value)} placeholder="e.g. only mornings" />
          </div>
        ))}
      </div>

      <label style={{ marginTop: 16 }}>Extra notes for scheduling</label>
      <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Prefers morning shifts, can pick up extra on short notice." />
      <button className="btn" style={{ marginTop: 16 }} onClick={save} disabled={busy}>{busy ? "Saving..." : "Save availability"}</button>
    </div>
  );
}

// ---------------- Documentation tab ----------------

function DocumentationTab({ shifts, presetShiftId, clearPreset }) {
  const toast = useToast();
  const [selectedShift, setSelectedShift] = useState(presetShiftId ? String(presetShiftId) : "");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [busy, setBusy] = useState(false);

  function loadEntries() {
    api("/clinical-docs/").then(setEntries).catch(() => {});
  }
  useEffect(loadEntries, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (presetShiftId) {
      setSelectedShift(String(presetShiftId));
      clearPreset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetShiftId]);

  const sortedShifts = [...shifts].sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

  async function save(e) {
    e.preventDefault();
    if (!selectedShift || !notes.trim()) {
      toast("Pick a shift and add a note first.", "error");
      return;
    }
    setBusy(true);
    const formData = new FormData();
    formData.append("shift", selectedShift);
    formData.append("notes", notes);
    if (file) formData.append("file", file);
    try {
      await api("/clinical-docs/", { method: "POST", formData });
      toast("Documentation saved.", "success");
      setNotes(""); setFile(null); setSelectedShift("");
      loadEntries();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ maxWidth: 720 }}>
        <h2>New clinical entry</h2>
        <p className="sub">Log visit details or upload a photo/document. Visible to CareLink customer service.</p>
        <form onSubmit={save}>
          <label>Shift</label>
          <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)}>
            <option value="">Select a shift...</option>
            {sortedShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.start_time).toLocaleDateString([], { month: "short", day: "numeric" })}, {s.client_name}
              </option>
            ))}
          </select>
          <label>Notes</label>
          <textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations, vitals, tasks completed..." />
          <label>Attachment (optional)</label>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <button className="btn" style={{ marginTop: 14 }} disabled={busy}>{busy ? "Saving..." : "Save entry"}</button>
        </form>
      </div>

      <div className="section-label">Recent entries</div>
      <div className="card tight" style={{ padding: entries.length ? 0 : 20 }}>
        {entries.length === 0 && <div className="muted center">No entries yet.</div>}
        {entries.map((e) => (
          <div key={e.id} className="news-item" style={{ margin: 12 }}>
            <div className="row between">
              <strong>{e.client_name}</strong>
              <span className="muted small">{new Date(e.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
            </div>
            <div className="small">{e.notes}</div>
            {e.file && <a href={e.file} target="_blank" rel="noreferrer" className="small">Attachment</a>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Emergency modal ----------------

function EmergencyModal({ shifts, onClose }) {
  const toast = useToast();
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");

  const clients = [...new Map(shifts.map((s) => [s.client, { id: s.client, full_name: s.client_name }])).values()];

  async function submit(e) {
    e.preventDefault();
    try {
      await api("/emergencies/", { method: "POST", body: { description, client: clientId || null } });
      toast("Emergency reported. Customer service has been alerted. If this is life threatening, call 911.", "success");
      onClose();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  return (
    <Modal title="Report an emergency" onClose={onClose}>
      <p className="small" style={{ background: "var(--danger-soft)", padding: 10, borderRadius: 8 }}>
        If this is a life threatening emergency, call 911 first. This alerts your CareLink care team.
      </p>
      <form onSubmit={submit}>
        <label>Which client, if any?</label>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Not client specific</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        <label>What is happening?</label>
        <textarea rows={4} required value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className="btn danger" style={{ marginTop: 14 }}>Send alert</button>
      </form>
    </Modal>
  );
}


// ---------------- Emergencies tab ----------------

function EmergenciesTab() {
  const [emergencies, setEmergencies] = useState([]);

  useEffect(() => {
    api("/emergencies/").then(setEmergencies).catch(() => {});
  }, []);

  return (
    <div>
      <div className="section-label">Emergencies you have reported</div>
      <div className="card tight" style={{ padding: emergencies.length ? 0 : 20 }}>
        {emergencies.length === 0 && <div className="muted center">No emergencies reported.</div>}
        {emergencies.map((e) => (
          <div key={e.id} className="news-item" style={{ margin: 12 }}>
            <div className="row between">
              <strong>{e.client_name || "Not client specific"}</strong>
              <StatusBadge value={e.status} />
            </div>
            <div className="small">{e.description}</div>
            <div className="muted small">{new Date(e.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}