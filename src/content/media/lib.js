// Media Library vocabulary. One page, two legacy API stacks kept intact
// underneath: kind "video" = the video entity (/videos, may hold video/image/
// html/pdf content), kind "image" = the advertisement entity (/advertisements,
// images only). Everything here is presentation-layer glue — no path changes.
import { Film, Image as ImageIcon, FileCode2, FileText } from "lucide-react";
import { apiGet, normalizeList } from "../../lib/api";

export const LOAD_LIMIT = 200;

export const KINDS = {
  video: {
    kind: "video",
    label: "Playlist",
    plural: "playlist media",
    nameField: "video_name",
    listPath: "/videos",
    uploadPath: "/upload_video",
    itemPath: (name) => `/video/${encodeURIComponent(name)}`,
    accept: "video/*,image/*,.html,.htm,.pdf",
    acceptHint: "Video (MP4, WebM, MOV), images (JPG, PNG, GIF, WebP), HTML, PDF",
    namePlaceholder: "e.g. promo_video_summer",
  },
  image: {
    kind: "image",
    label: "Layout image",
    plural: "layout images",
    nameField: "ad_name",
    listPath: "/advertisements",
    uploadPath: "/upload_advertisement",
    itemPath: (name) => `/advertisement/${encodeURIComponent(name)}`,
    accept: "image/jpeg,image/png,image/gif,image/webp",
    acceptHint: "JPG, PNG, GIF, WebP",
    namePlaceholder: "e.g. summer_promo_banner",
  },
};

export const ROTATIONS = [0, 90, 180, 270];

export const FIT_OPTIONS = [
  { value: "cover", label: "Cover (fill screen)", desc: "Fills the screen, may crop edges" },
  { value: "contain", label: "Contain (show all)", desc: "Shows everything, may add black bars" },
  { value: "fill", label: "Fill (stretch)", desc: "Stretches to fill, may distort" },
  { value: "none", label: "Original size", desc: "No scaling applied" },
];

export const FIT_LABELS = { cover: "Cover", contain: "Contain", fill: "Fill", none: "Original" };

export const TYPE_ICONS = { video: Film, image: ImageIcon, html: FileCode2, pdf: FileText };
export const TYPE_TONES = { video: "info", image: "success", html: "warn", pdf: "danger" };

const IMAGE_MIME_WHITELIST = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export function isValidImageFile(file) {
  return !!file && IMAGE_MIME_WHITELIST.includes(file.type);
}

export function fileNameSansExt(filename) {
  return (filename || "").replace(/\.[^/.]+$/, "");
}

// Effective content type: advertisement items are always images; video-stack
// items carry a real content_type EXCEPT that legacy image rows were backfilled
// to 'video' (the column's default). So when content_type is missing or the
// generic 'video', fall back to the S3 file extension — an image uploaded to the
// video stack still has a .jpg/.png object — so it classifies as an image even
// on a not-yet-migrated row. (The backend backfill fixes the stored value too;
// this keeps the UI correct in the meantime and for any edge case.)
export function contentTypeOf(item) {
  if (!item) return "video";
  if (item.kind === "image") return "image";
  const ct = item.content_type;
  if (ct && ct !== "video") return ct; // explicit image / html / pdf — trust it
  const byExt = inferContentType(item.s3_link || item.video_name || item.name || "");
  return byExt !== "video" ? byExt : (ct || "video");
}

// Mirrors the backend's _detect_video_content_type so the upload form can
// show the right fields (e.g. display duration) before the server answers.
export function inferContentType(filename) {
  const m = (filename || "").toLowerCase().match(/\.[^.]+$/);
  const ext = m ? m[0] : "";
  if ([".mp4", ".webm", ".mov", ".avi", ".mkv"].includes(ext)) return "video";
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return "image";
  if ([".html", ".htm"].includes(ext)) return "html";
  if (ext === ".pdf") return "pdf";
  return "video";
}

export function normalizeItem(raw, kind) {
  return { ...raw, kind, name: raw[KINDS[kind].nameField] };
}

export async function fetchMediaList(kind, q) {
  const meta = KINDS[kind];
  const params = { limit: LOAD_LIMIT, offset: 0 };
  if (q) params.q = q;
  const res = await apiGet(meta.listPath, { params });
  if (!res.ok) return res;
  const { items } = normalizeList(res.data, "items");
  return { ok: true, items: items.map((raw) => normalizeItem(raw, kind)) };
}

// Presigned playback URL with the legacy raw-http s3_link fallback.
export async function fetchPresignedUrl(item) {
  const res = await apiGet(`${KINDS[item.kind].itemPath(item.name)}/presign`);
  if (res.ok) {
    const url = res.data?.url || res.data?.presigned_url;
    if (url) return { ok: true, url };
  }
  if (item.s3_link && item.s3_link.startsWith("http")) return { ok: true, url: item.s3_link };
  return { ok: false, message: res.ok ? "The server returned no playable link." : res.message };
}

// The upload response echoes the name you asked for, but the stored record
// gets a "-{company}" suffix appended server-side. Resolve the real stored
// name by id so the success toast and follow-up calls target the actual row.
export async function resolveStoredName(kind, uploadedId, requestedName) {
  const meta = KINDS[kind];
  const res = await apiGet(meta.listPath, {
    params: { q: requestedName, limit: 50, offset: 0 },
  });
  if (res.ok) {
    const { items } = normalizeList(res.data, "items");
    const match = items.find((it) => it.id === uploadedId);
    if (match) return match[meta.nameField];
  }
  return requestedName;
}
