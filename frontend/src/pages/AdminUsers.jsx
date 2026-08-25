// Admin: invite users, edit roles, assign managers and programs, copy
// invite links, bulk invite from Excel, and deactivate accounts.
import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../toast.jsx";

const ROLES = ["admin", "manager", "customer_service", "field_staff", "hospital_partner", "client", "family"];

export default function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [invite, setInvite] = useState({ email: "", full_name: "", role: "client", hospital: "", manager: "" });
  const [inviteLink, setInviteLink] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  function load() {
    api("/auth/users/").then(setUsers).catch((e) => toast(e.message, "error"));
    api("/auth/hospitals/").then(setHospitals).catch(() => {});
    api("/programs/").then(setPrograms).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const managers = users.filter((u) => u.role === "manager");

  async function sendInvite(e) {
    e.preventDefault();
    try {
      const data = await api("/auth/users/", {
        method: "POST",
        body: { ...invite, hospital: invite.hospital || null, manager: invite.manager || null },
      });
      setInviteLink(data.invite_link);
      toast("User created. Share the invite link below with them.", "success");
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      await api(`/auth/users/${editing.id}/`, {
        method: "PATCH",
        body: {
          role: editing.role,
          manager: editing.manager || null,
          hospital: editing.hospital || null,
          invite_status: editing.invite_status,
          program_ids: editing.program_ids,
        },
      });
      toast("User updated.", "success");
      setEditing(null);
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function resend(user) {
    try {
      const data = await api(`/auth/users/${user.id}/resend-invite/`, { method: "POST" });
      await navigator.clipboard.writeText(data.invite_link).catch(() => {});
      toast("Fresh invite link copied to your clipboard.", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function bulkInvite(file) {
    if (!file) return;
    setBulkBusy(true);
    setBulkResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const result = await api("/auth/users/bulk-invite/", { method: "POST", formData });
      setBulkResult(result);
      toast(`Invited ${result.created.length} user(s).`, "success");
      load();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <div className="row between">
        <div>
          <h1>Users and invites</h1>
          <p className="sub">Everyone on the platform, across every role.</p>
        </div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <button className="btn outline" onClick={() => { setBulkOpen(true); setBulkResult(null); }}>Bulk invite (Excel)</button>
          <button className="btn" onClick={() => { setInviteOpen(true); setInviteLink(""); }}>Invite user</button>
        </div>
      </div>

      <div className="card tight">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Programs</th><th>Manager</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td className="muted">{u.email}</td>
                <td>{u.role.replaceAll("_", " ")}</td>
                <td className="muted small">{(u.program_names || []).join(", ") || "-"}</td>
                <td className="muted small">{u.manager_name || "-"}</td>
                <td><StatusBadge value={u.invite_status} /></td>
                <td className="row">
                  <button className="btn outline small" onClick={() => setEditing({ ...u, program_ids: u.program_ids || [] })}>Edit</button>
                  {u.invite_status === "invited" && <button className="btn outline small" onClick={() => resend(u)}>Copy invite</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inviteOpen && (
        <Modal title="Invite a user" onClose={() => setInviteOpen(false)}>
          <form onSubmit={sendInvite}>
            <label>Full name</label>
            <input required value={invite.full_name} onChange={(e) => setInvite({ ...invite, full_name: e.target.value })} />
            <label>Email</label>
            <input type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            <label>Role</label>
            <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}
            </select>
            {invite.role === "hospital_partner" && (
              <>
                <label>Hospital</label>
                <select value={invite.hospital} onChange={(e) => setInvite({ ...invite, hospital: e.target.value })}>
                  <option value="">Select...</option>
                  {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </>
            )}
            {invite.role === "field_staff" && (
              <>
                <label>Manager (approves their shift changes)</label>
                <select value={invite.manager} onChange={(e) => setInvite({ ...invite, manager: e.target.value })}>
                  <option value="">None yet</option>
                  {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </>
            )}
            <button className="btn" style={{ marginTop: 14 }}>Create and get invite link</button>
          </form>
          {inviteLink && (
            <div style={{ marginTop: 14 }} className="small">
              <strong>Invite link (share it with the new user):</strong>
              <div style={{ wordBreak: "break-all", background: "var(--primary-soft)", padding: 10, borderRadius: 8, marginTop: 6 }}>{inviteLink}</div>
            </div>
          )}
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${editing.full_name}`} onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit}>
            <label>Role</label>
            <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}
            </select>
            <label>Manager</label>
            <select value={editing.manager || ""} onChange={(e) => setEditing({ ...editing, manager: e.target.value })}>
              <option value="">None</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
            <label>Programs (hold Ctrl or Cmd to pick several)</label>
            <select multiple value={editing.program_ids.map(String)} size={4}
              onChange={(e) => setEditing({ ...editing, program_ids: [...e.target.selectedOptions].map((o) => Number(o.value)) })}>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label>Status</label>
            <select value={editing.invite_status} onChange={(e) => setEditing({ ...editing, invite_status: e.target.value })}>
              <option value="invited">invited</option>
              <option value="active">active</option>
              <option value="deactivated">deactivated</option>
            </select>
            <button className="btn" style={{ marginTop: 14 }}>Save changes</button>
          </form>
        </Modal>
      )}

      {bulkOpen && (
        <Modal title="Bulk invite from Excel" onClose={() => setBulkOpen(false)}>
          <p className="muted small">
            Upload an .xlsx file with a header row: <strong>full_name, email, role, programs, manager_email</strong>.
            programs and manager_email are optional. programs is a comma separated list of existing program names,
            manager_email must match an existing manager's account.
          </p>
          <input type="file" accept=".xlsx" disabled={bulkBusy} onChange={(e) => bulkInvite(e.target.files[0])} />
          {bulkBusy && <p className="muted small">Processing...</p>}
          {bulkResult && (
            <div className="stack small" style={{ marginTop: 14 }}>
              <div className="badge success">{bulkResult.created.length} invited</div>
              {bulkResult.skipped.length > 0 && <div className="badge warning">{bulkResult.skipped.length} skipped (already existed)</div>}
              {bulkResult.errors.length > 0 && <div className="badge danger">{bulkResult.errors.length} errors</div>}
              {bulkResult.errors.map((e, i) => (
                <div key={i} className="muted">Row {e.row}{e.email ? ` (${e.email})` : ""}: {e.reason}</div>
              ))}
              {bulkResult.skipped.map((s, i) => (
                <div key={i} className="muted">Row {s.row} ({s.email}): {s.reason}</div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}