// A to-scale visual of a template's zones. Content-editable zones (binding
// source "content") are clickable and show whether they have content at the
// current scope; other zones (playlist / entity name / static) are shown
// dimmed with a hint so operators see the whole layout. Percent geometry —
// the same model the players render, so this preview matches the screen.
import React from "react";
import { zonePixelSize } from "./zoneTypes";

const ZONE_TONE = {
  playlist: { bg: "rgba(16,185,129,0.22)", border: "var(--success)" },
  text: { bg: "rgba(59,130,246,0.22)", border: "var(--info)" },
  ticker: { bg: "rgba(59,130,246,0.16)", border: "var(--info)" },
  media: { bg: "rgba(245,158,11,0.22)", border: "var(--accent)" },
  qr: { bg: "rgba(148,163,184,0.25)", border: "var(--border-strong)" },
  clock: { bg: "rgba(148,163,184,0.18)", border: "var(--border-strong)" },
};

const TYPE_LABEL = {
  playlist: "▶ Plays the rotation",
  text: "Text",
  ticker: "Ticker",
  media: "Image / video",
  qr: "QR code",
  clock: "Clock",
};

// Mirrors the backend's takes_tenant_content(): content-bound zones, plus
// text/ticker zones on EVERY binding — their designed/bound text is only the
// default and an explicit per-scope text overrides it.
function isEditable(z) {
  const src = z.binding?.source || "static";
  return src === "content" || z.type === "text" || z.type === "ticker";
}

const NAME_PLACEHOLDER = {
  "company.name": "🏢 Company name",
  "shop.name": "📍 Location name",
  "device.name": "🖥 Screen name",
};

function runsText(runs) {
  return (runs || []).map((r) => r && r.text).filter(Boolean).join("  ·  ");
}

// What a zone will actually show, so the layout mirrors the configured screen.
// Static/designer text lives on the zone (z.content); content-bound text comes
// from the current-scope payload; name-bound zones show a resolved-per-screen
// placeholder. Returns { text, muted } or null when there's nothing to preview.
function previewOf(z, payload) {
  const src = z.binding?.source || "static";
  const zc = z.content || {};
  if (z.type === "text" || z.type === "ticker" || z.type === "clock") {
    if (z.type !== "clock") {
      // Precedence mirrors the backend resolver: tenant text set at this scope
      // beats the designed items, which beat the bound-name/static default.
      if (payload?.text) return { text: payload.text };
      if (payload?.runs?.length) return { text: runsText(payload.runs) };
      if (Array.isArray(zc.runs) && zc.runs.length) return { text: runsText(zc.runs) };
      if (NAME_PLACEHOLDER[src]) return { text: NAME_PLACEHOLDER[src], muted: true };
      if (zc.text) return { text: zc.text };
      return null;
    }
    if (NAME_PLACEHOLDER[src]) return { text: NAME_PLACEHOLDER[src], muted: true };
    return { text: "🕐 " + (z.style?.format || "HH:mm"), muted: true };
  }
  if (z.type === "media") {
    if (payload?.media_url || payload?.media_s3 || payload?.media_type) {
      return { text: payload.media_type === "video" ? "🎬 Video set" : "🖼 Image set", muted: true };
    }
    return null;
  }
  if (z.type === "qr") {
    if (payload && Object.keys(payload).length) return { text: "▦ QR set", muted: true };
    return null;
  }
  return null;
}

// readOnly: viewer mode — the layout renders with all its badges but nothing
// is clickable. pendingKeys: zones with a change waiting for approval at the
// current scope/target (amber ⏳ chip).
export default function TemplateMap({ template, contentByKey = {}, overrides = {}, selectedKey, onZoneClick, readOnly = false, pendingKeys }) {
  const zones = template?.zones || [];
  const dw = template?.design_width || 1920;
  const dh = template?.design_height || 1080;
  const landscape = dw >= dh;
  // Keep the preview a sensible size; scale by aspect.
  const boardW = landscape ? 520 : 300;
  const boardH = Math.round((boardW * dh) / dw);

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div
        role="img"
        aria-label={`Template layout, ${zones.length} zones`}
        style={{
          position: "relative", width: boardW, height: boardH, flexShrink: 0,
          background: "var(--brand-navy)", borderRadius: 10, overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        {zones.map((z) => {
          const tone = ZONE_TONE[z.type] || ZONE_TONE.text;
          const editable = isEditable(z) && !readOnly;
          const hasContent = !!contentByKey[z.key];
          const selected = z.key === selectedKey;
          const preview = previewOf(z, contentByKey[z.key]);
          const pin = overrides[z.key];
          const pinCount = pin ? (pin.shops?.length || 0) + (pin.devices?.length || 0) + (pin.groups?.length || 0) : 0;
          const isPending = !!pendingKeys?.has?.(z.key);
          const px = zonePixelSize(z, dw, dh);
          const pxNote = px ? ` — ${px.label} on a ${dw}×${dh} screen` : "";
          return (
            <button
              key={z.key}
              type="button"
              disabled={!editable}
              onClick={() => editable && onZoneClick?.(z.key)}
              title={editable ? `Set content for "${z.key}"${pxNote}`
                : readOnly && isEditable(z) ? `"${z.key}"${pxNote}`
                : `${TYPE_LABEL[z.type] || z.type} — set in the designer${pxNote}`}
              style={{
                position: "absolute",
                left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%`,
                background: tone.bg,
                border: `2px solid ${selected ? "var(--accent)" : tone.border}`,
                borderRadius: 4, padding: 4, margin: 0,
                cursor: editable ? "pointer" : "default",
                color: "#fff", textAlign: "center", overflow: "hidden",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 2, fontSize: 11, lineHeight: 1.2,
                opacity: isEditable(z) ? 1 : 0.7,
                boxShadow: selected ? "0 0 0 3px rgba(245,158,11,0.4)" : "none",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: preview ? 9.5 : 11, opacity: preview ? 0.72 : 1, textShadow: "0 1px 2px rgba(0,0,0,0.6)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
                {z.key}
              </span>
              {preview ? (
                <span
                  title={preview.text}
                  style={{
                    fontSize: 11, fontWeight: 600, lineHeight: 1.2, maxWidth: "100%",
                    opacity: preview.muted ? 0.85 : 1, textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    overflow: "hidden", wordBreak: "break-word",
                  }}
                >
                  {preview.text}
                </span>
              ) : (
                <span style={{ fontSize: 9.5, opacity: 0.85 }}>{TYPE_LABEL[z.type] || z.type}</span>
              )}
              {isEditable(z) && (
                <span
                  style={{
                    fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
                    background: hasContent ? "var(--success)"
                      : pinCount > 0 ? "var(--accent)" : "rgba(255,255,255,0.9)",
                    color: hasContent ? "#062" : pinCount > 0 ? "#0a1628" : "var(--brand-navy)",
                  }}
                  title={!hasContent && pinCount > 0
                    ? `No company-wide content, but ${pinCount} screen/group/location(s) have their own (e.g. set via Excel or per-screen edits) — the box IS showing content there.`
                    : undefined}
                >
                  {hasContent ? "✓ set"
                    : pinCount > 0 ? `✓ on ${pinCount} screen${pinCount > 1 ? "s" : ""}`
                    : readOnly ? "empty" : "+ add"}
                </span>
              )}
              {isPending && (
                <span
                  title="A change for this box is waiting for a manager/admin to approve it"
                  style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 10,
                           background: "var(--warn, #f59e0b)", color: "#0a1628" }}
                >
                  ⏳ pending
                </span>
              )}
              {isEditable(z) && px && (
                <span style={{ fontSize: 8.5, opacity: 0.85, fontVariantNumeric: "tabular-nums", textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
                  {px.w}×{px.h}px
                </span>
              )}
              {hasContent && pinCount > 0 && (
                <span
                  title={`Pinned on ${pinCount} screen/group/location override(s) — these win over the company setting there`}
                  style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 10, background: "var(--accent)", color: "#0a1628" }}
                >
                  📌 {pinCount}
                </span>
              )}
            </button>
          );
        })}
        {zones.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
            This template has no zones.
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 260 }}>
        <p style={{ marginTop: 0 }}>
          {readOnly ? (
            <>
              You can view what each box shows, but your role can't change content.{" "}
              <strong>✓ set</strong> means content exists at this level; <strong>✓ on N screens</strong>{" "}
              means content lives only on specific screens/groups/locations.
            </>
          ) : (
            <>
              Click a highlighted box to set what it shows. <strong>✓ set</strong> means content
              exists at this level; <strong>✓ on N screens</strong> means content lives only on
              specific screens/groups/locations (e.g. from an Excel upload) — set it here to also
              cover the rest; <strong>+ add</strong> is empty everywhere at or above this level.
            </>
          )}
        </p>
        <p>
          Dimmed boxes aren't editable here — the <em>rotation</em> plays the screen's playlist, and
          clock zones are fixed in the designer. Text boxes are always editable: setting a text
          overrides what the designer composed (or the bound name) on the screens at this level.
        </p>
        <p style={{ marginBottom: 0 }}>
          Box sizes are shown for a <strong>{dw}×{dh}</strong> screen (the template's design size) —
          make images/videos that size for the sharpest result. Boxes scale in % on other resolutions.
        </p>
      </div>
    </div>
  );
}
