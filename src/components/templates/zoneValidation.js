// Client-side zone validation — mirrors cms-backend/template_api.py:validate_zones
// so designers see problems before the server rejects a save/publish.
import { ZONE_TYPES } from "./zoneTypes";

const ZONE_KEY_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

export function validateZones(zones) {
  const errors = [];
  const seen = new Set();
  zones.forEach((zone, i) => {
    const where = zone.key ? `"${zone.key}"` : `zone ${i + 1}`;
    if (!ZONE_KEY_RE.test(zone.key || "")) {
      errors.push(`${where}: key must be lowercase letters/numbers/dashes (a-z, 0-9, _, -)`);
    } else if (seen.has(zone.key)) {
      errors.push(`${where}: duplicate key`);
    } else {
      seen.add(zone.key);
    }
    if (!ZONE_TYPES[zone.type]) errors.push(`${where}: unknown type "${zone.type}"`);
    const { x, y, w, h } = zone;
    if ([x, y, w, h].some((v) => typeof v !== "number" || Number.isNaN(v))) {
      errors.push(`${where}: position/size must be numbers`);
    } else {
      if (x < 0 || y < 0 || x > 100 || y > 100) errors.push(`${where}: x/y out of 0–100`);
      if (w <= 0 || h <= 0 || w > 100 || h > 100) errors.push(`${where}: width/height out of range`);
      if (x + w > 100.001 || y + h > 100.001) errors.push(`${where}: extends past the canvas`);
    }
    const style = zone.style || {};
    ["bg_color", "text_color"].forEach((f) => {
      if (style[f] != null && !HEX_COLOR_RE.test(style[f])) {
        errors.push(`${where}: ${f.replace("_", " ")} must be a hex color like #0a1628`);
      }
    });
    const source = zone.binding?.source || "static";
    const allowed = ZONE_TYPES[zone.type]?.bindings || [];
    if (ZONE_TYPES[zone.type] && !allowed.includes(source)) {
      errors.push(`${where}: ${zone.type} zones can't bind to "${source}"`);
    }
  });
  return errors;
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// Round to 0.5% steps and snap to nearby edges of other zones / canvas anchors.
export function snapValue(value, targets, threshold = 1.2) {
  for (const t of targets) {
    if (Math.abs(value - t) <= threshold) return t;
  }
  return Math.round(value * 2) / 2;
}

export function snapTargetsFor(zones, excludeKey) {
  const xs = [0, 50, 100];
  const ys = [0, 50, 100];
  zones.forEach((z) => {
    if (z.key === excludeKey) return;
    xs.push(z.x, z.x + z.w);
    ys.push(z.y, z.y + z.h);
  });
  return { xs, ys };
}
