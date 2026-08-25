// Scheduling board: expandable employee cards with contact details,
// availability chips, their shifts, and a per employee new shift button.
// Keeps the employee search bar, program filter, and program sorting.
import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../toast.jsx";

const DAYS = [["sun", "Sun"], ["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"]];

function AvailabilityChips({ schedule }) {
  if (!schedule) return <span className="muted small">No availability set.</span>;
  return (
    <div className="row" style={{ gap: 6 }}>
      {DAYS.map(([key, label]) => {
        const hours = schedule[key];
        return (
          <span key={key} className={`badge ${hours ? "info" : "muted"}`}>
            {label}{hours ? ` ${hours}` : ""}
          </span>
        );
      })}
    </div>
  );
}

export default function CsSchedule() {
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
  const [form, setForm] = useState({ field_staff: "", client: "", start_time: "", end_time: "", location: "" });

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

  useEffect(loadStaff, [search, programFilter, sortByProgram]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadShifts();
    api("/programs/").then(setPrograms).catch(() => {});
    api("/auth/users/").then((users) => setClients(users.filter((u) => u.role === "client"))).catch(() => {
      // Customer service accounts cannot list all users. Clients are derived
      // from the shifts they can already see, handled below.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientOptions = clients.length
    ? clients
    : [...new Map(shifts.map((s) => [s.client, { id: s.client, full_name: s.client_name }])).values()];

  function openCreate(presetStaffId) {
    setForm({ field_staff: presetStaffId || "", client: "", start_time: "", end_time: "", location: "" });
    setCreating(true);
  }

  async function createShift(e) {
    e.preventDefault();
    try {
      await api("/shifts/", { method: "POST", body: form });
      toast("Shift created. Staff and client have been notified.", "success");
      setCreating(false);
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
          <div key={employee.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="staff-head" onClick={() => setExpanded(isOpen ? null : employee.id)}>
              <div>
                <span className="chev">{isOpen ? "\u25BE" : "\u25B8"}</span>
                <strong style={{ fontSize: "1.05rem" }}>{employee.full_name}</strong>
                <div className="muted small" style={{ marginLeft: 22 }}>
                  {upcoming} upcoming, {theirShifts.length} total
                  {employee.program_names?.length ? `, ${employee.program_names.join(", ")}` : ""}
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
                <table style={{ marginTop: 8 }}>
                  <thead><tr><th>Client</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
                  <tbody>
                    {theirShifts.slice(0, 12).map((s) => (
                      <tr key={s.id}>
                        <td>{s.client_name}</td>
                        <td className="muted small">{new Date(s.start_time).toLocaleString()}</td>
                        <td className="muted small">{new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                        <td>
                          <StatusBadge value={s.status} />
                          {s.status === "change_requested" && <div className="muted small">{s.change_request_note}</div>}
                        </td>
                      </tr>
                    ))}
                    {theirShifts.length === 0 && <tr><td colSpan={4} className="muted center">No shifts yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      {staff.length === 0 && <div className="card muted">No employees match this search.</div>}

      {creating && (
        <Modal title="New shift" onClose={() => setCreating(false)}>
          <form onSubmit={createShift}>
            <label>Field staff</label>
            <select required value={form.field_staff} onChange={(e) => setForm({ ...form, field_staff: e.target.value })}>
              <option value="">Select...</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <label>Client</label>
            <select required value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
              <option value="">Select...</option>
              {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
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
            <label>Location</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Client address" />
            <button className="btn" style={{ marginTop: 14 }}>Create shift</button>
          </form>
        </Modal>
      )}
    </div>
  );
}