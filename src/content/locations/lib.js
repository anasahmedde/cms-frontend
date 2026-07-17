// Locations data layer — every request goes through the shared authed client
// (src/lib/api.js). "Location" is the UI name; the API keeps its shop_* paths.
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete, normalizeList } from "../../lib/api";

const enc = (v) => encodeURIComponent(String(v ?? ""));

// Backend caps limit at 1000 — request the max so the legacy 50-row cap is gone.
const LIST_LIMIT = 1000;

// List locations with server-side search. Keeps the legacy api/shop.js quirk:
// some deployments 422 on list params, so retry bare and filter client-side
// (never let a param rejection surface as a failed page).
export async function fetchLocations(q) {
  const params = { limit: LIST_LIMIT, offset: 0 };
  const query = (q || "").trim();
  if (query) params.q = query;
  let res = await apiGet("/shops", { params });
  if (!res.ok && res.status === 422) {
    res = await apiGet("/shops");
    if (res.ok && query) {
      const items = normalizeList(res.data, "items").items.filter((s) =>
        (s.shop_name || "").toLowerCase().includes(query.toLowerCase())
      );
      return { ok: true, items };
    }
  }
  if (!res.ok) return { ok: false, message: res.message };
  return { ok: true, items: normalizeList(res.data, "items").items };
}

export function fetchLocation(shopName) {
  return apiGet(`/shop/${enc(shopName)}`);
}

// {ok, devices:[{id, mobile_id, device_name, group_name}]} — also primes the
// screen-count cache so list cards stay consistent with what detail shows.
export async function fetchLocationScreens(shopName) {
  const res = await apiGet(`/shop/${enc(shopName)}/devices`);
  if (!res.ok) return { ok: false, status: res.status, message: res.message };
  const devices = res.data?.devices || [];
  countCache.set(shopName, Number(res.data?.device_count ?? devices.length));
  return { ok: true, devices };
}

// Result is CHECKED by callers (the legacy page swallowed failures). Success
// data may carry {existed: true} when the name already exists.
export function createLocation(shopName) {
  return apiPost("/insert_shop", { shop_name: shopName });
}

// Renames are by-name keys: the location's URL and API path change with it.
export function renameLocation(currentName, newName) {
  return apiPut(`/shop/${enc(currentName)}`, { shop_name: newName });
}

// 409 without force returns detail {message, linked:{video_links, ad_links}}.
export function deleteLocation(shopName, force) {
  return apiDelete(`/shop/${enc(shopName)}${force ? "?force=true" : ""}`);
}

// ---- Lazy per-card screen counts (cached: counts change rarely and search
// re-renders the grid on every debounced keystroke) --------------------------
const countCache = new Map(); // shop_name → number

export function clearScreenCountCache() {
  countCache.clear();
}

export async function fetchScreenCount(shopName) {
  if (countCache.has(shopName)) return { ok: true, count: countCache.get(shopName) };
  const res = await apiGet(`/shop/${enc(shopName)}/devices`);
  if (!res.ok) return { ok: false, message: res.message };
  const count = Number(res.data?.device_count ?? (res.data?.devices || []).length);
  countCache.set(shopName, count);
  return { ok: true, count };
}

// ---- Company screen template (gates the zone-content editor) ---------------
// {loading, error, template|null, reload}. template === null with no error is
// the legitimate "no template linked" state, NOT a failure.
export function useCompanyTemplate() {
  const [state, setState] = useState({ loading: true, error: "", template: null });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    const res = await apiGet("/company/template");
    if (res.ok) setState({ loading: false, error: "", template: res.data?.template || null });
    else setState({ loading: false, error: res.message, template: null });
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}
