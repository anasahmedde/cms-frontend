// Per-company feature flags (analytics that need optional hardware).
// Missing key = OFF. Cached per session; company context only.
import { useEffect, useState } from "react";
import { apiGet } from "./api";

let cached = null;
let inflight = null;

export const FEATURE_LABELS = {
  temperature: "Temperature monitoring (BLE probe)",
  footfall: "Footfall counting (door sensor)",
  gender: "Gender analytics (camera)",
};

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
