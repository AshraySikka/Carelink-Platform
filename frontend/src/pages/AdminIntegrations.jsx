// Admin: the two integration placeholders, ready for real credentials.
// Left: Procura field mapping panel. Right: Outlook intake rules and status.
import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../toast.jsx";

export default function AdminIntegrations() {
  const toast = useToast();
  const [mappings, setMappings] = useState([]);
  const [mapForm, setMapForm] = useState({ procura_field: "", carelink_field: "", notes: "" });
  const [syncResult, setSyncResult] = useState(null);
  const [rules, setRules] = useState([]);
  const [ruleForm, setRuleForm] = useState({ name: "", subject_contains: "", sender_contains: "", set_urgency: "normal" });
  const [outlookStatus, setOutlookStatus] = useState(null);

  function load() {
    api("/integrations/procura/mappings/").then(setMappings).catch(() => {});
    api("/integrations/outlook/rules/").then(setRules).catch(() => {});
    api("/integrations/outlook/status/").then(setOutlookStatus).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addMapping(e) {
    e.preventDefault();
    try {
      await api("/integrations/procura/mappings/", { method: "POST", body: mapForm });
      setMapForm({ procura_field: "", carelink_field: "", notes: "" });
      load();
    } catch (error) { toast(error.message, "error"); }
  }

  async function addRule(e) {
    e.preventDefault();
    try {
      await api("/integrations/outlook/rules/", { method: "POST", body: ruleForm });
      setRuleForm({ name: "", subject_contains: "", sender_contains: "", set_urgency: "normal" });
      load();
    } catch (error) { toast(error.message, "error"); }
  }

  return (
    <div>
      <h1>Integrations</h1>
      <p className="sub">Both integrations are configured here now, and switch on the moment vendor access is confirmed.</p>

      <div className="grid2">
        <div className="card">
          <h2>Procura field mapping</h2>
          <p className="muted small">
            Map Procura field names to CareLink fields. The sync itself stays a placeholder until
            the access method on your Procura contract is confirmed with the vendor.
          </p>
          <table>
            <thead><tr><th>Procura field</th><th>CareLink field</th><th></th></tr></thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id}>
                  <td>{m.procura_field}</td>
                  <td>{m.carelink_field}</td>
                  <td><button className="btn outline small" onClick={async () => { await api(`/integrations/procura/mappings/${m.id}/`, { method: "DELETE" }); load(); }}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <form onSubmit={addMapping} style={{ marginTop: 10 }}>
            <div className="grid2">
              <div>
                <label>Procura field</label>
                <input required value={mapForm.procura_field} onChange={(e) => setMapForm({ ...mapForm, procura_field: e.target.value })} placeholder="client_first_name" />
              </div>
              <div>
                <label>CareLink field</label>
                <input required value={mapForm.carelink_field} onChange={(e) => setMapForm({ ...mapForm, carelink_field: e.target.value })} placeholder="client_name" />
              </div>
            </div>
            <button className="btn" style={{ marginTop: 12 }}>Add mapping</button>
            <button type="button" className="btn outline" style={{ marginTop: 12, marginLeft: 8 }}
              onClick={async () => setSyncResult(await api("/integrations/procura/sync/", { method: "POST" }))}>
              Run test sync
            </button>
          </form>
          {syncResult && (
            <div className="small" style={{ marginTop: 10, background: "var(--warning-soft)", padding: 10, borderRadius: 8 }}>
              <strong>{syncResult.status}</strong>: {syncResult.detail}
            </div>
          )}
        </div>

        <div className="card">
          <h2>Outlook and efax intake</h2>
          {outlookStatus && (
            <div className="small" style={{ background: outlookStatus.status === "configured" ? "var(--success-soft)" : "var(--warning-soft)", padding: 10, borderRadius: 8, marginBottom: 10 }}>
              <strong>{outlookStatus.status.replaceAll("_", " ")}</strong>: {outlookStatus.detail}
            </div>
          )}
          <p className="muted small">
            Sorting rules for incoming referral email. Once Microsoft Graph access is granted,
            matching emails will be read, extracted with AI, and created as referrals automatically
            with source marked as outlook.
          </p>
          <table>
            <thead><tr><th>Rule</th><th>Matches</th><th>Urgency</th><th></th></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="muted small">
                    {r.subject_contains && <>subject has "{r.subject_contains}"<br /></>}
                    {r.sender_contains && <>sender has "{r.sender_contains}"</>}
                  </td>
                  <td>{r.set_urgency}</td>
                  <td><button className="btn outline small" onClick={async () => { await api(`/integrations/outlook/rules/${r.id}/`, { method: "DELETE" }); load(); }}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <form onSubmit={addRule} style={{ marginTop: 10 }}>
            <label>Rule name</label>
            <input required value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} placeholder="Riverside referrals" />
            <div className="grid2">
              <div>
                <label>Subject contains</label>
                <input value={ruleForm.subject_contains} onChange={(e) => setRuleForm({ ...ruleForm, subject_contains: e.target.value })} placeholder="referral" />
              </div>
              <div>
                <label>Sender contains</label>
                <input value={ruleForm.sender_contains} onChange={(e) => setRuleForm({ ...ruleForm, sender_contains: e.target.value })} placeholder="@riverside.org" />
              </div>
            </div>
            <label>Set urgency</label>
            <select value={ruleForm.set_urgency} onChange={(e) => setRuleForm({ ...ruleForm, set_urgency: e.target.value })}>
              <option value="low">low</option><option value="normal">normal</option>
              <option value="high">high</option><option value="emergency">emergency</option>
            </select>
            <button className="btn" style={{ marginTop: 12 }}>Add rule</button>
          </form>
        </div>
      </div>
    </div>
  );
}
