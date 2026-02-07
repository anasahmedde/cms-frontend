// src/api/link.js
import { safeGet, safePostFallback, safeDelete, normalizeList } from "./httpFactory";

/**
 * List links (supports being called either as:
 *   listLinks(1000, 0)
 * OR
 *   listLinks({ limit: 1000, offset: 0 })
 */
export async function listLinks(limitOrOpts = 1000, offset = 0) {
  const opts =
    typeof limitOrOpts === "object" && limitOrOpts !== null
      ? limitOrOpts
      : { limit: limitOrOpts, offset };

  const limit = Number(opts.limit ?? 1000);
  const off = Number(opts.offset ?? 0);

  const r = await safeGet("/links", { limit, offset: off });
  if (!r.ok) return { ok: false, items: [], total: 0, error: r };

  const { items, total } = normalizeList(r.data);
  return { ok: true, items, total, data: r.data };
}

export async function createLinkSafe(payload) {
  return safePostFallback(["/link", "/links/create", "/links"], payload);
}

// Backward compatible (your old code imported createLink)
export async function createLink(payload) {
  return createLinkSafe(payload);
}

export async function deleteLink(id) {
  if (!id) return { ok: false, status: 400, message: "Missing link id" };
  return safeDelete(`/link/${encodeURIComponent(id)}`);
}

/**
 * ✅ THIS FIXES YOUR BUILD ERROR:
 * dvsg backend has: GET /group/{gname}/videos
 */
export async function listGroupVideosByName(gname) {
  const name = (gname ?? "").toString().trim();
  if (!name) return { ok: false, status: 400, message: "Missing group name" };
  return safeGet(`/group/${encodeURIComponent(name)}/videos`);
}

/**
 * Device online status (DVSG service)
 */
export async function getDeviceOnlineStatus(mobileId) {
  if (!mobileId) {
    return { ok: true, data: { mobile_id: "", is_online: false } };
  }

  const r = await safeGet(`/device/${encodeURIComponent(mobileId)}/online`);
  if (!r.ok) return r;

  const is_online = !!(r.data?.is_online ?? r.data?.online ?? r.data === true);
  const base = r.data && typeof r.data === "object" ? r.data : {};
  return { ok: true, data: { ...base, is_online } };
}

