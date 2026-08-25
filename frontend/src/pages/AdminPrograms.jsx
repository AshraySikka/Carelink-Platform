// Admin: create and manage the programs staff can be assigned to.
import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../toast.jsx";

export default function AdminPrograms() {
  const toast = useToast();
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState({ name: "", description: "" });

  function load() {
    api("/programs/").then(setPrograms).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(e) {
    e.preventDefault();
    try {
      await api("/programs/", { method: "POST", body: form });
      setForm({ name: "", description: "" });
      toast("Program created.", "success");
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function remove(id) {
    if (!confirm("Delete this program? Staff assignments to it are removed.")) return;
    await api(`/programs/${id}/`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1>Programs</h1>
      <p className="sub">Service programs used to organize, sort, and filter staff.</p>
      <div className="grid2">
        <div className="card tight">
          <table>
            <thead><tr><th>Program</th><th>Staff</th><th></th></tr></thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong><div className="muted small">{p.description}</div></td>
                  <td>{p.staff_count}</td>
                  <td><button className="btn outline small" onClick={() => remove(p.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Add a program</h2>
          <form onSubmit={create}>
            <label>Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <label>Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <button className="btn" style={{ marginTop: 14 }}>Create program</button>
          </form>
        </div>
      </div>
    </div>
  );
}
