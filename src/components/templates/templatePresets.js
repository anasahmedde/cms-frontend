// Prebuilt starting points for new templates. Every zone uses the standard
// zone schema, so a preset is just a head start — fully editable afterwards.
export const TEMPLATE_PRESETS = [
  {
    key: "blank",
    name: "Blank",
    description: "Empty canvas — add zones yourself",
    orientation: "landscape",
    design_width: 1920,
    design_height: 1080,
    zones: [],
  },
  {
    key: "fullscreen",
    name: "Full-screen playlist",
    description: "The whole screen plays the rotation",
    orientation: "landscape",
    design_width: 1920,
    design_height: 1080,
    zones: [
      { key: "main", type: "playlist", x: 0, y: 0, w: 100, h: 100, z: 1, binding: { source: "device.playlist" } },
    ],
  },
  {
    key: "header-ticker",
    name: "Header + playlist + ticker",
    description: "Branded header, rotation in the middle, news ticker below",
    orientation: "landscape",
    design_width: 1920,
    design_height: 1080,
    zones: [
      { key: "header", type: "text", x: 0, y: 0, w: 100, h: 12, z: 2, binding: { source: "company.name" }, style: { bg_color: "#0a1628", text_color: "#ffffff", font_size_vh: 55, bold: true } },
      { key: "main", type: "playlist", x: 0, y: 12, w: 100, h: 78, z: 1, binding: { source: "device.playlist" } },
      { key: "news", type: "ticker", x: 0, y: 90, w: 100, h: 10, z: 2, binding: { source: "content", scope: "company" }, style: { bg_gradient: { stops: ["#0a1628", "#1e3a5f"], angle: 90 }, text_color: "#f59e0b", font_size_vh: 45 } },
    ],
  },
  {
    key: "promo-split",
    name: "Promo split + QR",
    description: "Playlist on the left, promo text and a QR code on the right",
    orientation: "landscape",
    design_width: 1920,
    design_height: 1080,
    zones: [
      { key: "main", type: "playlist", x: 0, y: 0, w: 70, h: 100, z: 1, binding: { source: "device.playlist" } },
      { key: "promo", type: "text", x: 70, y: 0, w: 30, h: 55, z: 2, binding: { source: "content", scope: "shop" }, style: { bg_gradient: { stops: ["#0a1628", "#f59e0b"], angle: 160 }, text_color: "#ffffff", font_size_vh: 30, bold: true, padding_pct: 6 } },
      { key: "scan", type: "qr", x: 74, y: 60, w: 22, h: 30, z: 2, binding: { source: "content", scope: "shop" }, style: { bg_color: "#ffffff" } },
      { key: "clock", type: "clock", x: 70, y: 92, w: 30, h: 8, z: 2, binding: { source: "static" }, style: { bg_color: "#0a1628", text_color: "#ffffff", font_size_vh: 50 } },
    ],
  },
  {
    key: "menu-board",
    name: "Menu board",
    description: "Three editable text panels side by side",
    orientation: "landscape",
    design_width: 1920,
    design_height: 1080,
    zones: [
      { key: "title", type: "text", x: 0, y: 0, w: 100, h: 14, z: 2, binding: { source: "shop.name" }, style: { bg_color: "#0a1628", text_color: "#f59e0b", font_size_vh: 60, bold: true } },
      { key: "col_left", type: "text", x: 1, y: 16, w: 32, h: 82, z: 1, binding: { source: "content", scope: "shop" }, style: { bg_color: "#111a2e", text_color: "#ffffff", font_size_vh: 18, align: "left", padding_pct: 5 } },
      { key: "col_mid", type: "text", x: 34, y: 16, w: 32, h: 82, z: 1, binding: { source: "content", scope: "shop" }, style: { bg_color: "#111a2e", text_color: "#ffffff", font_size_vh: 18, align: "left", padding_pct: 5 } },
      { key: "col_right", type: "text", x: 67, y: 16, w: 32, h: 82, z: 1, binding: { source: "content", scope: "shop" }, style: { bg_color: "#111a2e", text_color: "#ffffff", font_size_vh: 18, align: "left", padding_pct: 5 } },
    ],
  },
  {
    key: "portrait-poster",
    name: "Portrait poster",
    description: "Vertical screen: media on top, message and QR below",
    orientation: "portrait",
    design_width: 1080,
    design_height: 1920,
    zones: [
      { key: "main", type: "playlist", x: 0, y: 0, w: 100, h: 62, z: 1, binding: { source: "device.playlist" } },
      { key: "message", type: "text", x: 0, y: 62, w: 100, h: 24, z: 2, binding: { source: "content", scope: "shop" }, style: { bg_gradient: { stops: ["#0a1628", "#1e3a5f"], angle: 180 }, text_color: "#ffffff", font_size_vh: 22, bold: true, padding_pct: 6 } },
      { key: "scan", type: "qr", x: 30, y: 88, w: 40, h: 11, z: 2, binding: { source: "content", scope: "shop" }, style: { bg_color: "#ffffff" } },
    ],
  },
];
