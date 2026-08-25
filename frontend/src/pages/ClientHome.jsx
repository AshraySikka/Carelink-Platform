// Client home: news up top, upcoming visits, and the emergency button.
import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal.jsx";
import NewsFeed from "../components/NewsFeed.jsx";
import RequestChangeModal from "../components/RequestChangeModal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../toast.jsx";

export default function ClientHome() {
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [changeFor, setChangeFor] = useState(null);

  function load() {
    api("/shifts/").then(setShifts).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendEmergency(e) {
    e.preventDefault();
    try {
      await api("/emergencies/", { method: "POST", body: { description } });
      toast("Emergency request sent. The care team has been alerted. If this is life threatening, call 911.", "success");
      setEmergencyOpen(false);
      setDescription("");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  const now = new Date();
  const upcoming = shifts.filter((s) => new Date(s.end_time) >= now).slice(0, 8);

  return (
    <div>
      <div className="row between">
        <div>
          <h1>Your care</h1>
          <p className="sub">Upcoming visits and updates from your care team.</p>
        </div>
        <button className="btn danger" onClick={() => setEmergencyOpen(true)}>Emergency request</button>
      </div>

      <NewsFeed />

      <h2 style={{ marginTop: 20 }}>Upcoming visits</h2>
      <div className="stack" style={{ marginBottom: 24 }}>
        {upcoming.map((s) => (
          <div key={s.id} className="card" style={{ marginBottom: 0 }}>
            <div className="row between">
              <div>
                <strong>{s.field_staff_name}</strong> <StatusBadge value={s.status} />
                {s.on_my_way_at && !s.clock_in_at && <span className="badge success">On the way</span>}
                <div className="small">{new Date(s.start_time).toLocaleString()} to {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              {s.status !== "change_requested" && (
                <button className="btn outline small" onClick={() => setChangeFor(s)}>Request change</button>
              )}
            </div>
          </div>
        ))}
        {upcoming.length === 0 && <div className="card muted">No upcoming visits scheduled.</div>}
      </div>

      {emergencyOpen && (
        <Modal title="Emergency request" onClose={() => setEmergencyOpen(false)}>
          <p className="small" style={{ background: "var(--danger-soft)", padding: 10, borderRadius: 8 }}>
            If this is a life threatening emergency, call 911 first. This button alerts your CareLink care team.
          </p>
          <form onSubmit={sendEmergency}>
            <label>What is happening?</label>
            <textarea rows={4} required value={description} onChange={(e) => setDescription(e.target.value)} />
            <button className="btn danger" style={{ marginTop: 14 }}>Send alert</button>
          </form>
        </Modal>
      )}

      {changeFor && <RequestChangeModal shift={changeFor} onClose={() => setChangeFor(null)} onSent={load} />}
    </div>
  );
}