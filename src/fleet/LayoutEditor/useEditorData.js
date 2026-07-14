// Loads everything the editor needs, through the shared authenticated client
// (the legacy file used bare axios on every call — fixed here).
//
// Criticality tiers:
// - Device links + saved layout are BLOCKING: if either fails we render an
//   ErrorState and never let the user save — saving over a layout we failed
//   to load would silently overwrite the screen's real config (design doc §7).
// - Resolution is cosmetic (preview aspect); failure falls back to 1920×1080
//   and the caption says so.
// - Group images / group screens degrade to panel-level errors with retry.
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, normalizeList } from "../../lib/api";
import { parseLayoutConfig, scopeDeviceVideos } from "./presets";

const EMPTY = {
  loading: true,
  error: "",
  videos: [],
  resolution: null,
  resolutionKnown: false,
  layoutMode: null,
  savedConfig: null,
  ads: [],
  adsError: "",
  groupDevices: [],
  groupError: "",
};

export default function useEditorData(mobileId, gname) {
  const [state, setState] = useState(EMPTY);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setState((s) => ({ ...s, loading: true, error: "" }));

    const devicePath = `/device/${encodeURIComponent(mobileId)}`;
    const [linksRes, layoutRes, resolutionRes] = await Promise.all([
      apiGet(`${devicePath}/videos`, { params: { limit: 500, offset: 0 } }),
      apiGet(`${devicePath}/layout`),
      apiGet(`${devicePath}/resolution`),
    ]);
    if (seq !== requestSeq.current) return;

    if (!linksRes.ok) {
      setState({ ...EMPTY, loading: false, error: `Couldn't load this screen's videos — ${linksRes.message}` });
      return;
    }
    if (!layoutRes.ok) {
      // Blocking on purpose: a default "single/empty" over the real layout is
      // the legacy silent-overwrite bug.
      setState({ ...EMPTY, loading: false, error: `Couldn't load this screen's saved layout — ${layoutRes.message}` });
      return;
    }

    let ads = [];
    let adsError = "";
    let groupDevices = [];
    let groupError = "";
    if (gname && gname !== "_none") {
      const groupPath = `/group/${encodeURIComponent(gname)}`;
      const [adsRes, attachRes] = await Promise.all([
        apiGet(`${groupPath}/advertisements`),
        apiGet(`${groupPath}/attachments`),
      ]);
      if (seq !== requestSeq.current) return;
      if (adsRes.ok) ads = adsRes.data?.advertisements || [];
      else if (adsRes.status !== 404) adsError = adsRes.message;
      if (attachRes.ok) groupDevices = attachRes.data?.devices || [];
      else if (attachRes.status !== 404) groupError = attachRes.message;
    }

    const links = normalizeList(linksRes.data, "items").items;
    setState({
      loading: false,
      error: "",
      videos: scopeDeviceVideos(links, gname),
      resolution: resolutionRes.ok ? resolutionRes.data?.resolution || null : null,
      resolutionKnown: resolutionRes.ok && Boolean(resolutionRes.data?.resolution),
      layoutMode: layoutRes.data?.layout_mode || null,
      savedConfig: parseLayoutConfig(layoutRes.data?.layout_config),
      ads,
      adsError,
      groupDevices,
      groupError,
    });
  }, [mobileId, gname]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
