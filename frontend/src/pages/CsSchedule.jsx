// Scheduling board: expandable employee cards with contact details,
// availability chips, their shifts (with edit and delete), and a per
// employee shift creation shortcut. Search, program filter, and program
// sorting all still work the same way.
import { useEffect, useState } from "react";
import { api } from "../api";
import Icon from "../components/Icons.jsx";
import Modal from "../components/Modal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../auth.jsx";
import { fromLocalInputValue, toLocalInputValue } from "../dateInput.js";
import { useToast } from "../toast.jsx";

const DAYS = [["sun", "Sun"], ["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"]];
const EMPTY_FORM = { field_staff: "", client: "", start_time: "", end_time: "", notes: "" };

function initials(name) {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function AvailabilityChips({ schedule }) {
  if (!schedule) return <span className="muted small">No availability set.</span>;
  return (
    <div className="row" style={{ gap: 6 }}>
      {DAYS.map(([key, label]) => {
        const day = schedule[key];
        const hours = day && typeof day === "object" ? day.from && day.to ? `${day.from}-${day.to}` : "" : day;
        return (
          <span key={key} className={`badge ${day ? "info" : "muted"}`}>
            {label}{hours ? ` ${hours}` : ""}
          </span>
        );
      })}
    </div>
  );
}

export default function CsSchedule() {
  const { subscribe } = useAuth();
  const toast = useToast();
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [clients, setClients] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [sortByProgram, setSortByProgram] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({ start_time: "", end_time: "", notes: "", status: "" });

  function loadStaff() {
    const params = new URLSearchParams({ role: "field_staff" });
    if (search) params.set("q", search);
    if (programFilter) params.set("program", programFilter);
    if (sortByProgram) params.set("sort", "program");
    api(`/auth/staff-directory/?${params}`).then(setStaff).catch(() => {});
  }

  function loadShifts() {
    api("/shifts/").then(setShifts).catch(() => {});
  }

  // Keeps the board live: if a shift changes on the backend (a manual edit,
  // an approval, a clock in) while this page is open, it reloads instead
  // of showing whatever it had when the page first loaded.
  useEffect(() => {
    return subscribe((event) => {
      if (event.kind === "notification" && (event.category === "schedule" || event.category === "approvals")) loadShifts();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(loadStaff, [search, programFilter, sortByProgram]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadShifts();
    api("/programs/").then(setPrograms).catch(() => {});
    api("/auth/clients-directory/").then(setClients).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate(presetStaffId) {
    setForm({ ...EMPTY_FORM, field_staff: presetStaffId || "" });
    setCreating(true);
  }

  function pickClient(clientId) {
    const client = clients.find((c) => String(c.id) === String(clientId));
    setForm((f) => ({ ...f, client: clientId, _clientAddress: client?.address || "" }));
  }

  async function createShift(e) {
    e.preventDefault();
    try {
      await api("/shifts/", {
        method: "POST",
        body: { field_staff: form.field_staff, client: form.client, start_time: fromLocalInputValue(form.start_time), end_time: fromLocalInputValue(form.end_time), location: form._clientAddress || "", notes: form.notes },
      });
      toast("Shift created. Staff and client have been notified.", "success");
      setCreating(false);
      loadShifts();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function openEdit(shift) {
    setEditingShift(shift);
    setEditForm({
      start_time: toLocalInputValue(shift.start_time),
      end_time: toLocalInputValue(shift.end_time),
      notes: shift.notes || "",
      status: shift.status,
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      await api(`/shifts/${editingShift.id}/`, {
        method: "PATCH",
        body: { ...editForm, start_time: fromLocalInputValue(editForm.start_time), end_time: fromLocalInputValue(editForm.end_time) },
      });
      toast("Shift updated.", "success");
      setEditingShift(null);
      loadShifts();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function deleteShift(shift) {
    if (!confirm(`Delete the ${new Date(shift.start_time).toLocaleDateString()} shift with ${shift.client_name}?`)) return;
    try {
      await api(`/shifts/${shift.id}/`, { method: "DELETE" });
      toast("Shift deleted.", "success");
      loadShifts();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  return (
    <div>
      <div className="row between">
        <div>
          <h1>Schedule</h1>
          <p className="sub">Shifts grouped by field staff. Click a name to see details and manage their schedule.</p>
        </div>
        <button className="btn" onClick={() => openCreate("")}>+ New shift</button>
      </div>

      <div className="card">
        <div className="row">
          <input
            style={{ flex: 2, minWidth: 200 }}
            placeholder="Search employees by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select style={{ flex: 1, minWidth: 160 }} value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
            <option value="">All programs</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label className="row" style={{ margin: 0, fontWeight: 500 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={sortByProgram} onChange={(e) => setSortByProgram(e.target.checked)} />
            Sort by program
          </label>
        </div>
      </div>

      {staff.map((employee) => {
        const theirShifts = shifts
          .filter((s) => s.field_staff === employee.id)
          .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
        const upcoming = theirShifts.filter((s) => new Date(s.end_time) >= new Date()).length;
        const isOpen = expanded === employee.id;
        return (
          <div key={employee.id} className={`card staff-card ${isOpen ? "expanded" : ""}`} style={{ padding: 0, overflow: "hidden" }}>
            <div className="staff-head" onClick={() => setExpanded(isOpen ? null : employee.id)}>
              <div className="row" style={{ gap: 12 }}>
                <span className="avatar">{initials(employee.full_name)}</span>
                <div>
                  <strong style={{ fontSize: "1.05rem" }}>{employee.full_name}</strong>
                  <div className="muted small">
                    {upcoming} upcoming, {theirShifts.length} total
                    {employee.program_names?.length ? `, ${employee.program_names.join(", ")}` : ""}
                  </div>
                </div>
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: "0 20px 20px" }}>
                <div className="staff-details">
                  <div className="grid2">
                    <div>
                      <div className="muted small">Email</div>
                      <div>{employee.email}</div>
                    </div>
                    <div>
                      <div className="muted small">Phone</div>
                      <div>{employee.phone || "-"}</div>
                    </div>
                    <div>
                      <div className="muted small">Address</div>
                      <div>{employee.address || "-"}</div>
                    </div>
                    <div>
                      <div className="muted small">Date of birth</div>
                      <div>{employee.date_of_birth ? new Date(employee.date_of_birth + "T00:00:00").toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "-"}</div>
                    </div>
                  </div>
                  <div className="muted small" style={{ marginTop: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Availability</div>
                  <AvailabilityChips schedule={employee.availability_schedule} />
                  {employee.availability_notes && <div className="muted small" style={{ marginTop: 6, fontStyle: "italic" }}>"{employee.availability_notes}"</div>}
                </div>

                <div className="row between" style={{ marginTop: 16 }}>
                  <div className="muted small" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Shifts</div>
                  <button className="btn outline small" onClick={() => openCreate(employee.id)}>+ New shift for {employee.full_name.split(" ")[0]}</button>
                </div>
                <div style={{ marginTop: 8 }}>
                  {theirShifts.slice(0, 12).map((s) => (
                    <div key={s.id} className="shift-row">
                      <div>
                        <strong>{new Date(s.start_time).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
                        <div className="muted small">Client: {s.client_name}{s.location ? ` \u00b7 ${s.location}` : ""}</div>
                        {s.status === "change_requested" && <div className="muted small">{s.change_request_note}</div>}
                      </div>
                      <div className="actions">
                        <StatusBadge value={s.status} />
                        {s.status !== "completed" && (
                          <>
                            <button className="icon-btn" onClick={() => openEdit(s)} aria-label="Edit shift"><Icon name="edit" size={15} /></button>
                            <button className="icon-btn" onClick={() => deleteShift(s)} aria-label="Delete shift"><Icon name="trash" size={15} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {theirShifts.length === 0 && <div className="muted center" style={{ padding: 16 }}>No shifts yet.</div>}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {staff.length === 0 && <div className="card muted">No employees match this search.</div>}

      {creating && (
        <Modal title="Schedule shift" onClose={() => setCreating(false)}>
          <form onSubmit={createShift}>
            <label>Field staff</label>
            <select required value={form.field_staff} onChange={(e) => setForm({ ...form, field_staff: e.target.value })}>
              <option value="">Select...</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <label>Client</label>
            <select required value={form.client} onChange={(e) => pickClient(e.target.value)}>
              <option value="">Select...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
            {form._clientAddress && <p className="muted small" style={{ marginTop: -8 }}>Location: {form._clientAddress}</p>}
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
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything the caregiver should know..." />
            <button className="btn" style={{ marginTop: 14, width: "100%" }}>Create shift</button>
          </form>
        </Modal>
      )}

      {editingShift && (
        <Modal title="Edit shift" onClose={() => setEditingShift(null)}>
          <p className="muted small">{editingShift.field_staff_name} with {editingShift.client_name}</p>
          <form onSubmit={saveEdit}>
            <div className="grid2">
              <div>
                <label>Start</label>
                <input type="datetime-local" required value={editForm.start_time} onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })} />
              </div>
              <div>
                <label>End</label>
                <input type="datetime-local" required value={editForm.end_time} onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })} />
              </div>
            </div>
            <label>Status</label>
            <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              <option value="scheduled">scheduled</option>
              <option value="confirmed">confirmed</option>
              <option value="in_progress">in progress</option>
              <option value="completed">completed</option>
              <option value="approved_pending_change">approved, pending change</option>
            </select>
            <label>Notes</label>
            <textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            <button className="btn" style={{ marginTop: 14, width: "100%" }}>Save changes</button>
          </form>
        </Modal>
      )}
    </div>
  );
}