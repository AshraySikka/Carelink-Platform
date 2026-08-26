// Hospital partner: their own submitted referrals with live status. Click
// a row to open full detail in a drawer, including the ability to attach
// more documents at any point, not just while the referral is still new.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Drawer from "../components/Drawer.jsx";
import NewsFeed from "../components/NewsFeed.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../toast.jsx";

// Small helper to render a label and value pair inside the drawer, same
// shape as the one CS uses in the referral queue drawer.
function Field({ label, value }) {
  return (
    <div>
      <div className="muted small">{label}</div>
      <div>{value || <span className="muted">-</span>}</div>
    </div>
  );
}

export default function HospitalReferrals() {
  const toast = useToast();
  const [referrals, setReferrals] = useState([]);
  const [openItem, setOpenItem] = useState(null);
  const [uploading, setUploading] = useState(false);

  function load() {
    api("/referrals/").then(setReferrals).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addDocuments(files) {
    if (!files.length || !openItem) return;
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        await api(`/referrals/${openItem.id}/documents/`, { method: "POST", formData });
      }
      toast(files.length > 1 ? "Documents added." : "Document added.", "success");
      const updated = await api("/referrals/");
      setReferrals(updated);
      const fresh = updated.find((r) => r.id === openItem.id);
      if (fresh) setOpenItem(fresh);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setUploading(false);
    }
  }

  const details = openItem?.client_details || {};
  const intake = openItem?.intake_data || {};

  return (
    <div>
      <div className="row between">
        <div>
          <h1>My referrals</h1>
          <p className="sub">Everything your organization has submitted, with current status.</p>
        </div>
        <Link to="/hospital/new" className="btn" style={{ textDecoration: "none" }}>New referral</Link>
      </div>

      <NewsFeed />

      <div className="card tight">
        <table>
          <thead><tr><th>Client</th><th>Urgency</th><th>Status</th><th>Assigned</th><th>Submitted</th></tr></thead>
          <tbody>
            {referrals.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => setOpenItem(r)}>
                <td><strong>{r.client_name}</strong><div className="muted small">{r.notes?.slice(0, 80)}</div></td>
                <td><StatusBadge value={r.urgency} /></td>
                <td><StatusBadge value={r.status} /></td>
                <td className="muted small">{r.assigned_staff_name || "Pending"}</td>
                <td className="muted small">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {referrals.length === 0 && <tr><td colSpan={5} className="muted center">No referrals yet. Submit your first one.</td></tr>}
          </tbody>
        </table>
      </div>

      {openItem && (
        <Drawer title={openItem.client_name} onClose={() => setOpenItem(null)}>
          <div className="row" style={{ marginBottom: 6 }}>
            <StatusBadge value={openItem.status} /> <StatusBadge value={openItem.urgency} />
          </div>
          <div className="muted small">Assigned staff: {openItem.assigned_staff_name || "Not yet assigned"}</div>

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

          <div className="section-label">Notes submitted</div>
          <div>{openItem.notes || <span className="muted">-</span>}</div>

          <div className="section-label">Documents</div>
          {openItem.documents?.length ? (
            openItem.documents.map((d) => (
              <div key={d.id}><a href={d.file} target="_blank" rel="noreferrer">{d.file_name}</a></div>
            ))
          ) : (
            <div className="muted">No documents yet.</div>
          )}
          <label style={{ marginTop: 10 }}>Add more documents (10MB max each)</label>
          <input type="file" multiple disabled={uploading} onChange={(e) => addDocuments([...e.target.files])} />
          {uploading && <p className="muted small">Uploading...</p>}
        </Drawer>
      )}
    </div>
  );
}
