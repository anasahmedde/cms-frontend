// src/api/group.js
import axios from "axios";

// Group API - unified on port 8005
const BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8005`;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Auth interceptor for company users
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("digix_token") || localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function normalizeList(payload) {
  const data = payload ?? {};
  const items = Array.isArray(data) ? data : data.items || data.data || data.results || [];
  const total = data.total ?? data.count ?? items.length;
  return { items, total };
}

function toPosInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

function toNonNegInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i >= 0 ? i : fallback;
}

export async function listGroups(limit = 100, offset = 0) {
  try {
    const safeLimit = toPosInt(limit, 100);
    const safeOffset = toNonNegInt(offset, 0);

    const res = await api.get("/groups", { params: { limit: safeLimit, offset: safeOffset } });
    const { items, total } = normalizeList(res.data);
    return { ok: true, items, total };
  } catch (err) {
    console.error("listGroups error:", err);
    return { ok: false, items: [], total: 0, error: err.message };
  }
}

// Returns array of group names (for dropdowns)
export async function listGroupNames(limit = 100, offset = 0) {
  try {
    const res = await listGroups(limit, offset);
    return (res.items || []).map((g) => g.gname || g.name || g).filter(Boolean);
  } catch (err) {
    console.error("listGroupNames error:", err);
    return [];
  }
}

// INSERT - Create new group (backend uses /insert_group endpoint)
export async function insertGroup(groupData) {
  try {
    const res = await api.post("/insert_group", groupData);
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("insertGroup error:", err);
    return { ok: false, error: err.response?.data?.detail || err.message };
  }
}

// UPDATE - Update existing group by gname
export async function updateGroup(gname, groupData) {
  try {
    const encodedName = encodeURIComponent(gname);
    const res = await api.put(`/group/${encodedName}`, groupData);
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("updateGroup error:", err);
    return { ok: false, error: err.response?.data?.detail || err.message };
  }
}

// DELETE - Delete group by gname
export async function deleteGroup(gname, force = false) {
  try {
    const encodedName = encodeURIComponent(gname);
    const res = await api.delete(`/group/${encodedName}`, { params: { force } });
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("deleteGroup error:", err);
    const detail = err.response?.data?.detail;
    
    // Handle devices_attached error specially
    if (detail?.error === "devices_attached") {
      return {
        ok: false,
        error: "devices_attached",
        message: detail.message,
        devices: detail.devices || [],
        videos: detail.videos || [],
        device_count: detail.device_count || 0,
        video_count: detail.video_count || 0
      };
    }
    
    return { ok: false, error: typeof detail === "string" ? detail : err.message };
  }
}

// GET - Get group attachments (videos and devices)
export async function getGroupAttachments(gname) {
  try {
    const encodedName = encodeURIComponent(gname);
    const res = await api.get(`/group/${encodedName}/attachments`);
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("getGroupAttachments error:", err);
    return { ok: false, error: err.response?.data?.detail || err.message };
  }
}

// POST - Unassign all devices from group
export async function unassignDevicesFromGroup(gname) {
  try {
    const encodedName = encodeURIComponent(gname);
    const res = await api.post(`/group/${encodedName}/unassign-devices`);
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("unassignDevicesFromGroup error:", err);
    return { ok: false, error: err.response?.data?.detail || err.message };
  }
}

