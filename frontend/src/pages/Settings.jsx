// Profile details plus the notification settings panel with toggle switches.
import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";

const ROLE_LABEL = {
  admin: "Admin", manager: "Manager", customer_service: "Customer Service",
  hospital_partner: "Hospital Partner", field_staff: "Field Staff", client: "Client", family: "Family",
};

const CATEGORY_HINTS = {
  messages: "New direct messages sent to you.",
  referrals: "New referrals and status updates.",
  schedule: "Shifts created, changed, or cancelled.",
  approvals: "Shift change requests and decisions.",
  emergencies: "Emergency alerts from clients and staff.",
  news: "Announcements published by administrators.",
};

export default function Settings() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState({ full_name: user.full_name || "", phone: user.phone || "", address: user.address || "" });
  const [prefs, setPrefs] = useState([]);

  useEffect(() => {
    api("/notifications/preferences/").then(setPrefs).catch(() => {});
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    try {
      const updated = await api("/auth/me/", { method: "PATCH", body: profile });
      setUser(updated);
      toast("Profile saved.", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function togglePref(category, enabled) {
    // Optimistic toggle so the switch feels instant.
    setPrefs((all) => all.map((p) => (p.category === category ? { ...p, enabled } : p)));
    try {
      await api("/notifications/preferences/", { method: "PATCH", body: { [category]: enabled } });
    } catch (error) {
      toast(error.message, "error");
    }
  }

  return (
    <div>
      <h1>Your profile</h1>
      <p className="sub">Contact details and notification preferences.</p>

      <div className="card" style={{ maxWidth: 640 }}>
        <form onSubmit={saveProfile}>
          <div className="grid2">
            <div>
              <label>Email</label>
              <input value={user.email} disabled />
            </div>
            <div>
              <label>Role</label>
              <input value={ROLE_LABEL[user.role] || user.role} disabled />
            </div>
            <div>
              <label>Full name</label>
              <input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            </div>
            <div>
              <label>Phone</label>
              <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
          </div>
          <label>Address</label>
          <input value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
          <button className="btn" style={{ marginTop: 16 }}>Save changes</button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <h2>Notifications</h2>
        <p className="muted small">Turn each category on or off. Muted categories stop appearing in your bell and live alerts.</p>
        <div className="stack" style={{ gap: 16 }}>
          {prefs.map((p) => (
            <div key={p.category} className="row between">
              <div>
                <div style={{ fontWeight: 600 }}>{p.label}</div>
                <div className="muted small">{CATEGORY_HINTS[p.category] || ""}</div>
              </div>
              <label className="switch">
                <input type="checkbox" checked={p.enabled} onChange={(e) => togglePref(p.category, e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}