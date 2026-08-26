// Admin: create, edit, publish, and target resources by role. audience
// works exactly like News posts: toggle roles on to restrict who sees it,
// leave every role off to reach everyone. This is what keeps a client from
// seeing an internal company policy, or field staff from seeing a resource
// meant for clients, both on the Resources page and in the AI assistant,
// since the assistant's retrieval respects the same audience field.
import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../toast.jsx";

const ROLES = ["admin", "manager", "customer_service", "field_staff", "hospital_partner", "client", "family"];
const EMPTY_FORM = { title: "", category: "", summary: "", content: "", audience: [], published: true };

export default function AdminResources() {
  const toast = useToast();
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("");

  function load() {
    api("/resources/").then(setResources).catch((e) => toast(e.message, "error"));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(resource) {
    setEditingId(resource.id);
    setForm({
      title: resource.title,
      category: resource.category,
      summary: resource.summary || "",
      content: resource.content,
      audience: resource.audience || [],
      published: resource.published,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function submit(e) {
    e.preventDefault();
    try {
      if (editingId) {
        await api(`/resources/${editingId}/`, { method: "PATCH", body: form });
        toast("Resource updated.", "success");
      } else {
        await api("/resources/", { method: "POST", body: form });
        toast("Resource created.", "success");
      }
      cancelEdit();
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function togglePublished(resource) {
    try {
      await api(`/resources/${resource.id}/`, { method: "PATCH", body: { published: !resource.published } });
      toast(resource.published ? "Unpublished." : "Published.", "success");
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function remove(resource) {
    if (!confirm(`Delete "${resource.title}" permanently?`)) return;
    try {
      await api(`/resources/${resource.id}/`, { method: "DELETE" });
      toast("Deleted.", "success");
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function toggleRole(role) {
    setForm((f) => ({
      ...f,
      audience: f.audience.includes(role) ? f.audience.filter((r) => r !== role) : [...f.audience, role],
    }));
  }

  const categories = [...new Set(resources.map((r) => r.category).filter(Boolean))];
  const visible = categoryFilter ? resources.filter((r) => r.category === categoryFilter) : resources;

  return (
    <div>
      <h1>Resources</h1>
      <p className="sub">
        The care guide library, and the AI assistant's knowledge base. Leave audience empty to reach
        everyone, or pick specific roles so clients don't see internal policy and field staff don't see
        client facing wellness guides.
      </p>

      <div className="grid2">
        <div>
          <div className="row" style={{ marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
            <button className={`pill ${!categoryFilter ? "active" : ""}`} onClick={() => setCategoryFilter("")}>All</button>
            {categories.map((c) => (
              <button key={c} className={`pill ${categoryFilter === c ? "active" : ""}`} onClick={() => setCategoryFilter(c)}>{c}</button>
            ))}
          </div>

          <div className="stack">
            {visible.map((r) => (
              <div key={r.id} className="card" style={{ marginBottom: 0 }}>
                <div className="row between">
                  <div>
                    <h2 style={{ margin: 0 }}>{r.title}</h2>
                    <span className="badge info">{r.category}</span>
                    {!r.published && <span className="badge muted">Draft</span>}
                  </div>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <button className="btn outline small" onClick={() => startEdit(r)}>Edit</button>
                    <button className="btn outline small" onClick={() => togglePublished(r)}>
                      {r.published ? "Unpublish" : "Publish"}
                    </button>
                    <button className="btn outline small" onClick={() => remove(r)}>Delete</button>
                  </div>
                </div>
                {r.summary && <p className="small muted">{r.summary}</p>}
                <div className="muted small">
                  Audience: {r.audience?.length ? r.audience.map((a) => a.replaceAll("_", " ")).join(", ") : "everyone"}
                </div>
              </div>
            ))}
            {visible.length === 0 && <div className="card muted">No resources yet. Add the first one.</div>}
          </div>
        </div>

        <div>
          <div className="card">
            <h2>{editingId ? "Edit resource" : "New resource"}</h2>
            <form onSubmit={submit}>
              <label>Title</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <label>Category</label>
              <input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Safety, Health, Family Support, Company Policy..." />
              <label>Summary (shown on the card, and to the AI assistant)</label>
              <textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
              <label>Full content</label>
              <textarea rows={8} required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Paste the full text here. There is no file upload, this needs to be plain text." />

              <label>Audience</label>
              <div className="row">
                {ROLES.map((r) => (
                  <button type="button" key={r} className={`btn small ${form.audience.includes(r) ? "" : "outline"}`} onClick={() => toggleRole(r)}>
                    {r.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
              <p className="muted small" style={{ marginTop: 4 }}>
                {form.audience.length === 0 ? "No roles selected: visible to everyone." : `Only visible to: ${form.audience.map((a) => a.replaceAll("_", " ")).join(", ")}.`}
              </p>

              <label className="row" style={{ marginTop: 10, fontWeight: 500 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
                Published
              </label>

              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn">{editingId ? "Save changes" : "Create resource"}</button>
                {editingId && <button type="button" className="btn outline" onClick={cancelEdit}>Cancel</button>}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
