// Shared fleet data layer — the ONE place Dashboard, Screens list, and Screen
// detail get device lists, live status, and download progress from.
// No UI in this file. All HTTP goes through the shared authenticated client.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, normalizeList } from "../lib/api";
import { wsClient } from "../lib/ws";

// One label set for all layout editors/badges (naming glossary is law).
export const LAYOUT_LABELS = {
  single: "Single",
  split_h: "2 Horizontal",
  split_v: "2 Vertical",
  grid_3: "3 Grid",
  grid_4: "2×2 Grid",
  grid_1x4: "1×4 Grid",
};

// 'online' | 'offline' from the /devices `is_online` flag (WS patches keep it live).
export function deviceStatus(device) {
  const v = device?.is_online;
  return v === true || v === 1 || v === "true" ? "online" : "offline";
}

// Badge props for a device's content_status. Tones match src/ui Badge.
const CONTENT_STATUS_BADGES = {
  no_content: { tone: "neutral", label: "No content" },
  synced: { tone: "success", label: "Synced" },
  syncing: { tone: "info", label: "Syncing" },
  pending: { tone: "warn", label: "Pending" },
};

export function contentStatusBadge(device) {
  return (
    CONTENT_STATUS_BADGES[device?.content_status] || { tone: "neutral", label: "Unknown" }
  );
}

// Mirrors the backend's content_status derivation (GET /devices) so a WS
// online/offline flip doesn't leave a stale badge until the next reload.
function computeContentStatus(device) {
  const videoCount = Number(device?.video_count) || 0;
  if (videoCount === 0) return "no_content";
  if (device?.download_status) return "synced"; // synced stays synced offline
  return deviceStatus(device) === "online" ? "syncing" : "pending";
}

// ---------------------------------------------------------------------------
// useFleetDevices — the fleet list.
//
//   const { devices, total, loading, error, reload } = useFleetDevices({ q });
//
// GET /devices?q&limit&offset=0 (normalizeList), then live-patched in place by
// wsClient events device_online / device_offline / device_temperature (matched
// on mobile_id — events for devices not in the current page are ignored; the
// caller's periodic reload picks those up). `error` is a message string or
// null; a failed background reload keeps the last good list AND sets `error`,
// so callers must surface it (toast/ErrorState), never render it as empty.
// ---------------------------------------------------------------------------
export function useFleetDevices({ q = "", limit = 500 } = {}) {
  const [devices, setDevices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seqRef = useRef(0); // drops out-of-order/unmounted responses

  const reload = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    const res = await apiGet("/devices", {
      params: { q: q || undefined, limit, offset: 0 },
    });
    if (seq !== seqRef.current) return;
    if (res.ok) {
      const { items, total: t } = normalizeList(res.data, "items");
      setDevices(items);
      setTotal(t);
      setError(null);
    } else {
      setError(res.message);
    }
    setLoading(false);
  }, [q, limit]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => () => {
    seqRef.current += 1; // invalidate in-flight loads on unmount
  }, []);

  useEffect(() => {
    const patch = (mobileId, apply) => {
      if (!mobileId) return;
      setDevices((prev) => {
        let hit = false;
        const next = prev.map((d) => {
          if (d.mobile_id !== mobileId) return d;
          hit = true;
          return apply(d);
        });
        return hit ? next : prev;
      });
    };

    const onFlip = (isOnline) => (data) =>
      patch(data?.mobile_id, (d) => {
        const updated = {
          ...d,
          is_online: isOnline,
          last_online_at: isOnline ? data?.timestamp || d.last_online_at : d.last_online_at,
        };
        updated.content_status = computeContentStatus(updated);
        return updated;
      });

    const offOnline = wsClient.on("device_online", onFlip(true));
    const offOffline = wsClient.on("device_offline", onFlip(false));
    const offTemp = wsClient.on("device_temperature", (data) =>
      patch(data?.mobile_id, (d) => ({ ...d, temperature: data?.temperature }))
    );
    return () => {
      offOnline();
      offOffline();
      offTemp();
    };
  }, []);

  return { devices, total, loading, error, reload };
}

// ---------------------------------------------------------------------------
// useDownloadProgress — live per-screen download progress.
//
//   const { progressByMobileId } = useDownloadProgress(devices);
//
// Polls GET /device/{id}/download_progress every 2s ONLY for devices whose
// content_status is 'syncing' or 'pending' (the legacy dashboard polled every
// device, unauthenticated — RecentLinks.js:2133-2174). Pauses while the tab is
// hidden. A device is parked (polling stops) after 3 consecutive stale/empty
// responses (backend folds >30s-old data into is_downloading:false) and
// re-armed when its content_status changes. Request errors neither count as
// stale nor reset the streak.
//
// progressByMobileId[mobile_id] exists ONLY while that device is actively
// downloading, and holds the raw endpoint payload:
//   {mobile_id, current_file, total_files, file_name, progress,
//    downloaded_bytes, total_bytes, is_downloading:true, updated_at}
// ---------------------------------------------------------------------------
const PROGRESS_POLL_MS = 2000;
const MAX_STALE_RESPONSES = 3;
const POLLABLE_STATUSES = new Set(["syncing", "pending"]);

export function useDownloadProgress(devices) {
  const [progressByMobileId, setProgressByMobileId] = useState({});
  const devicesRef = useRef(devices);
  devicesRef.current = devices;
  const staleCountsRef = useRef({}); // mobile_id -> consecutive stale/empty responses
  const lastStatusRef = useRef({}); // mobile_id -> last seen content_status
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  // Re-arm parked devices whenever their content_status changes.
  useEffect(() => {
    for (const d of devices || []) {
      if (lastStatusRef.current[d.mobile_id] !== d.content_status) {
        lastStatusRef.current[d.mobile_id] = d.content_status;
        staleCountsRef.current[d.mobile_id] = 0;
      }
    }
  }, [devices]);

  const tick = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (inFlightRef.current) return;
    const targets = (devicesRef.current || [])
      .filter(
        (d) =>
          POLLABLE_STATUSES.has(d.content_status) &&
          (staleCountsRef.current[d.mobile_id] || 0) < MAX_STALE_RESPONSES
      )
      .map((d) => d.mobile_id);
    if (targets.length === 0) return;

    inFlightRef.current = true;
    const results = await Promise.all(
      targets.map(async (id) => ({
        id,
        res: await apiGet(`/device/${encodeURIComponent(id)}/download_progress`),
      }))
    );
    inFlightRef.current = false;
    if (!mountedRef.current) return;

    setProgressByMobileId((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const { id, res } of results) {
        if (!res.ok) continue; // errors: don't count, don't reset (see contract)
        if (res.data?.is_downloading === true) {
          staleCountsRef.current[id] = 0;
          next[id] = res.data;
          changed = true;
        } else {
          staleCountsRef.current[id] = (staleCountsRef.current[id] || 0) + 1;
          if (id in next) {
            delete next[id];
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, []);

  // Poll loop + immediate catch-up when the tab becomes visible again.
  useEffect(() => {
    mountedRef.current = true;
    const intervalId = setInterval(tick, PROGRESS_POLL_MS);
    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tick]);

  // When the pollable set changes: drop entries for devices that left it
  // (a frozen "downloading" bar must never outlive the download) and poll
  // the new set immediately instead of waiting up to 2s.
  const activeKey = useMemo(
    () =>
      (devices || [])
        .filter((d) => POLLABLE_STATUSES.has(d.content_status))
        .map((d) => d.mobile_id)
        .sort()
        .join("|"),
    [devices]
  );

  useEffect(() => {
    const active = new Set(activeKey ? activeKey.split("|") : []);
    setProgressByMobileId((prev) => {
      const keys = Object.keys(prev);
      if (keys.every((k) => active.has(k))) return prev;
      const next = {};
      for (const k of keys) if (active.has(k)) next[k] = prev[k];
      return next;
    });
    if (active.size > 0) tick();
  }, [activeKey, tick]);

  return { progressByMobileId };
}
