// The ONE HTTP client. Every request in the app goes through here so that
// auth, timeouts, and error normalization can never drift per-page again.
import axios from "axios";
import { API_BASE_URL } from "./config";

export const TOKEN_KEY = "digix_token";
// Legacy key kept in sync until every legacy page is ported, then delete.
export const LEGACY_TOKEN_KEY = "token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || "";
}

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

api.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Cross-cutting auth failures surface as window events; the AuthProvider owns
// the UX (session-expired modal / subscription-blocked screen) — never alert().
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const detail = err.response?.data?.detail;
    // Only the session-check endpoint may declare the session dead — a stray
    // 401 from any other endpoint (replica race, transient) must not log the
    // user out. The AuthProvider additionally requires two consecutive
    // failures before showing the session-expired modal.
    if (status === 401 && getToken() && (err.config?.url || "").includes("/auth/me")) {
      window.dispatchEvent(new CustomEvent("digix:session-expired"));
    } else if (
      status === 403 &&
      typeof detail === "string" &&
      /expired|suspended|subscription|grace/i.test(detail)
    ) {
      window.dispatchEvent(new CustomEvent("digix:company-blocked", { detail }));
    }
    return Promise.reject(err);
  }
);

// ---- Normalized helpers -----------------------------------------------------
// Every caller gets {ok, status, data | message, detail} and NEVER has to
// distinguish network vs HTTP vs shape errors itself. An {ok:false} result must
// always end in a user-visible error state.

function fail(err) {
  const status = err.response?.status ?? 0;
  const detail = err.response?.data?.detail;
  const message =
    (typeof detail === "string" && detail) ||
    detail?.message ||
    err.response?.data?.message ||
    (status ? `Request failed (${status})` : "Network error — check your connection");
  return { ok: false, status, message, detail };
}

export async function apiGet(url, config) {
  try {
    const res = await api.get(url, config);
    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    return fail(err);
  }
}

export async function apiPost(url, body, config) {
  try {
    const res = await api.post(url, body, config);
    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    return fail(err);
  }
}

export async function apiPut(url, body, config) {
  try {
    const res = await api.put(url, body, config);
    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    return fail(err);
  }
}

export async function apiDelete(url, config) {
  try {
    const res = await api.delete(url, config);
    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    return fail(err);
  }
}

export async function uploadWithProgress(url, formData, onProgress) {
  try {
    const res = await api.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 0,
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    return fail(err);
  }
}

// Backend lists come as [], {items,total}, or {rows,...}; normalize once.
export function normalizeList(data, itemsKey) {
  if (Array.isArray(data)) return { items: data, total: data.length };
  if (data && Array.isArray(data[itemsKey])) {
    return { items: data[itemsKey], total: data.total ?? data[itemsKey].length };
  }
  if (data && Array.isArray(data.items)) {
    return { items: data.items, total: data.total ?? data.items.length };
  }
  return { items: [], total: 0 };
}
