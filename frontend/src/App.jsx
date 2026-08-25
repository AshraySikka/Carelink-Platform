// Route table. Layout wraps every signed in page and enforces role access.
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { homePathFor, useAuth } from "./auth.jsx";
import Login from "./pages/Login.jsx";
import SetPassword from "./pages/SetPassword.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import AdminPrograms from "./pages/AdminPrograms.jsx";
import AdminIntegrations from "./pages/AdminIntegrations.jsx";
import AdminNews from "./pages/AdminNews.jsx";
import CsDashboard from "./pages/CsDashboard.jsx";
import CsQueue from "./pages/CsQueue.jsx";
import CsSchedule from "./pages/CsSchedule.jsx";
import CsEmergencies from "./pages/CsEmergencies.jsx";
import HospitalReferrals from "./pages/HospitalReferrals.jsx";
import HospitalNew from "./pages/HospitalNew.jsx";
import FieldSchedule from "./pages/FieldSchedule.jsx";
import ClientHome from "./pages/ClientHome.jsx";
import ClientFamily from "./pages/ClientFamily.jsx";
import Resources from "./pages/Resources.jsx";
import AiSearch from "./pages/AiSearch.jsx";
import FamilyView from "./pages/FamilyView.jsx";
import ManagerApprovals from "./pages/ManagerApprovals.jsx";
import Messages from "./pages/Messages.jsx";
import Settings from "./pages/Settings.jsx";

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-wrap"><div className="muted">Loading CareLink...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/set-password" element={<SetPassword />} />

      <Route path="/admin" element={<Protected roles={["admin"]}><AdminUsers /></Protected>} />
      <Route path="/admin/programs" element={<Protected roles={["admin"]}><AdminPrograms /></Protected>} />
      <Route path="/admin/integrations" element={<Protected roles={["admin"]}><AdminIntegrations /></Protected>} />
      <Route path="/admin/news" element={<Protected roles={["admin"]}><AdminNews /></Protected>} />

      <Route path="/cs" element={<Protected roles={["admin", "customer_service", "manager"]}><CsDashboard /></Protected>} />
      <Route path="/cs/queue" element={<Protected roles={["admin", "customer_service", "manager"]}><CsQueue /></Protected>} />
      <Route path="/cs/schedule" element={<Protected roles={["admin", "customer_service", "manager"]}><CsSchedule /></Protected>} />
      <Route path="/cs/emergencies" element={<Protected roles={["admin", "customer_service", "manager"]}><CsEmergencies /></Protected>} />

      <Route path="/hospital" element={<Protected roles={["hospital_partner"]}><HospitalReferrals /></Protected>} />
      <Route path="/hospital/new" element={<Protected roles={["hospital_partner"]}><HospitalNew /></Protected>} />

      <Route path="/field" element={<Protected roles={["field_staff"]}><FieldSchedule /></Protected>} />

      <Route path="/care" element={<Protected roles={["client"]}><ClientHome /></Protected>} />
      <Route path="/care/family" element={<Protected roles={["client"]}><ClientFamily /></Protected>} />

      <Route path="/family" element={<Protected roles={["family"]}><FamilyView /></Protected>} />

      <Route path="/approvals" element={<Protected roles={["manager", "admin"]}><ManagerApprovals /></Protected>} />

      <Route path="/resources" element={<Protected><Resources /></Protected>} />
      <Route path="/ai-search" element={<Protected><AiSearch /></Protected>} />
      <Route path="/messages" element={<Protected><Messages /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />

      <Route path="*" element={<Navigate to={user ? homePathFor(user.role) : "/login"} replace />} />
    </Routes>
  );
}
