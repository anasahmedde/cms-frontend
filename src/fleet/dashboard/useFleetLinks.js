// Bulk load of link rows (media assignments) grouped per screen. Powers the
// Location chips, Media filter, per-row assignment lists, and the
// Groups/Locations/Media totals — GET /devices alone carries none of that.
import { useCallback, useEffect, useState } from "react";
import { apiGet, normalizeList } from "../../lib/api";

const LINKS_LIMIT = 1000;

// Backend sentinel for "device has no group" rows synthesized by GET /links.
export function isUngroupedName(gname) {
  return !gname || gname === "Unassigned" || gname === "_none";
}

export default function useFleetLinks() {
  const [byMobileId, setByMobileId] = useState({});
  const [totals, setTotals] = useState({ groups: 0, locations: 0, media: 0 });
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const res = await apiGet("/links", { params: { limit: LINKS_LIMIT, offset: 0 } });
    if (!res.ok) {
      setError(res.message);
      setLoading(false);
      return res;
    }
    const { items } = normalizeList(res.data, "items");
    const map = {};
    const groups = new Set();
    const locations = new Set();
    const media = new Set();

    for (const it of items) {
      if (!it.mobile_id) continue;
      let entry = map[it.mobile_id];
      if (!entry) {
        entry = map[it.mobile_id] = {
          mobile_id: it.mobile_id,
          gname: null,
          shop_name: null,
          daily_count: null,
          monthly_count: null,
          temperature: null,
          links: [],
        };
      }
      if (!isUngroupedName(it.gname)) {
        entry.gname = it.gname;
        groups.add(it.gname);
      }
      if (it.shop_name) {
        entry.shop_name = it.shop_name;
        locations.add(it.shop_name);
      }
      if (it.daily_count != null) entry.daily_count = it.daily_count;
      if (it.monthly_count != null) entry.monthly_count = it.monthly_count;
      if (it.temperature != null) entry.temperature = it.temperature;
      // GET /links also synthesizes video-less rows for unlinked devices —
      // only rows with a video are real assignments.
      if (it.video_name) {
        media.add(it.video_name);
        entry.links.push({
          id: it.id,
          link_id: it.id,
          video_name: it.video_name,
          content_type: it.content_type || "video",
          rotation: it.rotation || 0,
          device_rotation: it.device_rotation,
          grid_position: it.grid_position || 0,
          shop_name: it.shop_name,
          gname: it.gname,
          created_at: it.created_at,
        });
      }
    }
    Object.values(map).forEach((e) =>
      e.links.sort((a, b) => (a.grid_position || 0) - (b.grid_position || 0))
    );

    setByMobileId(map);
    setTotals({ groups: groups.size, locations: locations.size, media: media.size });
    setTruncated(items.length >= LINKS_LIMIT);
    setError(null);
    setLoading(false);
    return res;
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { byMobileId, totals, truncated, loading, error, reload };
}
