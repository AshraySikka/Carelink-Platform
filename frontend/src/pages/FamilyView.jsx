// Family: read only view of their loved one's visits and emergencies.
import { useEffect, useState } from "react";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge.jsx";

export default function FamilyView() {
  const [shifts, setShifts] = useState([]);
  const [emergencies, setEmergencies] = useState([]);

  useEffect(() => {
    api("/shifts/").then(setShifts).catch(() => {});
    api("/emergencies/").then(setEmergencies).catch(() => {});
  }, []);

  const now = new Date();
  const upcoming = shifts.filter((s) => new Date(s.end_time) >= now);
  const recent = shifts.filter((s) => new Date(s.end_time) < now).slice(-10).reverse();

  return (
    <div>
      <h1>Care overview</h1>
      <p className="sub">A read only view of your loved one's care schedule.</p>

      {emergencies.filter((e) => e.status !== "resolved").map((e) => (
        <div key={e.id} className="card" style={{ borderColor: "var(--danger)" }}>
          <span className="badge danger">Active emergency</span>
          <p className="small">{e.description}</p>
        </div>
      ))}

      <h2>Upcoming visits</h2>
      <div className="card tight" style={{ marginBottom: 24 }}>
        <table>
          <thead><tr><th>Caregiver</th><th>When</th><th>Status</th></tr></thead>
          <tbody>
            {upcoming.map((s) => (
              <tr key={s.id}>
                <td>{s.field_staff_name}</td>
                <td className="muted small">{new Date(s.start_time).toLocaleString()}</td>
                <td><StatusBadge value={s.status} /></td>
              </tr>
            ))}
            {upcoming.length === 0 && <tr><td colSpan={3} className="muted center">No upcoming visits.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>Recent visits</h2>
      <div className="card tight">
        <table>
          <thead><tr><th>Caregiver</th><th>When</th><th>Status</th></tr></thead>
          <tbody>
            {recent.map((s) => (
              <tr key={s.id}>
                <td>{s.field_staff_name}</td>
                <td className="muted small">{new Date(s.start_time).toLocaleString()}</td>
                <td><StatusBadge value={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
