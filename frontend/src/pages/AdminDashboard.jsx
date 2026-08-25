// Admin dashboard: platform snapshot plus quick links into every admin
// screen.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Icon from "../components/Icons.jsx";

const ROLE_LABEL = {
  admin: "Admins", manager: "Managers", customer_service: "Customer service",
  field_staff: "Field staff", hospital_partner: "Hospital partners", client: "Clients", family: "Family",
};

const QUICK_LINKS = [
  ["/admin/users", "Users and invites", "users", "info"],
  ["/admin/programs", "Programs", "grid", "info"],
  ["/admin/integrations", "Integrations", "plug", "info"],
  ["/admin/news", "News posts", "megaphone", "info"],
  ["/cs", "Operations dashboard", "home", "success"],
  ["/cs/queue", "Referral queue", "clipboard", "success"],
  ["/cs/schedule", "Schedule", "calendar", "success"],
  ["/cs/emergencies", "Emergencies", "alarm", "danger"],
  ["/approvals", "Approvals", "check", "warning"],
  ["/reports", "Reports", "chart", "warning"],
];

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

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    api("/auth/users/").then(setUsers).catch(() => {});
    api("/referrals/").then(setReferrals).catch(() => {});
    api("/emergencies/").then(setEmergencies).catch(() => {});
    api("/change-requests/").then(setChangeRequests).catch(() => {});
    api("/programs/").then(setPrograms).catch(() => {});
  }, []);

  const byRole = users.reduce((acc, u) => ({ ...acc, [u.role]: (acc[u.role] || 0) + 1 }), {});
  const activeReferrals = referrals.filter((r) => !["completed", "declined"].includes(r.status)).length;
  const openEmergencies = emergencies.filter((e) => e.status !== "resolved").length;
  const pendingChanges = changeRequests.filter((c) => c.status === "pending").length;

  return (
    <div>
      <h1>Admin dashboard</h1>
      <p className="sub">A snapshot of the whole platform.</p>

      <div className="grid4" style={{ margin: "16px 0" }}>
        <Kpi label="Total users" value={users.length} icon="users" tone="info" />
        <Kpi label="Active referrals" value={activeReferrals} icon="clipboard" tone="warning" />
        <Kpi label="Open emergencies" value={openEmergencies} icon="alarm" tone="danger" />
        <Kpi label="Pending approvals" value={pendingChanges} icon="check" tone="success" />
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Platform snapshot</h2>
          <div className="stack" style={{ gap: 10 }}>
            {Object.entries(ROLE_LABEL).map(([role, label]) => (
              <div key={role} className="row between">
                <span className="muted">{label}</span>
                <strong>{byRole[role] || 0}</strong>
              </div>
            ))}
            <div className="row between" style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
              <span className="muted">Programs</span>
              <strong>{programs.length}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Quick links</h2>
          <div className="quicklinks">
            {QUICK_LINKS.map(([to, label, icon, tone]) => (
              <Link key={to} to={to} className="quicklink">
                <span className={`icon-chip ${tone}`}><Icon name={icon} size={16} /></span>
                <strong>{label}</strong>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}