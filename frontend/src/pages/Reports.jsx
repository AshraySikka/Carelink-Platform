// Reports: pick a report, filter it, preview the results in a table, and
// download the same data as an Excel file. Available to admins (every
// report) and managers (scoped to their own team).
import { useEffect, useState } from "react";
import { API_URL, api, getToken } from "../api";
import { useToast } from "../toast.jsx";

export default function Reports() {
  const toast = useToast();
  const [catalog, setCatalog] = useState({ reports: [], staff: [] });
  const [type, setType] = useState("");
  const [filters, setFilters] = useState({ start: "", end: "", staff: "", status: "" });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api("/reports/catalog/").then((data) => {
      setCatalog(data);
      if (data.reports.length) setType(data.reports[0].key);
    }).catch((e) => toast(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = catalog.reports.find((r) => r.key === type);

  function buildQuery() {
    const params = new URLSearchParams({ type });
    if (filters.start) params.set("start", filters.start);
    if (filters.end) params.set("end", filters.end);
    if (active?.staff_filter && filters.staff) params.set("staff", filters.staff);
    if (active?.status_options?.length && filters.status) params.set("status", filters.status);
    return params;
  }

  async function run() {
    setBusy(true);
    try {
      const data = await api(`/reports/run/?${buildQuery()}`);
      setResult(data);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      const response = await fetch(`${API_URL}/api/reports/export/?${buildQuery()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) throw new Error("Could not generate the file.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <h1>Reports</h1>
      <p className="sub">Filter, preview, and export platform activity as Excel.</p>

      <div className="card">
        <div className="grid4">
          <div>
            <label>Report</label>
            <select value={type} onChange={(e) => { setType(e.target.value); setResult(null); }}>
              {catalog.reports.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label>From</label>
            <input type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
          </div>
          {active?.staff_filter && (
            <div>
              <label>Staff</label>
              <select value={filters.staff} onChange={(e) => setFilters({ ...filters, staff: e.target.value })}>
                <option value="">Everyone</option>
                {catalog.staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
          )}
          {active?.status_options?.length > 0 && (
            <div>
              <label>Status</label>
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">Any</option>
                {active.status_options.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={run} disabled={busy || !type}>{busy ? "Running..." : "Run report"}</button>
          {result && <button className="btn outline" onClick={download} disabled={downloading}>{downloading ? "Preparing..." : "Download Excel"}</button>}
        </div>
      </div>

      {result && (
        <div className="card tight">
          {result.rows.length === 0 ? (
            <div className="muted center" style={{ padding: 20 }}>No data matches these filters.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead><tr>{result.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i}>{row.map((cell, j) => <td key={j}>{cell === null || cell === undefined || cell === "" ? "-" : String(cell)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}