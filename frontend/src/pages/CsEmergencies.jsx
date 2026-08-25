// Emergency requests board: filter tabs, source chips, acknowledge and resolve.
import { useEffect, useState } from "react";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../toast.jsx";

export default function CsEmergencies() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("all");

  function load() {
    api("/emergencies/").then(setItems).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(id, status) {
    try {
      await api(`/emergencies/${id}/`, { method: "PATCH", body: { status } });
      toast(status === "acknowledged" ? "Acknowledged." : "Resolved.", "success");
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  const visible = items.filter((e) => tab === "all" || e.source === tab);

  return (
    <div>
      <div className="row between">
        <div>
          <h1>Emergency requests</h1>
          <p className="sub">Immediate escalations from clients and field staff.</p>
        </div>
        <div className="row">
          <button className={`btn small ${tab === "all" ? "" : "outline"}`} onClick={() => setTab("all")}>All</button>
          <button className={`btn small ${tab === "client" ? "" : "outline"}`} onClick={() => setTab("client")}>Client</button>
          <button className={`btn small ${tab === "staff" ? "" : "outline"}`} onClick={() => setTab("staff")}>Staff</button>
        </div>
      </div>

      <div className="card tight">
        <table>
          <thead>
            <tr><th>Received</th><th>Source</th><th>Reported by / Client</th><th>Description</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.id}>
                <td className="muted small">{new Date(e.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td><span className={`badge ${e.source === "client" ? "danger" : "warning"}`}>{e.source === "client" ? "Client" : "Staff"}</span></td>
                <td><strong>{e.client_name || e.reporter_name || "Unknown"}</strong></td>
                <td className="small">{e.description}</td>
                <td><StatusBadge value={e.status} /></td>
                <td>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    {e.status === "new" && <button className="btn outline small" onClick={() => setStatus(e.id, "acknowledged")}>Ack</button>}
                    {e.status !== "resolved" && <button className="btn small" onClick={() => setStatus(e.id, "resolved")}>Resolve</button>}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={6} className="muted center">No emergency requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}