// Layout geometry + the layout_config payload logic shared by the LayoutEditor
// pieces. The layout_config JSON shape is the legacy GridLayoutEditor contract
// the Android player parses — DO NOT change it:
//   [{ position, video_name, ad_name, content_type, rotation,
//      (slot 1, Single mode only) play_all_sequential, sequential_videos }]

// Slot geometry per mode: `rows` is the preview arrangement (slot indexes per
// row). Labels come from fleet/lib LAYOUT_LABELS (naming glossary).
export const LAYOUT_PRESETS = {
  single: { slots: 1, rows: [[0]] },
  split_h: { slots: 2, rows: [[0, 1]] },
  split_v: { slots: 2, rows: [[0], [1]] },
  grid_3: { slots: 3, rows: [[0, 1], [2]] },
  grid_4: { slots: 4, rows: [[0, 1], [2, 3]] },
  grid_1x4: { slots: 4, rows: [[0], [1], [2], [3]] },
};

// null = "Default": the link's own device_rotation/rotation applies.
export const ROTATION_OPTIONS = [
  { value: null, label: "Default" },
  { value: 0, label: "0°" },
  { value: 90, label: "90°" },
  { value: 180, label: "180°" },
  { value: 270, label: "270°" },
];

export function parseResolution(resStr) {
  if (!resStr) return { width: 1920, height: 1080 };
  const parts = String(resStr).split("x");
  return {
    width: parseInt(parts[0], 10) || 1920,
    height: parseInt(parts[1], 10) || 1080,
  };
}

// layout_config arrives as a JSON string or an object; normalize to an array.
// null = nothing saved yet (first-ever open → auto-fill by grid_position).
export function parseLayoutConfig(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
}

// The legacy editor received the dashboard row's links scoped to ONE group;
// the standalone panel loads every link on the device, so scope to `gname`
// when the links carry it and dedupe repeated video names across groups.
export function scopeDeviceVideos(items, gname) {
  const links = (items || []).filter((it) => (it.content_type || "video") !== "image");
  const inGroup = gname ? links.filter((it) => it.gname === gname) : [];
  const pool = inGroup.length > 0 ? inGroup : links;
  const seen = new Set();
  const out = [];
  for (const it of pool) {
    if (!it.video_name || seen.has(it.video_name)) continue;
    seen.add(it.video_name);
    out.push(it);
  }
  return out;
}

// One implementation of the legacy slot-restore algorithm (it was duplicated
// for initial load and mode change). Semantics preserved exactly:
// - saved image slot → restore ad (even if the ad list no longer has it)
// - saved video slot → restore video; rotation = saved ?? link's device_rotation ?? rotation
// - saved-but-empty slot → user explicitly cleared it, keep empty
// - no saved entry + prevSlots (mode change) → keep what the user placed there
// - no saved config at all (first-ever open) → auto-fill videos by grid_position
export function restoreSlots({ preset, savedConfig, videos, ads, prevSlots = null }) {
  const configArray = Array.isArray(savedConfig) ? savedConfig : [];
  const sorted = [...(videos || [])].sort(
    (a, b) => (a.grid_position || 0) - (b.grid_position || 0)
  );
  const slots = [];
  for (let i = 0; i < preset.slots; i++) {
    const position = i + 1;
    const savedSlot = configArray.find((s) => s.position === position);
    if (savedSlot?.ad_name && savedSlot?.content_type === "image") {
      const adData = (ads || []).find((a) => a.ad_name === savedSlot.ad_name);
      slots.push({
        position,
        video: null,
        advertisement: adData || { ad_name: savedSlot.ad_name },
        content_type: "image",
        rotation: savedSlot.rotation ?? null,
      });
    } else if (savedSlot?.video_name) {
      const videoData = sorted.find((v) => v.video_name === savedSlot.video_name);
      slots.push({
        position,
        video: videoData || { video_name: savedSlot.video_name },
        advertisement: null,
        content_type: "video",
        rotation: savedSlot.rotation ?? videoData?.device_rotation ?? videoData?.rotation ?? null,
      });
    } else if (savedSlot) {
      slots.push({ position, video: null, advertisement: null, content_type: "video", rotation: null });
    } else if (prevSlots && prevSlots[i]) {
      slots.push({ ...prevSlots[i], position });
    } else {
      const auto = configArray.length === 0 ? sorted[i] || null : null;
      slots.push({
        position,
        video: auto,
        advertisement: null,
        content_type: "video",
        rotation: auto ? auto.device_rotation ?? auto.rotation ?? null : null,
      });
    }
  }
  return slots;
}

// Exact legacy payload: every slot always carries all five keys; sequential
// fields are embedded into slot 1 only when Single mode + sequence enabled.
export function buildLayoutConfig({ slots, layoutMode, playAllSequential, sequentialVideos }) {
  let config = slots.map((slot, idx) => ({
    position: idx + 1,
    video_name: slot.video?.video_name || null,
    ad_name: slot.advertisement?.ad_name || null,
    content_type: slot.content_type || "video",
    rotation: slot.rotation,
  }));
  if (layoutMode === "single" && playAllSequential) {
    const orderedNames = [...sequentialVideos]
      .sort((a, b) => a.order - b.order)
      .map((v) => v.video_name);
    config = config.map((slot) =>
      slot.position === 1
        ? { ...slot, play_all_sequential: true, sequential_videos: orderedNames }
        : slot
    );
  }
  return config;
}

// FastAPI details come back as string | [{msg}] | {msg}; flatten for humans.
export function describeApiError(res, fallback) {
  const detail = res?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
  if (detail && typeof detail === "object") return detail.msg || detail.message || JSON.stringify(detail);
  return res?.message || fallback;
}
