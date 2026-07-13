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

export const CANVAS_PRESETS = [
  { label: "Landscape 1920×1080", orientation: "landscape", w: 1920, h: 1080 },
  { label: "Portrait 1080×1920", orientation: "portrait", w: 1080, h: 1920 },
];

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
