// Report data loader: parallel per-device fetches with cancellation (the
// legacy page fired 5 sequential requests per device with no cancellation, so
// a stale run could overwrite a newer one) and per-device error capture (the
// legacy page console.error'd and showed misleading "no data").
import { useCallback, useRef, useState } from "react";
import { apiGet } from "../../lib/api";

// tab → per-device fetch. Endpoints/params mirror legacy Reports.js:222-274.
async function fetchFor(tab, mobileId, { startDate, endDate }) {
  const enc = encodeURIComponent(mobileId);
  if (tab === "temperature") {
    return apiGet(`/device/${enc}/logs`, {
      params: { log_type: "temperature", start_date: startDate, limit: 5000 },
    });
  }
  if (tab === "uptime") {
    return apiGet(`/device/${enc}/uptime_report`, {
      params: { start_date: startDate, end_date: endDate },
    });
  }
  if (tab === "daily") {
    return apiGet(`/device/${enc}/count_history`, { params: { period_type: "daily", limit: 365 } });
  }
  return apiGet(`/device/${enc}/count_history`, { params: { period_type: "monthly", limit: 24 } });
}

export function extractRows(tab, data) {
  if (tab === "temperature") return data?.logs || data?.items || [];
  if (tab === "uptime") return data || null;
  const rows = data?.history || data?.items || [];
  return rows.map((r) => ({ label: r.period_date, value: r.count_value ?? r.count ?? 0 }));
}

export default function useReportData() {
  const [byDevice, setByDevice] = useState({}); // mobileId → {loading, error, rows}
  const seqRef = useRef(0);

  const load = useCallback(async (tab, mobileIds, range) => {
    const seq = ++seqRef.current;
    setByDevice(Object.fromEntries(mobileIds.map((id) => [id, { loading: true }])));
    await Promise.all(
      mobileIds.map(async (id) => {
        const res = await fetchFor(tab, id, range);
        if (seq !== seqRef.current) return; // selection/tab changed — drop stale result
        setByDevice((prev) => ({
          ...prev,
          [id]: res.ok
            ? { loading: false, rows: extractRows(tab, res.data) }
            : { loading: false, error: res.message },
        }));
      })
    );
  }, []);

  const clear = useCallback(() => {
    seqRef.current += 1;
    setByDevice({});
  }, []);

  return { byDevice, load, clear };
}
