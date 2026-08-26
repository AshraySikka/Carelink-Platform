// Client: track every emergency they have reported, and its current status.
// Also reachable from the red Emergency request button on Home.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge.jsx";

export default function ClientEmergencies() {
  const [emergencies, setEmergencies] = useState([]);

  useEffect(() => {
    api("/emergencies/").then(setEmergencies).catch(() => {});
  }, []);

  return (
    <div>
      <div className="row between">
        <div>
          <h1>Your emergencies</h1>
          <p className="sub">Everything you have reported, and how the care team responded.</p>
        </div>
        <Link to="/care" className="btn danger" style={{ textDecoration: "none" }}>Report an emergency</Link>
      </div>

      <div className="card tight">
        <table>
          <thead><tr><th>Reported</th><th>Description</th><th>Status</th></tr></thead>
          <tbody>
            {emergencies.map((e) => (
              <tr key={e.id}>
                <td className="muted small">{new Date(e.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td>{e.description}</td>
                <td><StatusBadge value={e.status} /></td>
              </tr>
            ))}
            {emergencies.length === 0 && <tr><td colSpan={3} className="muted center">No emergencies reported.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}