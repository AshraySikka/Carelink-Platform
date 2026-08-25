// The bell in the sidebar header: unread count, dropdown feed, live updates
// over the WebSocket stream.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";

export default function NotificationsBell() {
  const { subscribe } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  function load() {
    api("/notifications/").then(setItems).catch(() => {});
  }

  useEffect(() => {
    load();
    // Live: prepend new notifications the moment the backend pushes them.
    return subscribe((event) => {
      if (event.kind === "notification") {
        setItems((all) => [{ ...event, read: false }, ...all]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unread = items.filter((n) => !n.read).length;

  function openPanel() {
    setOpen(!open);
    if (!open && unread) {
      api("/notifications/mark-read/", { method: "POST", body: {} }).then(() =>
        setItems((all) => all.map((n) => ({ ...n, read: true })))
      );
    }
  }

  return (
    <div className="bell-wrap">
      <button className="bell-btn" onClick={openPanel} aria-label="Notifications">
        {"\u{1F514}"}
        {unread > 0 && <span className="bell-dot">{unread}</span>}
      </button>
      {open && (
        <div className="bell-panel">
          {items.length === 0 && <div className="bell-item muted">No notifications yet.</div>}
          {items.slice(0, 30).map((n) => (
            <div
              key={n.id}
              className={`bell-item ${n.read ? "" : "unread"}`}
              style={{ cursor: n.link ? "pointer" : "default" }}
              onClick={() => { if (n.link) { setOpen(false); navigate(n.link); } }}
            >
              <div style={{ fontWeight: 600 }}>{n.title}</div>
              {n.body && <div className="muted">{n.body}</div>}
              <div className="muted" style={{ fontSize: "0.75rem", marginTop: 2 }}>{n.category}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
