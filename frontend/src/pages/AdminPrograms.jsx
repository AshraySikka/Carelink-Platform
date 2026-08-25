// Admin: create and manage the programs staff can be assigned to, one at a
// time or in bulk from an Excel file of names and descriptions.
import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../toast.jsx";

export default function AdminPrograms() {
  const toast = useToast();
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState({ name: "", description: "" });
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

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

  async function bulkUpload(file) {
    if (!file) return;
    setBulkBusy(true);
    setBulkResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const result = await api("/programs/bulk/", { method: "POST", formData });
      setBulkResult(result);
      toast(`${result.created.length} created, ${result.updated.length} updated.`, "success");
      load();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBulkBusy(false);
    }
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
        <div>
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
          <div className="card">
            <h2>Bulk upload</h2>
            <p className="muted small">Upload an .xlsx file with a header row: <strong>name, description</strong> (description is optional). Existing programs are matched by name and updated rather than duplicated.</p>
            <input type="file" accept=".xlsx" disabled={bulkBusy} onChange={(e) => bulkUpload(e.target.files[0])} />
            {bulkBusy && <p className="muted small">Processing...</p>}
            {bulkResult && (
              <div className="stack small" style={{ marginTop: 12 }}>
                <div className="badge success">{bulkResult.created.length} created</div>
                <div className="badge info">{bulkResult.updated.length} updated</div>
                {bulkResult.errors.length > 0 && <div className="badge danger">{bulkResult.errors.length} errors</div>}
                {bulkResult.errors.map((e, i) => <div key={i} className="muted">Row {e.row}: {e.reason}</div>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}