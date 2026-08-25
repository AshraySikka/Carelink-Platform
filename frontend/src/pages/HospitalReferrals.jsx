// Hospital partner: their own submitted referrals with live status.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import NewsFeed from "../components/NewsFeed.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

export default function HospitalReferrals() {
  const [referrals, setReferrals] = useState([]);

  useEffect(() => {
    api("/referrals/").then(setReferrals).catch(() => {});
  }, []);

  return (
    <div>
      <div className="row between">
        <div>
          <h1>My referrals</h1>
          <p className="sub">Everything your organization has submitted, with current status.</p>
        </div>
        <Link to="/hospital/new" className="btn" style={{ textDecoration: "none" }}>New referral</Link>
      </div>

      <NewsFeed />

      <div className="card tight">
        <table>
          <thead><tr><th>Client</th><th>Urgency</th><th>Status</th><th>Assigned</th><th>Submitted</th></tr></thead>
          <tbody>
            {referrals.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.client_name}</strong><div className="muted small">{r.notes?.slice(0, 80)}</div></td>
                <td><StatusBadge value={r.urgency} /></td>
                <td><StatusBadge value={r.status} /></td>
                <td className="muted small">{r.assigned_staff_name || "Pending"}</td>
                <td className="muted small">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {referrals.length === 0 && <tr><td colSpan={5} className="muted center">No referrals yet. Submit your first one.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
