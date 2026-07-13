// Zone type registry for the screen-template designer.
// Mirrors the backend contract in cms-backend/template_api.py — keep in sync.

export const ZONE_TYPES = {
  text: {
    label: "Text",
    icon: "🅣",
    hint: "Static text, a bound field (shop/company/device name), or shop-editable text",
    defaults: { w: 100, h: 15 },
    bindings: ["static", "shop.name", "company.name", "device.name", "content"],
  },
  playlist: {
    label: "Playlist",
    icon: "▶",
    hint: "Plays the device's assigned videos/images (the existing content pipeline)",
    defaults: { w: 100, h: 70 },
    bindings: ["device.playlist"],
  },
  media: {
    label: "Image / Video",
    icon: "🖼",
    hint: "An image or video uploaded per shop (device can override)",
    defaults: { w: 30, h: 15 },
    bindings: ["content"],
  },
  qr: {
    label: "QR Code",
    icon: "▦",
    hint: "QR from an uploaded image OR a link (server renders the QR) — per shop",
    defaults: { w: 20, h: 15 },
    bindings: ["content"],
  },
  clock: {
    label: "Clock",
    icon: "🕐",
    hint: "Time/date display",
    defaults: { w: 20, h: 10 },
    bindings: ["static"],
  },
  ticker: {
    label: "Ticker",
    icon: "📜",
    hint: "Scrolling text — static or shop-editable",
    defaults: { w: 100, h: 8 },
    bindings: ["static", "content"],
  },
};

export const BINDING_LABELS = {
  "static": "Fixed (set in template)",
  "content": "Editable content (per shop / device)",
  "shop.name": "Shop name",
  "company.name": "Company name",
  "device.name": "Device name",
  "device.playlist": "Device playlist",
};

export const CONTENT_SCOPES = ["shop", "device", "company"];

// Common signage presets — but any custom width/height is allowed (see CUSTOM).
// Grouped by orientation; label carries the aspect ratio for quick recognition.
export const CANVAS_PRESETS = [
  { label: "Landscape — Full HD 1920×1080 (16:9)", orientation: "landscape", w: 1920, h: 1080 },
  { label: "Landscape — 4K UHD 3840×2160 (16:9)", orientation: "landscape", w: 3840, h: 2160 },
  { label: "Landscape — HD 1366×768 (16:9)", orientation: "landscape", w: 1366, h: 768 },
  { label: "Landscape — 1280×800 (16:10)", orientation: "landscape", w: 1280, h: 800 },
  { label: "Landscape — Ultrawide 3440×1440 (21:9)", orientation: "landscape", w: 3440, h: 1440 },
  { label: "Landscape — Stretch bar 1920×540 (32:9)", orientation: "landscape", w: 1920, h: 540 },
  { label: "Portrait — Full HD 1080×1920 (9:16)", orientation: "portrait", w: 1080, h: 1920 },
  { label: "Portrait — 4K UHD 2160×3840 (9:16)", orientation: "portrait", w: 2160, h: 3840 },
  { label: "Portrait — HD 768×1366 (9:16)", orientation: "portrait", w: 768, h: 1366 },
  { label: "Portrait — Tall bar 540×1920 (9:32)", orientation: "portrait", w: 540, h: 1920 },
  { label: "Square 1080×1080 (1:1)", orientation: "landscape", w: 1080, h: 1080 },
];

export const CANVAS_MIN = 120;
export const CANVAS_MAX = 10000; // matches the backend validation range

// Clamp + derive orientation for a custom canvas size.
export function normalizeCanvas(w, h) {
  const width = Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, Math.round(Number(w) || 0)));
  const height = Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, Math.round(Number(h) || 0)));
  return { design_width: width, design_height: height, orientation: width >= height ? "landscape" : "portrait" };
}

// Reduce w:h to a tidy aspect-ratio label (e.g. "16:9").
export function aspectLabel(w, h) {
  const g = (a, b) => (b ? g(b, a % b) : a);
  const d = g(Math.round(w), Math.round(h)) || 1;
  const rw = Math.round(w) / d, rh = Math.round(h) / d;
  return rw <= 64 && rh <= 64 ? `${rw}:${rh}` : `${(w / h).toFixed(2)}:1`;
}

export const ZONE_PALETTE = [
  "rgba(59,130,246,0.55)",   // blue
  "rgba(16,185,129,0.55)",   // green
  "rgba(245,158,11,0.55)",   // amber
  "rgba(168,85,247,0.55)",   // purple
  "rgba(236,72,153,0.55)",   // pink
  "rgba(20,184,166,0.55)",   // teal
];

export function zoneColor(index) {
  return ZONE_PALETTE[index % ZONE_PALETTE.length];
}

let counter = 0;
export function newZone(type, existingKeys) {
  const def = ZONE_TYPES[type];
  let key = type;
  counter += 1;
  while (existingKeys.includes(key)) key = `${type}-${++counter}`;
  return {
    key,
    type,
    x: 10, y: 10,
    w: def.defaults.w, h: def.defaults.h,
    z: 1,
    style: {},
    binding: { source: def.bindings[0], ...(def.bindings[0] === "content" ? { scope: "shop" } : {}) },
  };
}
