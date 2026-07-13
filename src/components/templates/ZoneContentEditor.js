// Fill in the editable zones of the company's linked template.
// Used at shop scope (the default) and at device scope (override).
// The zone list is driven entirely by the template — nothing is hardcoded.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../../App";
import { ZONE_TYPES } from "./zoneTypes";
import {
  getShopContent, putShopContent, uploadShopMedia,
  getDeviceContent, putDeviceContent, uploadDeviceMedia, deleteDeviceContent,
} from "./api";

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,video/mp4";

export default function ZoneContentEditor({ scope, targetId, targetName, onClose }) {
  const { theme } = useTheme();
  const isDevice = scope === "device";
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
    const res = isDevice ? await getDeviceContent(targetId) : await getShopContent(targetId);
    if (!res.ok) { setError(`Could not load screen content: ${res.message}`); setZones([]); return; }
    setLinked(res.data.template_linked);
    setZones(res.data.content_zones || []);
    const loaded = {};
    Object.entries(res.data.content || {}).forEach(([k, v]) => { loaded[k] = v.payload || {}; });
    setContent(loaded);
    setDrafts(loaded);
    setError("");
  }, [isDevice, targetId]);
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
    const fn = isDevice ? uploadDeviceMedia : uploadShopMedia;
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
              {isDevice ? "Overrides this device only; empty fields fall back to the shop" : "Applies to every device in this shop"}
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

          {zones && linked && zones.map((zone) => {
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

                {/* QR: image | link | media */}
                {zone.type === "qr" && (
                  <>
                    <label htmlFor={`qr-mode-${zone.key}`} style={lbl}>QR source</label>
                    <select id={`qr-mode-${zone.key}`} value={d.qr_mode || "image"}
                      onChange={(e) => setDraft(zone.key, { qr_mode: e.target.value })}
                      style={{ ...inp, marginBottom: 10 }}>
                      <option value="image">Upload a QR image</option>
                      <option value="link">Give a link — we generate the QR</option>
                      <option value="media">Show an image/video instead</option>
                    </select>
                    {d.qr_mode === "link" ? (
                      <>
                        <label htmlFor={`qr-link-${zone.key}`} style={lbl}>Link (https://…)</label>
                        <input id={`qr-link-${zone.key}`} value={d.qr_link || ""} placeholder="https://example.com/menu"
                          onChange={(e) => setDraft(zone.key, { qr_link: e.target.value })} style={inp} />
                      </>
                    ) : (
                      <MediaField zone={zone} d={d} saved={saved} theme={theme} lbl={lbl} btn={btn}
                        busy={busy} pct={pct} fileRefs={fileRefs} onUpload={(f) => upload(zone, f)} />
                    )}
                  </>
                )}

                {/* Media zones */}
                {zone.type === "media" && (
                  <MediaField zone={zone} d={d} saved={saved} theme={theme} lbl={lbl} btn={btn}
                    busy={busy} pct={pct} fileRefs={fileRefs} onUpload={(f) => upload(zone, f)} />
                )}

                {/* Text / ticker zones */}
                {(zone.type === "text" || zone.type === "ticker") && (
                  <>
                    <label htmlFor={`txt-${zone.key}`} style={lbl}>Text</label>
                    <input id={`txt-${zone.key}`} value={d.text || ""} maxLength={5000}
                      onChange={(e) => setDraft(zone.key, { text: e.target.value })}
                      style={{ ...inp, marginBottom: 10 }} placeholder="Shown on the screen" />
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label htmlFor={`bg-${zone.key}`} style={lbl}>Background</label>
                        <input id={`bg-${zone.key}`} type="color" value={d.bg_color || "#111827"}
                          onChange={(e) => setDraft(zone.key, { bg_color: e.target.value })}
                          style={{ width: 44, height: 30, padding: 0, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, background: theme.inputBg, cursor: "pointer" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label htmlFor={`fg-${zone.key}`} style={lbl}>Text color</label>
                        <input id={`fg-${zone.key}`} type="color" value={d.text_color || "#ffffff"}
                          onChange={(e) => setDraft(zone.key, { text_color: e.target.value })}
                          style={{ width: 44, height: 30, padding: 0, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, background: theme.inputBg, cursor: "pointer" }} />
                      </div>
                    </div>
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
