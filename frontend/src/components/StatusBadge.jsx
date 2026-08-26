// Maps every status string used across the platform to a badge color.
const KIND = {
  new: "info", scheduled: "info", invited: "info",
  accepted: "success", confirmed: "success", completed: "success", approved: "success", active: "success", resolved: "success",
  in_progress: "warning", on_hold: "warning", pending: "warning", change_requested: "warning", acknowledged: "warning", high: "warning",
  approved_pending_change: "warning",
  declined: "danger", emergency: "danger", deactivated: "danger", cancelled: "danger",
  low: "muted", normal: "muted",
};

// A few statuses read better with custom wording than a literal underscore
// to space swap of their raw value.
const LABEL = {
  approved_pending_change: "Approved, pending change",
};

export default function StatusBadge({ value }) {
  if (!value) return null;
  const label = LABEL[value] || String(value).replaceAll("_", " ");
  return <span className={`badge ${KIND[value] || "muted"}`}>{label}</span>;
}
