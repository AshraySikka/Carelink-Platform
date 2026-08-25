// Referral queue with the concerns column and an urgency filter (the
// dashboard's High urgency tile links here with ?urgency=high). Clicking a
// row opens a right side drawer with client details, clinical intake,
// documents, management controls, and a direct chat with the submitting
// hospital partner.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import Drawer from "../components/Drawer.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../toast.jsx";

const STATUSES = ["new", "accepted", "in_progress", "on_hold", "completed", "declined"];

// Small helper to render a label and value pair inside the drawer.
function Field({ label, value }) {
  return (
    <div>
      <div className="muted small">{label}</div>
      <div>{value || <span className="muted">-</span>}</div>
    </div>
  );
}

export default function CsQueue() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [referrals, setReferrals] = useState([]);
  const [staff, setStaff] = useState([]);
  const [openItem, setOpenItem] = useState(null);
  const [manage, setManage] = useState({ status: "", assigned_staff: "", concerns_flag: "", notes: "" });
  const [statusFilter, setStatusFilter] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const urgencyFilter = params.get("urgency") || "";

  function load() {
    api("/referrals/").then(setReferrals).catch((e) => toast(e.message, "error"));
    api("/auth/staff-directory/?role=field_staff").then(setStaff).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openReferral(r) {
    setOpenItem(r);
    setManage({
      status: r.status,
      assigned_staff: r.assigned_staff || "",
      concerns_flag: r.concerns_flag || "",
      notes: r.notes || "",
    });
  }

  async function save() {
    try {
      await api(`/referrals/${openItem.id}/`, {
        method: "PATCH",
        body: { ...manage, assigned_staff: manage.assigned_staff || null },
      });
      toast("Referral updated.", "success");
      setOpenItem(null);
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  // Starts (or reuses) a direct conversation with the hospital partner who
  // submitted this referral, then tells the messages bubble to open it.
  async function chatWithHospital() {
    if (!openItem?.submitted_by) return;
    setChatBusy(true);
    try {
      const data = await api("/messaging/conversations/", { method: "POST", body: { user_id: openItem.submitted_by } });
      window.dispatchEvent(new CustomEvent("carelink:open-thread", { detail: { conversationId: data.id } }));
      setOpenItem(null);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setChatBusy(false);
    }
  }

  function clearUrgencyFilter() {
    const next = new URLSearchParams(params);
    next.delete("urgency");
    setParams(next, { replace: true });
  }

  let visible = statusFilter ? referrals.filter((r) => r.status === statusFilter) : referrals;
  if (urgencyFilter) visible = visible.filter((r) => r.urgency === urgencyFilter || (urgencyFilter === "high" && r.urgency === "emergency"));
  const details = openItem?.client_details || {};
  const intake = openItem?.intake_data || {};

  return (
    <div>
      <h1>Referral queue</h1>
      <p className="sub">Every referral submitted by hospital partners, including future Outlook intake.</p>
      {urgencyFilter && (
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="badge warning">Urgency: {urgencyFilter} and above</span>
          <button className="btn ghost small" onClick={clearUrgencyFilter}>Clear</button>
        </div>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        <button className={`btn small ${statusFilter ? "outline" : ""}`} onClick={() => setStatusFilter("")}>All</button>
        {STATUSES.map((s) => (
          <button key={s} className={`btn small ${statusFilter === s ? "" : "outline"}`} onClick={() => setStatusFilter(s)}>{s.replaceAll("_", " ")}</button>
        ))}
      </div>
      <div className="card tight">
        <table>
          <thead><tr><th>Client</th><th>Hospital</th><th>Urgency</th><th>Status</th><th>Concerns</th><th>Assigned</th><th>Received</th></tr></thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => openReferral(r)}>
                <td><strong>{r.client_name}</strong></td>
                <td className="muted">{r.hospital_name}</td>
                <td><StatusBadge value={r.urgency} /></td>
                <td><StatusBadge value={r.status} /></td>
                <td>{r.concerns_flag ? <span className="badge danger">{r.concerns_flag}</span> : <span className="muted small">-</span>}</td>
                <td className="muted small">{r.assigned_staff_name || "-"}</td>
                <td className="muted small">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={7} className="muted center">No referrals match this filter.</td></tr>}
          </tbody>
        </table>
      </div>

      {openItem && (
        <Drawer title={openItem.client_name} onClose={() => setOpenItem(null)}>
          <div className="row" style={{ marginBottom: 6 }}>
            <StatusBadge value={openItem.status} /> <StatusBadge value={openItem.urgency} />
            <span className="badge muted">{openItem.source}</span>
          </div>
          <div className="muted small">Submitted by {openItem.submitted_by_name}, {openItem.hospital_name}</div>

          <div className="section-label">Client details</div>
          <div className="grid2">
            <Field label="Age" value={details.age} />
            <Field label="Contact" value={details.contact} />
            <Field label="Address" value={details.address} />
            <Field label="Emergency contact" value={details.emergency_contact} />
          </div>

          <div className="section-label">Clinical intake</div>
          <div className="grid2">
            <Field label="Diagnosis" value={intake.diagnosis} />
            <Field label="Insurance" value={intake.insurance} />
            <Field label="Mobility" value={intake.mobility} />
            <Field label="Cognition" value={intake.cognition} />
            <Field label="Living situation" value={intake.living_situation} />
            <Field label="Allergies" value={intake.allergies} />
            <Field label="Preferred start" value={intake.preferred_start} />
            <Field label="Weekly hours" value={intake.weekly_hours} />
          </div>

          <div className="section-label">Documents</div>
          {openItem.documents?.length ? (
            openItem.documents.map((d) => (
              <div key={d.id}><a href={d.file} target="_blank" rel="noreferrer">{d.file_name}</a></div>
            ))
          ) : (
            <div className="muted">No documents.</div>
          )}

          <div className="section-label">Manage</div>
          <label>Status</label>
          <select value={manage.status} onChange={(e) => setManage({ ...manage, status: e.target.value })}>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
          </select>
          <label>Assigned staff</label>
          <select value={manage.assigned_staff} onChange={(e) => setManage({ ...manage, assigned_staff: e.target.value })}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
          <label>Concerns flag</label>
          <input value={manage.concerns_flag} onChange={(e) => setManage({ ...manage, concerns_flag: e.target.value })} placeholder="Fall risk, lives alone..." />
          <label>Internal notes</label>
          <textarea rows={3} value={manage.notes} onChange={(e) => setManage({ ...manage, notes: e.target.value })} />
          <button className="btn" style={{ marginTop: 14, width: "100%" }} onClick={save}>Save changes</button>
          <button className="btn outline" style={{ marginTop: 8, width: "100%" }} onClick={chatWithHospital} disabled={chatBusy}>
            {chatBusy ? "Opening chat..." : `Chat with ${openItem.submitted_by_name || "hospital"}`}
          </button>
        </Drawer>
      )}
    </div>
  );
}