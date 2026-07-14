// Data hooks for the Screen detail page. All HTTP via the shared client;
// every consumer gets explicit {loading, error, reload} so no failure can
// render as an empty state.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, normalizeList } from "../../lib/api";
import { wsClient } from "../../lib/ws";

// One screen, exact-matched from GET /devices?q= (there is no single-device
// read endpoint), live-patched by WS online/offline/temperature events.
export function useScreenDevice(mobileId) {
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const seqRef = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    const res = await apiGet("/devices", { params: { q: mobileId, limit: 50, offset: 0 } });
    if (seq !== seqRef.current) return;
    if (res.ok) {
      const { items } = normalizeList(res.data, "items");
      const match = items.find((d) => d.mobile_id === mobileId) || null;
      setDevice(match);
      setNotFound(!match);
      setError(null);
    } else {
      setError(res.message);
    }
    setLoading(false);
  }, [mobileId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => () => {
    seqRef.current += 1; // invalidate in-flight loads on unmount
  }, []);

  // Merge a local mutation result without a full refetch (rename, mute…).
  const patch = useCallback((partial) => {
    setDevice((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  useEffect(() => {
    const apply = (partial) => (data) => {
      if (data?.mobile_id !== mobileId) return;
      setDevice((prev) => (prev ? { ...prev, ...partial(data, prev) } : prev));
    };
    const offOnline = wsClient.on(
      "device_online",
      apply((data, prev) => ({ is_online: true, last_online_at: data?.timestamp || prev.last_online_at }))
    );
    const offOffline = wsClient.on("device_offline", apply(() => ({ is_online: false })));
    const offTemp = wsClient.on(
      "device_temperature",
      apply((data) => ({ temperature: data?.temperature }))
    );
    return () => {
      offOnline();
      offOffline();
      offTemp();
    };
  }, [mobileId]);

  return { device, loading, error, notFound, reload, patch };
}

// The screen's playlist rows. GET /links?mobile_id= 500s server-side (its
// filter binds the pattern into the tenant_id placeholder), so fetch the
// tenant's links unfiltered and exact-match client-side — same strategy the
// pre-revamp dashboard used. `rows` keeps only real link rows (id + video);
// `shopName`/`gname` come from any exact-match row so the header can show the
// location chip even before a video is linked.
export function useScreenLinks(mobileId) {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seqRef = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    const res = await apiGet("/links", { params: { limit: 1000, offset: 0 } });
    if (seq !== seqRef.current) return;
    if (res.ok) {
      const { items } = normalizeList(res.data, "items");
      setRaw(items.filter((r) => r.mobile_id === mobileId));
      setError(null);
    } else {
      setError(res.message);
    }
    setLoading(false);
  }, [mobileId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => () => {
    seqRef.current += 1;
  }, []);

  const rows = useMemo(() => raw.filter((r) => r.id != null && r.video_name), [raw]);
  const shopName = useMemo(() => raw.find((r) => r.shop_name)?.shop_name || null, [raw]);
  const gname = useMemo(() => {
    const g = raw.find((r) => r.gname && r.gname.toLowerCase() !== "unassigned")?.gname;
    return g || null;
  }, [raw]);

  return { rows, shopName, gname, loading, error, reload };
}

// True when the name refers to a real group (not the various "no group"
// sentinels the backend/legacy UI use).
export function isRealGroup(gname) {
  const g = (gname || "").trim().toLowerCase();
  return !!g && g !== "unassigned" && g !== "_none" && g !== "— no group —";
}
