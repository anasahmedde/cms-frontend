import { PAGE_SIZE } from "./config";

/**
 * Fetches ALL items from a paginated FastAPI endpoint that supports limit/offset.
 * Prevents 422 by keeping limit <= 100.
 */
export async function fetchAll(http, path, params = {}) {
  const all = [];
  let offset = 0;

  while (true) {
    const res = await http.get(path, {
      params: { ...params, limit: PAGE_SIZE, offset },
    });

    const items = res?.data?.items || [];
    all.push(...items);

    if (items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

export const enc = (v) => encodeURIComponent(String(v ?? ""));

