// Hospital partner: submit a referral with full clinical intake and documents.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useToast } from "../toast.jsx";

export default function HospitalNew() {
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ client_name: "", urgency: "normal", notes: "", concerns_flag: "" });
  const [details, setDetails] = useState({ age: "", contact: "", address: "", emergency_contact: "" });
  const [intake, setIntake] = useState({
    diagnosis: "", insurance: "", mobility: "", cognition: "",
    living_situation: "", allergies: "", preferred_start: "", weekly_hours: "",
  });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const referral = await api("/referrals/", {
        method: "POST",
        body: { ...form, client_details: details, intake_data: intake },
      });
      // Upload each attached document after the referral exists.
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        await api(`/referrals/${referral.id}/documents/`, { method: "POST", formData });
      }
      toast("Referral submitted. The care team has been notified.", "success");
      navigate("/hospital");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>New referral</h1>
      <p className="sub">The customer service team is notified the moment you submit.</p>
      <div className="card" style={{ maxWidth: 720 }}>
        <form onSubmit={submit}>
          <div className="section-label">Client details</div>
          <label>Client full name</label>
          <input required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
          <div className="grid2">
            <div>
              <label>Age</label>
              <input value={details.age} onChange={(e) => setDetails({ ...details, age: e.target.value })} />
            </div>
            <div>
              <label>Contact phone</label>
              <input value={details.contact} onChange={(e) => setDetails({ ...details, contact: e.target.value })} />
            </div>
            <div>
              <label>Address</label>
              <input value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} />
            </div>
            <div>
              <label>Emergency contact</label>
              <input value={details.emergency_contact} onChange={(e) => setDetails({ ...details, emergency_contact: e.target.value })} placeholder="Name, phone" />
            </div>
          </div>

          <div className="section-label">Clinical intake</div>
          <div className="grid2">
            <div>
              <label>Diagnosis</label>
              <input value={intake.diagnosis} onChange={(e) => setIntake({ ...intake, diagnosis: e.target.value })} />
            </div>
            <div>
              <label>Insurance</label>
              <input value={intake.insurance} onChange={(e) => setIntake({ ...intake, insurance: e.target.value })} />
            </div>
            <div>
              <label>Mobility</label>
              <input value={intake.mobility} onChange={(e) => setIntake({ ...intake, mobility: e.target.value })} placeholder="Independent, walker, wheelchair..." />
            </div>
            <div>
              <label>Cognition</label>
              <input value={intake.cognition} onChange={(e) => setIntake({ ...intake, cognition: e.target.value })} placeholder="Alert, mild impairment..." />
            </div>
            <div>
              <label>Living situation</label>
              <input value={intake.living_situation} onChange={(e) => setIntake({ ...intake, living_situation: e.target.value })} placeholder="Lives alone, with spouse..." />
            </div>
            <div>
              <label>Allergies</label>
              <input value={intake.allergies} onChange={(e) => setIntake({ ...intake, allergies: e.target.value })} />
            </div>
            <div>
              <label>Preferred start</label>
              <input value={intake.preferred_start} onChange={(e) => setIntake({ ...intake, preferred_start: e.target.value })} placeholder="As soon as possible" />
            </div>
            <div>
              <label>Weekly hours needed</label>
              <input value={intake.weekly_hours} onChange={(e) => setIntake({ ...intake, weekly_hours: e.target.value })} />
            </div>
          </div>

          <div className="section-label">For the care team</div>
          <label>Urgency</label>
          <select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
            <option value="low">Low</option><option value="normal">Normal</option>
            <option value="high">High</option><option value="emergency">Emergency</option>
          </select>
          <label>Notes</label>
          <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <label>Concerns to flag (optional)</label>
          <input value={form.concerns_flag} onChange={(e) => setForm({ ...form, concerns_flag: e.target.value })} placeholder="Fall risk, lives alone..." />
          <label>Documents (10MB max each)</label>
          <input type="file" multiple onChange={(e) => setFiles([...e.target.files])} />
          <button className="btn" style={{ marginTop: 16 }} disabled={busy}>{busy ? "Submitting..." : "Submit referral"}</button>
        </form>
      </div>
    </div>
  );
}