// Maps every status string used across the platform to a badge color.
const KIND = {
  new: "info", scheduled: "info", invited: "info",
  accepted: "success", confirmed: "success", completed: "success", approved: "success", active: "success", resolved: "success",
  in_progress: "warning", on_hold: "warning", pending: "warning", change_requested: "warning", acknowledged: "warning", high: "warning",
  declined: "danger", emergency: "danger", deactivated: "danger",
  low: "muted", normal: "muted",
};

export default function StatusBadge({ value }) {
  if (!value) return null;
  const label = String(value).replaceAll("_", " ");
  return <span className={`badge ${KIND[value] || "muted"}`}>{label}</span>;
}
