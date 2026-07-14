// Per-company feature flags. Cached per session; company context only.
// Hardware-analytics flags default OFF (missing key = off). The "layouts"
// capability flag defaults ON (present unless explicitly turned off) so
// existing companies keep the grid layout editor unless they opt out.
import { useEffect, useState } from "react";
import { apiGet } from "./api";

let cached = null;
let inflight = null;

export const FEATURE_LABELS = {
  temperature: "Temperature monitoring (BLE probe)",
  footfall: "Footfall counting (door sensor)",
  gender: "Gender analytics (camera)",
  grid: "Grid / split layout editor",
};

// Flags that are ON unless explicitly set false (capabilities, not hardware).
const DEFAULT_ON = new Set(["grid"]);

export function featureOn(features, key) {
  const v = features?.[key];
  if (DEFAULT_ON.has(key)) return v !== false;
  return !!v;
}

export function invalidateFeatureCache() {
  cached = null;
  inflight = null;
}

export function useCompanyFeatures() {
  const [state, setState] = useState(() => ({ features: cached || {}, loaded: !!cached }));

  useEffect(() => {
    if (cached) return;
    if (!inflight) {
      inflight = apiGet("/platform/my-company").then((res) => {
        cached = (res.ok && res.data?.features) || {};
        return cached;
      });
    }
    let alive = true;
    inflight.then((f) => alive && setState({ features: f, loaded: true }));
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
