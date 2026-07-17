// Persistence: exact legacy payloads through the shared authenticated client.
//   POST /device/{mobile_id}/layout   { layout_mode, layout_config: <JSON string> }
//   PUT  /link/{link_id}/settings     { grid_position, device_rotation } per video slot
// Per-link failures are RETURNED so the UI can name the failed slots — the
// legacy editor console.warn'd them and closed as if fully saved (§7 fix).
import { apiGet, apiPost, apiPut, normalizeList } from "../../lib/api";
import { buildLayoutConfig, describeApiError } from "./presets";

export async function saveLayoutForDevice({
  mobileId,
  targetVideos,
  slots,
  layoutMode,
  playAllSequential,
  sequentialVideos,
}) {
  const layoutConfig = buildLayoutConfig({ slots, layoutMode, playAllSequential, sequentialVideos });
  const layoutRes = await apiPost(`/device/${encodeURIComponent(mobileId)}/layout`, {
    layout_mode: layoutMode,
    layout_config: JSON.stringify(layoutConfig),
  });
  if (!layoutRes.ok) {
    return {
      ok: false,
      message: describeApiError(layoutRes, "Failed to save layout"),
      failedSlots: [],
    };
  }

  const failedSlots = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    // Image slots: no per-link settings endpoint exists for advertisement
    // links yet (legacy TODO — their placement still persists in layout_config).
    if (!slot.video?.video_name) continue;
    const target = (targetVideos || []).find((v) => v.video_name === slot.video.video_name);
    const linkId = target?.link_id || target?.id;
    if (!linkId) continue; // video not linked on this device — legacy skipped too
    const linkRes = await apiPut(`/link/${linkId}/settings`, {
      grid_position: i + 1,
      device_rotation: slot.rotation,
    });
    if (!linkRes.ok) failedSlots.push({ position: i + 1, name: slot.video.video_name });
  }
  return { ok: true, failedSlots };
}

// Legacy GridLayoutEditor.js:505-516 fallback: when POST /group/{g}/sync-to-devices
// fails, apply the layout to every screen in the group individually, mapping
// link ids per target device (fetched fresh — the panel no longer receives
// them via props).
export async function applyLayoutToGroupFallback({ groupDevices, layout, onProgress }) {
  let success = 0;
  let failed = 0;
  let slotFailures = 0;
  for (let i = 0; i < groupDevices.length; i++) {
    const device = groupDevices[i];
    onProgress?.(i + 1, groupDevices.length);
    const linksRes = await apiGet(`/device/${encodeURIComponent(device.mobile_id)}/videos`, {
      params: { limit: 500, offset: 0 },
    });
    if (!linksRes.ok) {
      failed += 1;
      continue;
    }
    const targetVideos = normalizeList(linksRes.data, "items").items;
    const res = await saveLayoutForDevice({ mobileId: device.mobile_id, targetVideos, ...layout });
    if (res.ok) {
      success += 1;
      slotFailures += res.failedSlots.length;
    } else {
      failed += 1;
    }
  }
  return { success, failed, slotFailures };
}
