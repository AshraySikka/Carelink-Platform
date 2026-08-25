// Small fetch wrapper. Attaches the JWT, parses JSON, and surfaces backend
// error messages so pages can show them in toasts.

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

export function getToken() {
  return localStorage.getItem("carelink_access") || "";
}

export function setTokens(access, refresh) {
  localStorage.setItem("carelink_access", access);
  if (refresh) localStorage.setItem("carelink_refresh", refresh);
}

export function clearTokens() {
  localStorage.removeItem("carelink_access");
  localStorage.removeItem("carelink_refresh");
}

export async function api(path, { method = "GET", body, formData } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (formData) {
    payload = formData; // Browser sets the multipart boundary itself.
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${API_URL}/api${path}`, { method, headers, body: payload });
  if (response.status === 204) return null;
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non JSON responses fall through with data null.
  }
  if (!response.ok) {
    const detail = data && (data.detail || Object.values(data)[0]);
    throw new Error(Array.isArray(detail) ? detail[0] : detail || `Request failed (${response.status})`);
  }
  return data;
}
