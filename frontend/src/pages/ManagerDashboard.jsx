// Manager dashboard: same shape as the CS dashboard, but scoped to only the
// programs assigned to this manager. Referrals, shifts, and emergencies are
// all filtered down to field staff in those programs by the backend, so
// nothing platform wide leaks in here.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Icon from "../components/Icons.jsx";
import NewsFeed from "../components/NewsFeed.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

function Kpi({ label, value, icon, tone }) {
  return (
    <div className="kpi2">
      <div className="row between">
        <span className="label">{label}</span>
        <span className={`icon-chip ${tone}`}><Icon name={icon} /></span>
      </div>
      <div className="value">{value}</div>
    </div>
  );
}

function PreviewPanel({ title, linkTo, linkLabel, children, empty }) {
  return (
    <div className="card preview-panel">
      <div className="row between head">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <Link to={linkTo}>{linkLabel} {"\u2192"}</Link>
      </div>
      {children.length === 0 || children === null ? <div className="muted">{empty}</div> : children}
    </div>
  );
}

export default function ManagerDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api("/manager/dashboard/").then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="muted">Loading...</div>;

  const { programs, staff_count, referrals, shifts, emergencies, change_requests } = data;
  const today = new Date().toDateString();
  const openEmergencies = emergencies.filter((e) => e.status !== "resolved");
  const flagged = referrals.filter((r) => r.concerns_flag);
  const latestReferrals = [...referrals].slice(0, 5);
  const pendingChanges = change_requests.filter((c) => c.status === "pending");

  return (
    <div>
      <h1>Manager dashboard</h1>
      <p className="sub">
        {programs.length > 0
          ? `Scoped to your programs: ${programs.map((p) => p.name).join(", ")}.`
          : "No programs are assigned to you yet. Ask an administrator to assign your programs from the Users screen."}
      </p>

      <NewsFeed />

      <div className="grid4" style={{ margin: "16px 0" }}>
        <Kpi label="Your field staff" value={staff_count} icon="users" tone="info" />
        <Kpi label="Urgent / Emergency" value={referrals.filter((r) => r.urgency === "high" || r.urgency === "emergency").length} icon="alertCircle" tone="warning" />
        <Kpi label="Total emergencies" value={openEmergencies.length} icon="alarm" tone="danger" />
        <Kpi label="Shifts today" value={shifts.filter((s) => new Date(s.start_time).toDateString() === today).length} icon="calendar" tone="success" />
      </div>

      <div className="grid2">
        <PreviewPanel title="Latest referrals" linkTo="/cs/queue" linkLabel="Open queue" empty="No referrals assigned to your team yet.">
          {latestReferrals.map((r) => (
            <Link key={r.id} to="/cs/queue" className="preview-row" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <div className="row between">
                <strong>{r.client_name}</strong>
                <StatusBadge value={r.status} />
              </div>
              <div className="muted small">{new Date(r.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
            </Link>
          ))}
        </PreviewPanel>

        <PreviewPanel title="Flagged concerns" linkTo="/cs/queue" linkLabel="Review" empty="No flagged concerns right now.">
          {flagged.map((r) => (
            <div key={r.id} className="preview-row flag">
              <strong>{r.client_name}</strong>
              <div className="muted small">{r.concerns_flag}</div>
            </div>
          ))}
        </PreviewPanel>
      </div>

      <div className="grid2">
        <PreviewPanel title="All emergencies" linkTo="/cs/emergencies" linkLabel="Handle" empty="No emergencies for your team's clients.">
          {openEmergencies.slice(0, 5).map((e) => (
            <div key={e.id} className="preview-row flag">
              <strong>{e.description}</strong>
              <div className="muted small">{e.source === "client" ? "Client" : "Staff report"} {"\u00b7"} {new Date(e.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          ))}
        </PreviewPanel>

        <PreviewPanel title="Your approvals queue" linkTo="/approvals" linkLabel="Review" empty="Nothing waiting on you.">
          {pendingChanges.map((c) => (
            <Link key={c.id} to="/approvals" className="preview-row" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <div className="row between">
                <strong>{c.requested_by_name}</strong>
                <StatusBadge value={c.status} />
              </div>
              <div className="muted small">{c.reason}</div>
            </Link>
          ))}
        </PreviewPanel>
      </div>
    </div>
  );
}
