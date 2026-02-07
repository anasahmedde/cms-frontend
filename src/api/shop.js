// src/api/shop.js
import axios from "axios";

// Shop API runs on port 8002
const BASE_URL =
  process.env.REACT_APP_SHOP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8002`;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

function normalizeList(payload) {
  const data = payload ?? {};
  const items = Array.isArray(data)
    ? data
    : data.items || data.data || data.results || [];
  const total = data.total ?? data.count ?? items.length;
  return { items, total };
}

function errMsg(err) {
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    err?.message ||
    "Request failed"
  );
}

const enc = (v) => encodeURIComponent(String(v ?? ""));

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

/**
 * LIST
 * Works with backends that:
 *  - accept /shops?limit=&offset=
 *  - OR accept /shops with no params (your case -> 422 when params are present)
 *  - OR return plain list
 */
export async function listShops(a = 50, b = 0, c = "") {
  let limit = 50,
    offset = 0,
    q = "";

  if (typeof a === "object" && a !== null) {
    limit = a.limit ?? 50;
    offset = a.offset ?? 0;
    q = (a.q ?? "").trim();
  } else {
    limit = a ?? 50;
    offset = b ?? 0;
    q = (c ?? "").trim();
  }

  const params = {
    limit: toPosInt(limit, 50),
    offset: toNonNegInt(offset, 0),
  };
  if (q) params.q = q;

  // Attempt 1: /shops with params
  try {
    const res = await api.get("/shops", { params });
    const { items, total } = normalizeList(res.data);
    return { ok: true, items, total, data: res.data };
  } catch (err1) {
    // If backend rejects params (422), retry without params
    const status = err1?.response?.status;
    if (status !== 422) {
      console.error("listShops error:", err1);
      return { ok: false, items: [], total: 0, error: errMsg(err1) };
    }
    console.warn("listShops got 422 with params; retrying without params...");
  }

  // Attempt 2: /shops with NO params
  try {
    const res = await api.get("/shops");
    const { items, total } = normalizeList(res.data);
    return { ok: true, items, total, data: res.data };
  } catch (err2) {
    console.error("listShops error (no params):", err2);
    return { ok: false, items: [], total: 0, error: errMsg(err2) };
  }
}

/**
 * Returns array of shop names for dropdowns
 */
export async function listShopNames(q = "") {
  const r = await listShops(1000, 0, q);
  if (!r.ok) return [];

  const arr = Array.isArray(r.items) ? r.items : [];
  return arr
    .map((x) => x?.shop_name ?? x?.name ?? x?.sname ?? x)
    .filter(Boolean);
}

/**
 * CREATE
 * Backend route: POST /insert_shop
 */
export async function insertShop(shopData) {
  try {
    const payload = { shop_name: (shopData?.shop_name ?? "").trim() };
    if (!payload.shop_name) return { ok: false, error: "shop_name is required" };

    const res = await api.post("/insert_shop", payload);
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("insertShop error:", err);
    return { ok: false, error: errMsg(err), raw: err?.response?.data };
  }
}

/**
 * GET ONE
 * GET /shop/{shop_name}
 */
export async function getShop(shopName) {
  try {
    const res = await api.get(`/shop/${enc(shopName)}`);
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("getShop error:", err);
    return { ok: false, error: errMsg(err), raw: err?.response?.data };
  }
}

/**
 * UPDATE
 * PUT /shop/{shop_name}
 */
export async function updateShop(shopName, patch) {
  try {
    const payload = { shop_name: (patch?.shop_name ?? "").trim() || undefined };
    const res = await api.put(`/shop/${enc(shopName)}`, payload);
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("updateShop error:", err);
    return { ok: false, error: errMsg(err), raw: err?.response?.data };
  }
}

/**
 * DELETE
 * DELETE /shop/{shop_name}
 */
export async function deleteShop(shopName) {
  try {
    const res = await api.delete(`/shop/${enc(shopName)}`);
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("deleteShop error:", err);
    return { ok: false, error: errMsg(err), raw: err?.response?.data };
  }
}

