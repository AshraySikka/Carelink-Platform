// Care resource library, readable by every role. Also feeds the AI assistant.
import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal.jsx";

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [openItem, setOpenItem] = useState(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api("/resources/").then(setResources).catch(() => {});
  }, []);

  const categories = [...new Set(resources.map((r) => r.category))];
  const visible = filter ? resources.filter((r) => r.category === filter) : resources;

  return (
    <div>
      <h1>Resources</h1>
      <p className="sub">Care guides and reference material.</p>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className={`btn small ${filter ? "outline" : ""}`} onClick={() => setFilter("")}>All</button>
        {categories.map((c) => (
          <button key={c} className={`btn small ${filter === c ? "" : "outline"}`} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>
      <div className="grid2">
        {visible.map((r) => (
          <div key={r.id} className="card" style={{ cursor: "pointer", marginBottom: 0 }} onClick={() => setOpenItem(r)}>
            <span className="badge info">{r.category}</span>
            <h2 style={{ marginTop: 8 }}>{r.title}</h2>
            <p className="muted small">{r.summary}</p>
          </div>
        ))}
      </div>
      {openItem && (
        <Modal title={openItem.title} onClose={() => setOpenItem(null)}>
          <span className="badge info">{openItem.category}</span>
          <p style={{ whiteSpace: "pre-wrap" }}>{openItem.content}</p>
        </Modal>
      )}
    </div>
  );
}
