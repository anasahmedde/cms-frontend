import axios from "axios";

/**
 * API configuration
 */
const DEFAULT_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8005`;

export const api = axios.create({
  baseURL: DEFAULT_BASE,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Optional auth support
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function unwrapAxiosError(err) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const message =
    data?.detail ||
    data?.message ||
    err?.message ||
    "Request failed (unknown error)";
  return { status, data, message, raw: err };
}

export async function safeGet(url, params) {
  try {
    const res = await api.get(url, { params });
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, ...unwrapAxiosError(err) };
  }
}

export async function safePost(url, body) {
  try {
    const res = await api.post(url, body);
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, ...unwrapAxiosError(err) };
  }
}

export async function safePut(url, body) {
  try {
    const res = await api.put(url, body);
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, ...unwrapAxiosError(err) };
  }
}

export async function safeDelete(url) {
  try {
    const res = await api.delete(url);
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, ...unwrapAxiosError(err) };
  }
}

/**
 * Fallback POST: tries paths in order until one works
 */
export async function safePostFallback(paths, body) {
  let last = null;

  for (const p of paths) {
    const r = await safePost(p, body);
    if (r.ok) return r;

    if ([404, 405].includes(r.status)) {
      last = r;
      continue;
    }

    return r;
  }

  return (
    last || {
      ok: false,
      status: 0,
      message: "All fallback POST endpoints failed",
    }
  );
}

/**
 * Normalizes list responses into { items, total }
 */
export function normalizeList(payload) {
  const data = payload ?? {};
  const items =
    Array.isArray(data) ? data : data.items || data.data || data.results || [];
  const total = data.total ?? data.count ?? (Array.isArray(items) ? items.length : 0);
  return { items: Array.isArray(items) ? items : [], total };
}

/**
 * Upload file with progress callback
 */
export async function uploadWithProgress(url, formData, onProgress) {
  try {
    const res = await api.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, ...unwrapAxiosError(err) };
  }
}

/**
 * OLD PATTERN SUPPORT - httpFactory function for dvsg.js compatibility
 * Creates an axios-like instance with custom baseURL
 */
export function httpFactory({ baseURL } = {}) {
  const instance = axios.create({
    baseURL: baseURL || DEFAULT_BASE,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Add auth interceptor
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  return instance;
}
