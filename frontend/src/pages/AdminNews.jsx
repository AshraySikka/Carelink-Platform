// Admin: publish, edit, and remove announcements. A platform wide cap
// (editable here, 1 to 5) limits how many published posts can target the
// same role at once, so dashboards never get flooded.
import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../toast.jsx";

const ROLES = ["admin", "manager", "customer_service", "field_staff", "hospital_partner", "client", "family"];
const EMPTY_FORM = { title: "", body: "", audience: [] };

export default function AdminNews() {
  const toast = useToast();
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [cap, setCap] = useState(3);

  function load() {
    api("/news/").then(setPosts).catch(() => {});
    api("/news-settings/").then((s) => setCap(s.news_post_cap)).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(post) {
    setEditingId(post.id);
    setForm({ title: post.title, body: post.body, audience: post.audience || [] });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function submit(e) {
    e.preventDefault();
    try {
      if (editingId) {
        await api(`/news/${editingId}/`, { method: "PATCH", body: form });
        toast("Post updated.", "success");
      } else {
        await api("/news/", { method: "POST", body: form });
        toast("Published.", "success");
      }
      cancelEdit();
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function unpublish(post) {
    try {
      await api(`/news/${post.id}/`, { method: "PATCH", body: { published: false } });
      toast("Post unpublished.", "success");
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function remove(post) {
    if (!confirm("Delete this post permanently?")) return;
    await api(`/news/${post.id}/`, { method: "DELETE" });
    load();
  }

  async function saveCap(next) {
    const clamped = Math.max(1, Math.min(5, Number(next) || 1));
    setCap(clamped);
    try {
      await api("/news-settings/", { method: "PATCH", body: { news_post_cap: clamped } });
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

  return (
    <div>
      <h1>News posts</h1>
      <p className="sub">Announcements shown on dashboards. Leave audience empty to reach everyone.</p>
      <div className="grid2">
        <div className="stack">
          {posts.map((p) => (
            <div key={p.id} className="card" style={{ marginBottom: 0 }}>
              <div className="row between">
                <h2 style={{ margin: 0 }}>{p.title}</h2>
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <button className="btn outline small" onClick={() => startEdit(p)}>Edit</button>
                  <button className="btn outline small" onClick={() => unpublish(p)}>Unpublish</button>
                  <button className="btn outline small" onClick={() => remove(p)}>Delete</button>
                </div>
              </div>
              <p className="small" style={{ whiteSpace: "pre-wrap" }}>{p.body}</p>
              <div className="muted small">Audience: {p.audience?.length ? p.audience.join(", ") : "everyone"}</div>
            </div>
          ))}
          {posts.length === 0 && <div className="card muted">No posts published yet.</div>}
        </div>
        <div>
          <div className="card">
            <h2>{editingId ? "Edit post" : "New post"}</h2>
            <form onSubmit={submit}>
              <label>Title</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <label>Body</label>
              <textarea rows={4} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              <label>Audience</label>
              <div className="row">
                {ROLES.map((r) => (
                  <button type="button" key={r} className={`btn small ${form.audience.includes(r) ? "" : "outline"}`} onClick={() => toggleRole(r)}>
                    {r.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn">{editingId ? "Save changes" : "Publish"}</button>
                {editingId && <button type="button" className="btn outline" onClick={cancelEdit}>Cancel</button>}
              </div>
            </form>
          </div>
          <div className="card">
            <h2>Post limit</h2>
            <p className="muted small">Maximum published posts that can target the same role at once (1 to 5).</p>
            <input type="number" min="1" max="5" style={{ maxWidth: 100 }} value={cap} onChange={(e) => saveCap(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}