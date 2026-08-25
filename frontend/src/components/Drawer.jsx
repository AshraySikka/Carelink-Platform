// Right side slide over panel, used for referral details.
export default function Drawer({ title, onClose, children, footer }) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: "1.3rem" }}>{title}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer}
      </aside>
    </div>
  );
}