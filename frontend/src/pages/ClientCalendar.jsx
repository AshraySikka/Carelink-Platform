// Client calendar: month grid of visits. Clicking a day with a visit opens
// its details, with buttons to message the caregiver or request a change.
import { useEffect, useState } from "react";
import { api } from "../api";
import Icon from "../components/Icons.jsx";
import Modal from "../components/Modal.jsx";
import RequestChangeModal from "../components/RequestChangeModal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../toast.jsx";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export default function ClientCalendar() {
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [activeDay, setActiveDay] = useState(null); // Date object
  const [changeFor, setChangeFor] = useState(null);
  const [chatBusy, setChatBusy] = useState(false);

  function load() {
    api("/shifts/").then(setShifts).catch(() => {});
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + i);
    return d;
  });

  const byDate = {};
  for (const s of shifts) {
    const key = new Date(s.start_time).toDateString();
    (byDate[key] = byDate[key] || []).push(s);
  }

  const rangeLabel = `${days[0].toLocaleDateString([], { month: "short", day: "numeric" })} - ${days[27].toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
  const activeShifts = activeDay ? byDate[activeDay.toDateString()] || [] : [];

  async function chatWithCaregiver(staffId, staffName) {
    setChatBusy(true);
    try {
      const data = await api("/messaging/conversations/", { method: "POST", body: { user_id: staffId } });
      window.dispatchEvent(new CustomEvent("carelink:open-thread", { detail: { conversationId: data.id, otherUser: { full_name: staffName } } }));
      setActiveDay(null);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <div>
      <h1>Your calendar</h1>
      <p className="sub">Click any day to see visits scheduled.</p>

      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="row">
          <button className="btn outline small" onClick={() => setAnchor((a) => { const d = new Date(a); d.setDate(d.getDate() - 28); return d; })}>{"\u2039"}</button>
          <button className="btn outline small" onClick={() => setAnchor((a) => { const d = new Date(a); d.setDate(d.getDate() + 28); return d; })}>{"\u203A"}</button>
          <button className="btn outline small" onClick={() => setAnchor(startOfWeek(new Date()))}>Today</button>
        </div>
        <div className="muted">{rangeLabel}</div>
      </div>

      <div className="cal-grid">
        {WEEKDAYS.map((d) => <div key={d} className="cal-headcell muted small">{d}</div>)}
        {days.map((d) => {
          const items = byDate[d.toDateString()] || [];
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div key={d.toISOString()} className={`cal-cell ${isToday ? "cal-today" : ""}`}
              style={{ cursor: items.length ? "pointer" : "default" }}
              onClick={() => items.length && setActiveDay(d)}>
              <div className="cal-daynum">{d.getDate()}</div>
              {items.map((s) => (
                <div key={s.id} className="cal-shift cal-scheduled">
                  <div>{new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  <div>{s.field_staff_name}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {activeDay && (
        <Modal title={activeDay.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })} onClose={() => setActiveDay(null)}>
          {activeShifts.map((s) => (
            <div key={s.id} className="day-visit">
              <div className="row between">
                <strong>{new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
                <StatusBadge value={s.status} />
              </div>
              <div className="meta"><Icon name="person" size={15} /> {s.field_staff_name}</div>
              {s.location && <div className="meta"><Icon name="pin" size={15} /> {s.location}</div>}
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn outline small" disabled={chatBusy} onClick={() => chatWithCaregiver(s.field_staff, s.field_staff_name)}>Message caregiver</button>
                {s.status !== "change_requested" && new Date(s.end_time) >= new Date() && (
                  <button className="btn outline small" onClick={() => { setChangeFor(s); setActiveDay(null); }}>Request change</button>
                )}
              </div>
            </div>
          ))}
        </Modal>
      )}

      {changeFor && <RequestChangeModal shift={changeFor} onClose={() => setChangeFor(null)} onSent={load} />}
    </div>
  );
}