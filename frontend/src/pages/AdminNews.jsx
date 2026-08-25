// Admin: publish announcements, optionally targeted at specific roles.
import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../toast.jsx";

const ROLES = ["admin", "manager", "customer_service", "field_staff", "hospital_partner", "client", "family"];

export default function AdminNews() {
  const toast = useToast();
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState({ title: "", body: "", audience: [] });

  function load() {
    api("/news/").then(setPosts).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function publish(e) {
    e.preventDefault();
    try {
      await api("/news/", { method: "POST", body: form });
      setForm({ title: "", body: "", audience: [] });
      toast("Published.", "success");
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

  return (
    <div>
      <h1>News posts</h1>
      <p className="sub">Announcements shown on dashboards. Leave audience empty to reach everyone.</p>
      <div className="grid2">
        <div className="stack">
          {posts.map((p) => (
            <div key={p.id} className="card" style={{ marginBottom: 0 }}>
              <h2>{p.title}</h2>
              <p className="small" style={{ whiteSpace: "pre-wrap" }}>{p.body}</p>
              <div className="muted small">Audience: {p.audience?.length ? p.audience.join(", ") : "everyone"}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>New post</h2>
          <form onSubmit={publish}>
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
            <button className="btn" style={{ marginTop: 14 }}>Publish</button>
          </form>
        </div>
      </div>
    </div>
  );
}
