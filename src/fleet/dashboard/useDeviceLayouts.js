// Lazy per-screen layout cache: GET /device/{id}/layout is fetched once per
// visible screen and kept in state. A failed fetch caches `null` (rendered as
// "—", never silently coerced to "single" like the legacy table did) and can
// be retried via invalidate(mobileId) — also used after a layout save.
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "../../lib/api";

function parseConfig(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function useDeviceLayouts(mobileIds) {
  const [layouts, setLayouts] = useState({});
  const inFlightRef = useRef(new Set());

  useEffect(() => {
    const missing = (mobileIds || []).filter(
      (id) => id && !(id in layouts) && !inFlightRef.current.has(id)
    );
    if (missing.length === 0) return undefined;
    missing.forEach((id) => inFlightRef.current.add(id));
    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        missing.map(async (id) => {
          const res = await apiGet(`/device/${encodeURIComponent(id)}/layout`);
          if (!res.ok) return [id, null]; // unknown — rendered as "—"
          return [
            id,
            {
              mode: res.data?.layout_mode || "single",
              config: parseConfig(res.data?.layout_config),
            },
          ];
        })
      );
      results.forEach(([id]) => inFlightRef.current.delete(id));
      if (cancelled) return;
      setLayouts((prev) => {
        const next = { ...prev };
        results.forEach(([id, value]) => {
          next[id] = value;
        });
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [mobileIds, layouts]);

  // Drop a cached entry so the effect refetches it (after layout save/retry).
  const invalidate = useCallback((mobileId) => {
    setLayouts((prev) => {
      if (!(mobileId in prev)) return prev;
      const next = { ...prev };
      delete next[mobileId];
      return next;
    });
  }, []);

  return { layouts, invalidate };
}
