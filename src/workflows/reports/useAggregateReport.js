// One request per report view (GET /reports/{uptime|temperature|footfall})
// with stale-response cancellation — replaces the old per-screen fan-out.
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "../../lib/api";

export default function useAggregateReport({ tab, grain, start, end, shopId, groupId }) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    const params = { start_date: start, end_date: end };
    if (shopId) params.shop_id = shopId;
    if (groupId) params.group_id = groupId;
    if (tab === "footfall") params.grain = grain;
    const res = await apiGet(`/reports/${tab}`, { params });
    if (seq !== seqRef.current) return; // a newer request superseded this one
    if (res.ok) setState({ data: res.data, loading: false, error: "" });
    else setState({ data: null, loading: false, error: res.message || "Failed to load the report" });
  }, [tab, grain, start, end, shopId, groupId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
