// src/api/device.js
import axios from "axios";
import { safeGet, normalizeList } from "./httpFactory";

// Device CRUD API runs on port 8000 (device.py)
const DEVICE_BASE_URL =
  process.env.REACT_APP_DEVICE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000`;

const deviceApi = axios.create({
  baseURL: DEVICE_BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

function pickMessage(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.message || v.detail || JSON.stringify(v);
  return String(v);
}

function errMsg(err) {
  const data = err?.response?.data;
  return (
    pickMessage(data?.detail) ||
    pickMessage(data?.message) ||
    pickMessage(data) ||
    err?.message ||
    "Request failed"
  );
}

const enc = (v) => encodeURIComponent(String(v ?? ""));

/**
 * LIST devices
 * GET /devices?limit&offset&q
 */
export async function listDevices(limit = 100, offset = 0, q = "") {
  try {
    const params = { limit, offset };
    if (q) params.q = q;

    const res = await deviceApi.get("/devices", { params });
    const { items, total } = normalizeList(res.data);
    return { ok: true, items, total, data: res.data };
  } catch (err) {
    console.error("listDevices error:", err);
    return {
      ok: false,
      items: [],
      total: 0,
      status: err?.response?.status,
      error: errMsg(err),
      raw: err?.response?.data,
    };
  }
}

/**
 * CREATE device
 * device.py expects POST /insert_device
 */
export async function insertDevice(payload) {
  try {
    const body = {
      mobile_id: (payload?.mobile_id ?? "").trim(),
      download_status: !!payload?.download_status,
    };

    if (!body.mobile_id) return { ok: false, error: "mobile_id is required" };

    const res = await deviceApi.post("/insert_device", body);
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("insertDevice error:", err);
    return {
      ok: false,
      status: err?.response?.status,
      error: errMsg(err),
      raw: err?.response?.data,
    };
  }
}

/**
 * DELETE device
 * device.py has DELETE /device/{mobile_id}
 * If FK linked, backend returns 409 with detail object containing recent_links
 */
export async function deleteDevice(mobileId) {
  try {
    const id = (mobileId ?? "").toString().trim();
    if (!id) return { ok: false, error: "mobile_id is required" };

    const res = await deviceApi.delete(`/device/${enc(id)}`);
    return { ok: true, data: res.data };
  } catch (err) {
    const data = err?.response?.data;
    const detailObj = data?.detail && typeof data.detail === "object" ? data.detail : null;

    console.error("deleteDevice error:", err);
    return {
      ok: false,
      status: err?.response?.status,
      error: errMsg(err),        // always string
      detailObj,                 // object with recent_links (if 409)
      raw: data,
    };
  }
}

/**
 * ONLINE status lives on DVSG service (port 8005)
 */
export async function getDeviceOnlineStatus(mobileId) {
  if (!mobileId) return { ok: true, online: false };
  const r = await safeGet(`/device/${encodeURIComponent(mobileId)}/online`);
  if (!r.ok) return { ok: false, online: false, error: r };
  return { ok: true, online: !!r.data?.online || r.data === true || !!r.data?.is_online };
}

