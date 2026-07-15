// Fill in the editable zones of the company's linked template.
// Used at shop scope (the default) and at device scope (override).
// The zone list is driven entirely by the template — nothing is hardcoded.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { T as theme } from "./theme";
import { ZONE_TYPES } from "./zoneTypes";
import {
  getShopContent, putShopContent, uploadShopMedia,
  getDeviceContent, putDeviceContent, uploadDeviceMedia, deleteDeviceContent,
  getCompanyContent, putCompanyContent, uploadCompanyMedia,
  getGroupContent, putGroupContent, uploadGroupMedia,
} from "./api";
import { apiGet, normalizeList } from "../../lib/api";

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,video/mp4";

export default function ZoneContentEditor({ scope, targetId, targetName, onClose, focusZoneKey }) {
  const isDevice = scope === "device";
  const isCompany = scope === "company";
  const isGroup = scope === "group";
  const [zones, setZones] = useState(null);
  const [content, setContent] = useState({});
  const [drafts, setDrafts] = useState({});     // zoneKey → payload being edited
  const [linked, setLinked] = useState(true);
  const [error, setError] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [progress, setProgress] = useState({});
  const fileRefs = useRef({});

  const load = useCallback(async () => {
    const res = isDevice
      ? await getDeviceContent(targetId)
      : isGroup
        ? await getGroupContent(targetId)
        : isCompany
          ? await getCompanyContent()
          : await getShopContent(targetId);
    if (!res.ok) { setError(`Could not load screen content: ${res.message}`); setZones([]); return; }
    setLinked(res.data.template_linked);
    setZones(res.data.content_zones || []);
    const loaded = {};
    Object.entries(res.data.content || {}).forEach(([k, v]) => { loaded[k] = v.payload || {}; });
    setContent(loaded);
    setDrafts(loaded);
    setError("");
  }, [isDevice, isGroup, isCompany, targetId]);
  useEffect(() => { load(); }, [load]);

  const draftOf = (key) => drafts[key] || {};
  const setDraft = (key, patch) =>
    setDrafts((d) => ({ ...d, [key]: { ...(d[key] || {}), ...patch } }));

  const save = async (zone) => {
    const key = zone.key;
    setBusyKey(key); setError(""); setSavedKey("");
    const payload = { ...draftOf(key) };
    // Never send server-managed fields back.
    delete payload.qr_generated_s3;
    const res = isDevice
      ? await putDeviceContent(targetId, key, payload)
      : isGroup
        ? await putGroupContent(targetId, key, payload)
        : isCompany
          ? await putCompanyContent(key, payload)
          : await putShopContent(targetId, key, payload);
    setBusyKey("");
    if (!res.ok) {
      const detail = res.data?.detail;
      const msgs = detail?.payload_errors?.join("; ") || res.message;
      setError(`Could not save “${key}”: ${msgs}`);
      return;
    }
    setContent((c) => ({ ...c, [key]: res.data.payload }));
    setDrafts((d) => ({ ...d, [key]: res.data.payload }));
    setSavedKey(key);
    setTimeout(() => setSavedKey((k) => (k === key ? "" : k)), 2500);
  };

  const upload = async (zone, file) => {
    if (!file) return;
    const key = zone.key;
    setBusyKey(key); setError(""); setProgress((p) => ({ ...p, [key]: 0 }));
    const fn = isDevice
      ? uploadDeviceMedia
      : isGroup
        ? uploadGroupMedia
        : isCompany
          ? (_target, key, file, onProgress) => uploadCompanyMedia(key, file, onProgress)
          : uploadShopMedia;
    const res = await fn(targetId, key, file, (pct) => setProgress((p) => ({ ...p, [key]: pct })));
    setBusyKey(""); setProgress((p) => ({ ...p, [key]: undefined }));
    if (!res.ok) {
      setError(`Upload failed for “${key}”: ${res.data?.detail || res.message}`);
      return;
    }
    setContent((c) => ({ ...c, [key]: res.data.payload }));
    setDrafts((d) => ({ ...d, [key]: res.data.payload }));
    setSavedKey(key);
    setTimeout(() => setSavedKey((k) => (k === key ? "" : k)), 2500);
  };

  const clearOverride = async (zone) => {
    setBusyKey(zone.key); setError("");
    const res = await deleteDeviceContent(targetId, zone.key);
    setBusyKey("");
    if (!res.ok) { setError(`Could not clear the override: ${res.message}`); return; }
    await load();
  };

  const lbl = { fontSize: 12, color: theme.textSecondary, display: "block", marginBottom: 4 };
  const inp = {
    width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, fontSize: 13,
    border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text,
  };
  const btn = (bg, fg = "#0a1628") => ({
    padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: "none", background: bg, color: fg, cursor: "pointer",
  });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.7)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(96vw, 700px)", maxHeight: "88vh", background: theme.card, color: theme.text, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", background: "#0a1628", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong style={{ fontSize: 15 }}>Screen content — {targetName}</strong>
            <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 2 }}>
              {isDevice ? "Overrides this device only; empty fields fall back to the shop" : isGroup ? "Applies to every device in this group, wherever it's located; overrides the location + company defaults" : isCompany ? "Company-wide defaults — used wherever no location or screen content is set" : "Applies to every device in this shop"}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: 6, width: 28, height: 28, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: 16, overflowY: "auto" }}>
          {error && (
            <div style={{ padding: 10, borderRadius: 8, background: "#fef2f2", color: "#dc2626", fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error" style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }}>✕</button>
            </div>
          )}
          {zones === null && <p style={{ color: theme.textSecondary, fontSize: 13 }}>Loading…</p>}
          {zones && !linked && (
            <p style={{ color: theme.textSecondary, fontSize: 13 }}>
              This company has no screen template linked, so there is no content to fill in. Ask the platform admin to link one.
            </p>
          )}
          {zones && linked && zones.length === 0 && (
            <p style={{ color: theme.textSecondary, fontSize: 13 }}>
              The linked template has no editable zones — everything on it is fixed or automatic.
            </p>
          )}

          {zones && linked && zones
            .filter((zone) => !focusZoneKey || zone.key === focusZoneKey)
            .map((zone) => {
            const def = ZONE_TYPES[zone.type] || {};
            const d = draftOf(zone.key);
            const saved = content[zone.key];
            const hasOverride = isDevice && !!saved;
            const busy = busyKey === zone.key;
            const pct = progress[zone.key];
            return (
              <div key={zone.key} style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginBottom: 12, background: theme.cardAlt }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 16 }}>{def.icon}</span>
                  <strong style={{ fontSize: 14 }}>{zone.key}</strong>
                  <span style={{ fontSize: 11, color: theme.textSecondary }}>{def.label}</span>
                  {isDevice && (
                    <span style={{ fontSize: 11, marginLeft: "auto", color: hasOverride ? theme.warning : theme.textSecondary }}>
                      {hasOverride ? "overriding the shop" : "inherited from shop"}
                    </span>
                  )}
                  {savedKey === zone.key && <span style={{ marginLeft: isDevice ? 8 : "auto", fontSize: 12, color: theme.success, fontWeight: 600 }}>✓ Saved</span>}
                </div>

                {/* QR: uploaded image | link (generate) | external image/video URL */}
                {zone.type === "qr" && (
                  <>
                    <label htmlFor={`qr-mode-${zone.key}`} style={lbl}>QR source</label>
                    <select id={`qr-mode-${zone.key}`} value={qrSourceOf(d)}
                      onChange={(e) => setDraft(zone.key, qrSourcePatch(e.target.value))}
                      style={{ ...inp, marginBottom: 10 }}>
                      <option value="upload">Upload a QR image</option>
                      <option value="link">Give a link — we generate the QR</option>
                      <option value="url">Paste an image/video URL</option>
                    </select>
                    {qrSourceOf(d) === "link" && (
                      <>
                        <label htmlFor={`qr-link-${zone.key}`} style={lbl}>Link (https://…)</label>
                        <input id={`qr-link-${zone.key}`} value={d.qr_link || ""} placeholder="https://example.com/menu"
                          onChange={(e) => setDraft(zone.key, { qr_link: e.target.value })} style={inp} />
                      </>
                    )}
                    {qrSourceOf(d) === "url" && (
                      <UrlField zone={zone} value={d.media_url || ""} theme={theme} lbl={lbl}
                        placeholder="https://cdn…/qr.png (or a video URL)"
                        onChange={(v) => setDraft(zone.key, { qr_mode: "image", media_url: v, media_type: guessType(v), media_s3: undefined })} />
                    )}
                    {qrSourceOf(d) === "upload" && (
                      <MediaField zone={zone} d={d} saved={saved} theme={theme} lbl={lbl} btn={btn}
                        busy={busy} pct={pct} fileRefs={fileRefs} onUpload={(f) => upload(zone, f)} />
                    )}
                  </>
                )}

                {/* Media zones: choose from library, OR upload, OR external URL */}
                {zone.type === "media" && (
                  <>
                    <label htmlFor={`media-src-${zone.key}`} style={lbl}>Source</label>
                    <select id={`media-src-${zone.key}`} value={d.media_url !== undefined ? "url" : "upload"}
                      onChange={(e) => setDraft(zone.key, e.target.value === "url" ? { media_url: "", media_s3: undefined } : { media_url: undefined })}
                      style={{ ...inp, marginBottom: 10 }}>
                      <option value="upload">Choose from library or upload</option>
                      <option value="url">Paste an image/video URL</option>
                    </select>
                    {d.media_url !== undefined ? (
                      <>
                        <UrlField zone={zone} value={d.media_url || ""} theme={theme} lbl={lbl}
                          placeholder="https://cdn…/promo.jpg or .mp4"
                          onChange={(v) => setDraft(zone.key, { media_url: v, media_type: guessType(v), media_s3: undefined })} />
                        <div style={{ marginTop: 8 }}>
                          <label htmlFor={`media-kind-${zone.key}`} style={lbl}>This link is a…</label>
                          <select id={`media-kind-${zone.key}`}
                            value={d.media_type === "video" ? "video" : "image"}
                            onChange={(e) => setDraft(zone.key, { media_type: e.target.value })}
                            style={{ ...inp, marginBottom: 4 }}>
                            <option value="image">Image (still picture)</option>
                            <option value="video">Video (plays &amp; loops)</option>
                          </select>
                          <div style={{ fontSize: 11.5, color: theme.textSecondary }}>
                            Auto-set from the link’s extension. Pick <strong>Video</strong> if your link streams a video but doesn’t end in .mp4/.webm — otherwise it shows as a still image.
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <LibraryPicker
                          zoneKey={zone.key} theme={theme} lbl={lbl} inp={inp}
                          selectedS3={d.media_s3}
                          onPick={(item) => setDraft(zone.key, {
                            media_s3: item.s3_link, media_type: item.media_type,
                            media_url: undefined,
                          })}
                        />
                        <div style={{ fontSize: 11.5, color: theme.textSecondary, margin: "8px 0" }}>— or upload a new file —</div>
                        <MediaField zone={zone} d={d} saved={saved} theme={theme} lbl={lbl} btn={btn}
                          busy={busy} pct={pct} fileRefs={fileRefs} onUpload={(f) => upload(zone, f)} />
                      </>
                    )}
                    <div style={{ marginTop: 10 }}>
                      <label htmlFor={`fit-${zone.key}`} style={lbl}>Fit</label>
                      <select id={`fit-${zone.key}`} value={d.fit_mode || "cover"}
                        onChange={(e) => setDraft(zone.key, { fit_mode: e.target.value })}
                        style={inp}>
                        <option value="cover">Fill the box (crops wide/tall edges)</option>
                        <option value="contain">Show the whole image (no crop)</option>
                      </select>
                      <div style={{ fontSize: 11.5, color: theme.textSecondary, marginTop: 4 }}>
                        Pick “Show the whole image” so a wide image isn’t cut off.
                      </div>
                    </div>
                  </>
                )}

                {/* Text / ticker zones: text + text color + background (color/gradient/image) */}
                {(zone.type === "text" || zone.type === "ticker") && (
                  <>
                    <label htmlFor={`txt-${zone.key}`} style={lbl}>Text</label>
                    <input id={`txt-${zone.key}`} value={d.text || ""} maxLength={5000}
                      onChange={(e) => setDraft(zone.key, { text: e.target.value })}
                      style={{ ...inp, marginBottom: 10 }} placeholder="Shown on the screen" />
                    <div style={{ marginBottom: 10 }}>
                      <label htmlFor={`fg-${zone.key}`} style={lbl}>Text color</label>
                      <input id={`fg-${zone.key}`} type="color" value={d.text_color || "#ffffff"}
                        onChange={(e) => setDraft(zone.key, { text_color: e.target.value })}
                        style={{ width: 44, height: 30, padding: 0, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, background: theme.inputBg, cursor: "pointer" }} />
                    </div>
                    <BgControl zoneKey={zone.key} d={d} setDraft={setDraft} theme={theme} lbl={lbl} inp={inp} />
                  </>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                  <button onClick={() => save(zone)} disabled={busy} style={btn(theme.accent)}>
                    {busy ? "Saving…" : "Save"}
                  </button>
                  {hasOverride && (
                    <button onClick={() => clearOverride(zone)} disabled={busy} style={btn("transparent", theme.danger)}>
                      Clear override (use shop content)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "10px 16px", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: theme.textSecondary }}>Screens pick up changes within ~30 seconds.</span>
          <button onClick={onClose} style={btn(theme.cardAlt, theme.text)}>Done</button>
        </div>
      </div>
    </div>
  );
}

// Pick an already-uploaded video/image from the Media library and reference it
// by its S3 object (the player presigns media_s3). Loaded once, shared shape:
// { name, s3_link, media_type }.
function LibraryPicker({ zoneKey, theme, lbl, inp, selectedS3, onPick }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiGet("/videos", { params: { limit: 500, offset: 0 } }),
      apiGet("/advertisements", { params: { limit: 500, offset: 0 } }),
    ]).then(([v, a]) => {
      if (!alive) return;
      if (!v.ok && !a.ok) { setError(v.message || a.message); setItems([]); return; }
      const vids = (v.ok ? normalizeList(v.data, "items").items : []).map((x) => ({
        name: x.video_name, s3_link: x.s3_link,
        media_type: (x.content_type === "image" ? "image" : "video"),
      }));
      const ads = (a.ok ? normalizeList(a.data, "items").items : []).map((x) => ({
        name: x.ad_name, s3_link: x.s3_link, media_type: "image",
      }));
      setItems([...vids, ...ads].filter((i) => i.s3_link));
    });
    return () => { alive = false; };
  }, []);

  return (
    <div style={{ marginBottom: 6 }}>
      <label htmlFor={`lib-${zoneKey}`} style={lbl}>Choose from library</label>
      <select
        id={`lib-${zoneKey}`}
        value={selectedS3 || ""}
        disabled={items === null}
        onChange={(e) => {
          const it = (items || []).find((i) => i.s3_link === e.target.value);
          if (it) onPick(it);
        }}
        style={inp}
      >
        <option value="">{items === null ? "Loading library…" : "Select a video or image…"}</option>
        {(items || []).map((i) => (
          <option key={i.s3_link} value={i.s3_link}>
            {i.media_type === "video" ? "🎬 " : "🖼️ "}{i.name}
          </option>
        ))}
      </select>
      {error && <div style={{ fontSize: 11.5, color: theme.danger, marginTop: 4 }}>Couldn't load library: {error}</div>}
      {items && items.length === 0 && !error && (
        <div style={{ fontSize: 11.5, color: theme.textSecondary, marginTop: 4 }}>
          Your Media library is empty — upload videos/images under Media first.
        </div>
      )}
    </div>
  );
}

function MediaField({ zone, d, saved, theme, lbl, btn, busy, pct, fileRefs, onUpload }) {
  const current = saved?.media_s3 || d.media_s3;
  return (
    <div>
      <label style={lbl}>{d.qr_mode === "image" ? "QR image" : "Image or video"}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input
          ref={(el) => { fileRefs.current[zone.key] = el; }}
          id={`file-${zone.key}`}
          type="file"
          accept={ACCEPT}
          onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ""; }}
          style={{ fontSize: 12, color: theme.text }}
        />
        {busy && pct != null && <span style={{ fontSize: 12, color: theme.textSecondary }}>Uploading {pct}%</span>}
      </div>
      {current ? (
        <p style={{ fontSize: 11.5, color: theme.success, margin: "6px 0 0" }}>
          ✓ {saved?.media_type === "video" ? "Video" : "Image"} uploaded — pick a new file to replace it
        </p>
      ) : (
        <p style={{ fontSize: 11.5, color: theme.textSecondary, margin: "6px 0 0" }}>
          Nothing uploaded yet — this zone stays blank on screen.
        </p>
      )}
    </div>
  );
}

// ── helpers for the richer content sources ──

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|mkv)(\?|#|$)/i;
export function guessType(url) {
  return VIDEO_EXT.test(url || "") ? "video" : "image";
}
function qrSourceOf(d) {
  if (d.qr_mode === "link" || d.qr_link) return "link";
  if (d.media_url !== undefined) return "url";
  return "upload";
}
function qrSourcePatch(source) {
  if (source === "link") return { qr_mode: "link", media_url: undefined, media_s3: undefined };
  if (source === "url") return { qr_mode: "image", qr_link: undefined, media_s3: undefined, media_url: "" };
  return { qr_mode: "image", qr_link: undefined, media_url: undefined }; // upload
}

function UrlField({ zone, value, placeholder, theme, lbl, onChange }) {
  const bad = value && !/^https?:\/\//i.test(value);
  return (
    <div>
      <label htmlFor={`url-${zone.key}`} style={lbl}>Image / video URL</label>
      <input id={`url-${zone.key}`} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, fontSize: 13,
                 border: `1px solid ${bad ? theme.danger : theme.inputBorder}`, background: theme.inputBg, color: theme.text }} />
      {bad && <p style={{ fontSize: 11.5, color: theme.danger, margin: "4px 0 0" }}>Must start with http:// or https://</p>}
    </div>
  );
}

function BgControl({ zoneKey, d, setDraft, theme, lbl, inp }) {
  const mode = d.bg_image_url ? "image" : d.bg_gradient ? "gradient" : "color";
  const grad = d.bg_gradient || { stops: ["#0a1628", "#f59e0b"], angle: 135 };
  const swatch = { width: 44, height: 30, padding: 0, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, background: theme.inputBg, cursor: "pointer" };
  const setMode = (m) => {
    if (m === "color") setDraft(zoneKey, { bg_color: d.bg_color || "#111827", bg_gradient: undefined, bg_image_url: undefined });
    else if (m === "gradient") setDraft(zoneKey, { bg_gradient: grad, bg_color: undefined, bg_image_url: undefined });
    else setDraft(zoneKey, { bg_image_url: "", bg_color: undefined, bg_gradient: undefined });
  };
  return (
    <div>
      <label htmlFor={`bgtype-${zoneKey}`} style={lbl}>Background</label>
      <select id={`bgtype-${zoneKey}`} value={mode} onChange={(e) => setMode(e.target.value)}
        style={{ ...inp, marginBottom: 8 }}>
        <option value="color">Solid color</option>
        <option value="gradient">Gradient</option>
        <option value="image">Image</option>
      </select>
      {mode === "color" && (
        <input aria-label="Background color" type="color" value={d.bg_color || "#111827"}
          onChange={(e) => setDraft(zoneKey, { bg_color: e.target.value })} style={swatch} />
      )}
      {mode === "gradient" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input aria-label="Gradient start" type="color" value={grad.stops[0]}
            onChange={(e) => setDraft(zoneKey, { bg_gradient: { ...grad, stops: [e.target.value, grad.stops[1]] } })} style={swatch} />
          <input aria-label="Gradient end" type="color" value={grad.stops[1] || "#f59e0b"}
            onChange={(e) => setDraft(zoneKey, { bg_gradient: { ...grad, stops: [grad.stops[0], e.target.value] } })} style={swatch} />
          <label style={{ fontSize: 12, color: theme.textSecondary }}>Angle
            <input type="range" min="0" max="360" value={grad.angle ?? 135}
              onChange={(e) => setDraft(zoneKey, { bg_gradient: { ...grad, angle: Number(e.target.value) } })}
              style={{ verticalAlign: "middle", marginLeft: 6 }} /> {grad.angle ?? 135}°
          </label>
          <span style={{ width: 60, height: 26, borderRadius: 6, border: `1px solid ${theme.inputBorder}`,
            background: `linear-gradient(${grad.angle ?? 135}deg, ${grad.stops[0]}, ${grad.stops[1] || "#f59e0b"})` }} />
        </div>
      )}
      {mode === "image" && (
        <input aria-label="Background image URL" value={d.bg_image_url || ""} placeholder="https://cdn…/background.jpg"
          onChange={(e) => setDraft(zoneKey, { bg_image_url: e.target.value })} style={inp} />
      )}
    </div>
  );
}
