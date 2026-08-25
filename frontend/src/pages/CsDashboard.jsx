// Customer service dashboard: news up top, KPI tiles with icons, then
// preview panels for the four things that need attention, each linking
// straight to the page that handles it.
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

export default function CsDashboard() {
  const [referrals, setReferrals] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);

  useEffect(() => {
    api("/referrals/").then(setReferrals).catch(() => {});
    api("/shifts/").then(setShifts).catch(() => {});
    api("/emergencies/").then(setEmergencies).catch(() => {});
    api("/change-requests/").then(setChangeRequests).catch(() => {});
  }, []);

  const today = new Date().toDateString();
  const openEmergencies = emergencies.filter((e) => e.status !== "resolved");
  const flagged = referrals.filter((r) => r.concerns_flag);
  const pendingChanges = changeRequests.filter((c) => c.status === "pending");
  const latestReferrals = [...referrals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  return (
    <div>
      <h1>Customer service dashboard</h1>
      <p className="sub">Everything active across referrals, schedules, and emergencies.</p>

      <NewsFeed />

      <div className="grid4" style={{ margin: "16px 0" }}>
        <Kpi label="New referrals" value={referrals.filter((r) => r.status === "new").length} icon="inbox" tone="info" />
        <Kpi label="Urgent / Emergency" value={referrals.filter((r) => r.urgency === "high" || r.urgency === "emergency").length} icon="alertCircle" tone="warning" />
        <Kpi label="Open emergencies" value={openEmergencies.length} icon="alarm" tone="danger" />
        <Kpi label="Shifts today" value={shifts.filter((s) => new Date(s.start_time).toDateString() === today).length} icon="calendar" tone="success" />
      </div>

      <div className="grid2">
        <PreviewPanel title="Latest referrals" linkTo="/cs/queue" linkLabel="Open queue" empty="No referrals yet.">
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
        <PreviewPanel title="Open emergencies" linkTo="/cs/emergencies" linkLabel="Handle" empty="No open emergencies.">
          {openEmergencies.slice(0, 5).map((e) => (
            <div key={e.id} className="preview-row flag">
              <strong>{e.description}</strong>
              <div className="muted small">{e.source === "client" ? "Client" : "Staff report"} {"\u00b7"} {new Date(e.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          ))}
        </PreviewPanel>

        <PreviewPanel title="Change requests" linkTo="/approvals" linkLabel="Review" empty="No pending change requests.">
          {pendingChanges.slice(0, 5).map((c) => (
            <div key={c.id} className="preview-row">
              <strong>{c.requested_by_name}</strong>
              <div className="muted small">{c.reason}</div>
            </div>
          ))}
        </PreviewPanel>
      </div>
    </div>
  );
}