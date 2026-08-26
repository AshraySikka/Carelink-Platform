// Signed in shell: role aware sidebar with icons, notifications bell, and
// one unified chat bubble (AI assistant + real messaging in one panel).
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import ChatBubble from "./ChatBubble.jsx";
import Icon from "./Icons.jsx";
import NotificationsBell from "./NotificationsBell.jsx";

// Each role sees only its own navigation. Third item is the icon name.
const NAV = {
  admin: [
    ["/admin", "Dashboard", "home"],
    ["/admin/users", "Users and invites", "users"],
    ["/admin/programs", "Programs", "grid"],
    ["/admin/integrations", "Integrations", "plug"],
    ["/admin/news", "News posts", "megaphone"],
    ["/admin/resources", "Resources", "book"],
    ["/cs", "Operations dashboard", "home"],
    ["/cs/queue", "Referral queue", "clipboard"],
    ["/cs/schedule", "Schedule", "calendar"],
    ["/cs/emergencies", "Emergencies", "alarm"],
    ["/approvals", "Approvals", "check"],
    ["/cs/change-requests", "Change requests", "check"],
    ["/reports", "Reports", "chart"],
    ["/messages", "Messages", "chat"],
    ["/ai-search", "AI search", "sparkles"],
    ["/settings", "Settings", "gear"],
  ],
  manager: [
    ["/manager", "Manager dashboard", "home"],
    ["/cs/queue", "Referral queue", "clipboard"],
    ["/approvals", "Approvals", "check"],
    ["/cs/change-requests", "Change requests", "check"],
    ["/cs/schedule", "Team schedule", "calendar"],
    ["/reports", "Reports", "chart"],
    ["/messages", "Messages", "chat"],
    ["/ai-search", "AI search", "sparkles"],
    ["/settings", "Settings", "gear"],
  ],
  customer_service: [
    ["/cs", "Dashboard", "home"],
    ["/cs/queue", "Referral queue", "clipboard"],
    ["/cs/schedule", "Schedule", "calendar"],
    ["/cs/change-requests", "Change requests", "check"],
    ["/cs/emergencies", "Emergencies", "alarm"],
    ["/messages", "Messages", "chat"],
    ["/ai-search", "AI search", "sparkles"],
    ["/resources", "Resources", "book"],
    ["/settings", "Settings", "gear"],
  ],
  hospital_partner: [
    ["/hospital", "My referrals", "clipboard"],
    ["/hospital/new", "New referral", "plus"],
    ["/messages", "Messages", "chat"],
    ["/ai-search", "AI search", "sparkles"],
    ["/settings", "Settings", "gear"],
  ],
  field_staff: [
    ["/field", "My schedule", "calendar"],
    ["/messages", "Messages", "chat"],
    ["/resources", "Resources", "book"],
    ["/ai-search", "AI search", "sparkles"],
    ["/settings", "Settings", "gear"],
  ],
  client: [
    ["/care", "Home", "heart"],
    ["/care/calendar", "Calendar", "calendar"],
    ["/care/emergencies", "Emergencies", "alarm"],
    ["/resources", "Resources", "book"],
    ["/ai-search", "AI search", "sparkles"],
    ["/care/family", "Family access", "users"],
    ["/messages", "Messages", "chat"],
    ["/settings", "Settings", "gear"],
  ],
  family: [
    ["/family", "Care overview", "heart"],
    ["/resources", "Resources", "book"],
    ["/settings", "Settings", "gear"],
  ],
};

const ROLE_LABEL = {
  admin: "Administrator", manager: "Manager", customer_service: "Customer Service",
  hospital_partner: "Hospital Partner", field_staff: "Field Staff", client: "Client", family: "Family",
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const links = NAV[user.role] || [];
  const onMessagesPage = location.pathname.startsWith("/messages");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="/favicon.svg" alt="CareLink" />
          <div>
            <div className="brand-name">CareLink</div>
            <div className="brand-role">{ROLE_LABEL[user.role]}</div>
          </div>
        </div>
        <nav className="nav">
          {links.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon name={icon} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="row between">
            <div className="who">{user.full_name}<br />{user.email}</div>
            <NotificationsBell />
          </div>
          <button className="btn outline small" onClick={() => { logout(); navigate("/login"); }}>Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
      {/* Hidden on the Messages page itself so it doesn't float over the
          full page version of the same conversations. */}
      {!onMessagesPage && <ChatBubble />}
    </div>
  );
}