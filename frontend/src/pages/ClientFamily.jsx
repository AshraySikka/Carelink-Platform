// Client: grant and revoke read only family access by email.
import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../toast.jsx";

export default function ClientFamily() {
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ family_name: "", family_email: "" });

  function load() {
    api("/family/").then(setMembers).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e) {
    e.preventDefault();
    try {
      await api("/family/", { method: "POST", body: form });
      setForm({ family_name: "", family_email: "" });
      toast("Family member added. If they have a CareLink family account with this email, they can see your visits now.", "success");
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function remove(id) {
    if (!confirm("Remove this family member's access?")) return;
    await api(`/family/${id}/`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1>Family access</h1>
      <p className="sub">Family members you add can see your visit schedule and care updates, read only.</p>
      <div className="grid2">
        <div className="card tight">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Linked</th><th></th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.family_name}</td>
                  <td className="muted">{m.family_email}</td>
                  <td>{m.linked ? <span className="badge success">Linked</span> : <span className="badge warning">Awaiting account</span>}</td>
                  <td><button className="btn outline small" onClick={() => remove(m.id)}>Remove</button></td>
                </tr>
              ))}
              {members.length === 0 && <tr><td colSpan={4} className="muted center">No family members added yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Add a family member</h2>
          <form onSubmit={add}>
            <label>Their name</label>
            <input required value={form.family_name} onChange={(e) => setForm({ ...form, family_name: e.target.value })} />
            <label>Their email</label>
            <input type="email" required value={form.family_email} onChange={(e) => setForm({ ...form, family_email: e.target.value })} />
            <button className="btn" style={{ marginTop: 14 }}>Grant access</button>
          </form>
          <p className="muted small" style={{ marginTop: 10 }}>
            Ask your administrator to invite them with a family account using the same email if they do not have one yet.
          </p>
        </div>
      </div>
    </div>
  );
}
