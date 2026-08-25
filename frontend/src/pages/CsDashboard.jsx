// Customer service dashboard: live counts plus news.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function CsDashboard() {
  const [referrals, setReferrals] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [news, setNews] = useState([]);

  useEffect(() => {
    api("/referrals/").then(setReferrals).catch(() => {});
    api("/shifts/").then(setShifts).catch(() => {});
    api("/emergencies/").then(setEmergencies).catch(() => {});
    api("/news/").then(setNews).catch(() => {});
  }, []);

  const today = new Date().toDateString();

  return (
    <div>
      <h1>Operations dashboard</h1>
      <p className="sub">Today across referrals, scheduling, and emergencies. High urgency counts referrals marked high or emergency urgency.</p>
      <div className="grid4" style={{ marginBottom: 16 }}>
        <Link to="/cs/queue" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="kpi"><div className="value">{referrals.filter((r) => r.status === "new").length}</div><div className="label">New referrals</div></div>
        </Link>
        <Link to="/cs/queue?urgency=high" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="kpi"><div className="value">{referrals.filter((r) => r.urgency === "high" || r.urgency === "emergency").length}</div><div className="label">High urgency</div></div>
        </Link>
        <Link to="/cs/schedule" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="kpi"><div className="value">{shifts.filter((s) => new Date(s.start_time).toDateString() === today).length}</div><div className="label">Shifts today</div></div>
        </Link>
        <Link to="/cs/emergencies" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="kpi"><div className="value">{emergencies.filter((e) => e.status === "new").length}</div><div className="label">Open emergencies</div></div>
        </Link>
      </div>
      {news.map((n) => (
        <div key={n.id} className="card">
          <span className="badge info">Announcement</span>
          <h2 style={{ marginTop: 8 }}>{n.title}</h2>
          <p className="small" style={{ whiteSpace: "pre-wrap" }}>{n.body}</p>
        </div>
      ))}
    </div>
  );
}
