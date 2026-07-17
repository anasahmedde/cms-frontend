// Null-safe display formatters. Every function returns an em dash for
// null/undefined/NaN input so callers never have to guard (fixes the legacy
// uptime null crashes).

const DASH = "—";

function toDate(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "just now" / "N min ago" / "N h ago" / "N d ago", falling back to a date
// for anything older than a week. Accepts ISO strings, Date, or null.
export function timeAgo(value) {
  const d = toDate(value);
  if (!d) return DASH;
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)} d ago`;
  return d.toLocaleDateString();
}

export function formatBytes(bytes) {
  const n = Number(bytes);
  if (bytes == null || bytes === "" || !Number.isFinite(n) || n < 0) return DASH;
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / 1024 ** i;
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

// Takes a duration in seconds.
export function formatDuration(seconds) {
  const n = Number(seconds);
  if (seconds == null || seconds === "" || !Number.isFinite(n) || n < 0) return DASH;
  const s = Math.floor(n);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return DASH;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Takes a 0-100 number; renders at most one decimal place.
export function formatPercent(value) {
  const n = Number(value);
  if (value == null || value === "" || !Number.isFinite(n)) return DASH;
  return `${Math.round(n * 10) / 10}%`;
}
