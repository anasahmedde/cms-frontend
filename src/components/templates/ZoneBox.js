// A single zone on the designer canvas: pointer-drag to move, 8 handles to resize,
// with snapping to canvas anchors and other zones' edges.
import React, { useRef } from "react";
import { ZONE_TYPES, zoneColor, zonePixelSize } from "./zoneTypes";
import { clamp, snapValue } from "./zoneValidation";

const HANDLES = [
  { id: "nw", x: 0, y: 0, cursor: "nwse-resize" },
  { id: "n",  x: 0.5, y: 0, cursor: "ns-resize" },
  { id: "ne", x: 1, y: 0, cursor: "nesw-resize" },
  { id: "e",  x: 1, y: 0.5, cursor: "ew-resize" },
  { id: "se", x: 1, y: 1, cursor: "nwse-resize" },
  { id: "s",  x: 0.5, y: 1, cursor: "ns-resize" },
  { id: "sw", x: 0, y: 1, cursor: "nesw-resize" },
  { id: "w",  x: 0, y: 0.5, cursor: "ew-resize" },
];

export function zonePreviewText(zone) {
  const source = zone.binding?.source || "static";
  if (source === "device.playlist") return "▶ Device playlist";
  if (source === "shop.name") return "«Shop name»";
  if (source === "company.name") return "«Company name»";
  if (source === "device.name") return "«Device name»";
  if (zone.type === "qr") return "▦ QR code";
  if (zone.type === "clock") return "🕐 12:45";
  if (zone.type === "media") return "🖼 Shop image/video";
  if (source === "content") return "✏️ Shop content";
  return zone.content?.text || "Text";
}

export default function ZoneBox({
  zone, index, selected, canvasRef, snapTargets, designWidth, designHeight,
  onSelect, onChange, onGestureStart, onGestureEnd, onEditRuns,
}) {
  const gesture = useRef(null);

  const pctPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const startGesture = (e, mode) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(zone.key);
    onGestureStart();
    gesture.current = { mode, start: pctPoint(e), zone: { x: zone.x, y: zone.y, w: zone.w, h: zone.h } };
    e.target.setPointerCapture(e.pointerId);
  };

  const moveGesture = (e) => {
    if (!gesture.current) return;
    const { mode, start, zone: z0 } = gesture.current;
    const p = pctPoint(e);
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    const noSnap = e.altKey;
    const sx = (v) => (noSnap ? Math.round(v * 10) / 10 : snapValue(v, snapTargets.xs));
    const sy = (v) => (noSnap ? Math.round(v * 10) / 10 : snapValue(v, snapTargets.ys));

    if (mode === "move") {
      const x = clamp(sx(z0.x + dx), 0, 100 - z0.w);
      const y = clamp(sy(z0.y + dy), 0, 100 - z0.h);
      onChange({ x, y });
      return;
    }
    // Resize: adjust the edges named by the handle id.
    let { x, y, w, h } = z0;
    if (mode.includes("e")) w = clamp(sx(z0.x + z0.w + dx) - z0.x, 2, 100 - z0.x);
    if (mode.includes("s")) h = clamp(sy(z0.y + z0.h + dy) - z0.y, 2, 100 - z0.y);
    if (mode.includes("w")) {
      const newX = clamp(sx(z0.x + dx), 0, z0.x + z0.w - 2);
      w = z0.w + (z0.x - newX);
      x = newX;
    }
    if (mode.includes("n")) {
      const newY = clamp(sy(z0.y + dy), 0, z0.y + z0.h - 2);
      h = z0.h + (z0.y - newY);
      y = newY;
    }
    onChange({ x, y, w, h });
  };

  const endGesture = (e) => {
    if (!gesture.current) return;
    gesture.current = null;
    try { e.target.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    onGestureEnd();
  };

  const st = zone.style || {};
  const grad = st.bg_gradient;
  const background = st.bg_image_url
    ? `url(${st.bg_image_url}) center / cover no-repeat`
    : grad?.stops?.length
      ? `linear-gradient(${grad.angle ?? 135}deg, ${grad.stops.join(", ")})`
      : st.bg_color || zoneColor(index);
  const color = st.text_color || "#ffffff";
  const def = ZONE_TYPES[zone.type] || {};
  const isTexty = zone.type === "text" || zone.type === "ticker" || zone.type === "clock";
  const runs = Array.isArray(zone.content?.runs) ? zone.content.runs : null;
  // font_size_vh is % of SCREEN height; the canvas is a scale model of it.
  const previewFontPct = Math.max(9, ((st.font_size_vh ?? 50) / 100) * (zone.h || 10) * 2.2);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Zone ${zone.key} (${def.label || zone.type})`}
      onPointerDown={(e) => startGesture(e, "move")}
      onPointerMove={moveGesture}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(zone.key); }}
      onDoubleClick={(e) => { if (onEditRuns) { e.stopPropagation(); onEditRuns(); } }}
      style={{
        position: "absolute",
        left: `${zone.x}%`, top: `${zone.y}%`,
        width: `${zone.w}%`, height: `${zone.h}%`,
        zIndex: 10 + (zone.z || 1),
        background,
        color,
        border: selected ? "2px solid #f59e0b" : "1px solid rgba(255,255,255,0.5)",
        boxShadow: selected ? "0 0 0 3px rgba(245,158,11,0.35)" : "none",
        borderRadius: 4,
        cursor: "move",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        userSelect: "none",
        touchAction: "none",
        fontSize: 12,
        textAlign: "center",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 11, opacity: 0.9, pointerEvents: "none", textShadow: "0 1px 2px rgba(0,0,0,0.6)", position: runs ? "absolute" : "static", top: 2, left: 4, zIndex: 2 }}>
        {def.icon} {zone.key}
      </span>
      {/* WYSIWYG with the players: font_size_vh is % of the ZONE height, so size
          the runs with container-query height units against the zone box (cqh) —
          same contract as static/player.html fillRuns and the Android renderer. */}
      {runs && (
        <div style={{ position: "absolute", inset: 0, containerType: "size", pointerEvents: "none" }}>
          {runs.map((r, ri) => (
            <span key={ri} style={{
              position: "absolute", left: `${r.x || 0}%`, top: `${r.y || 0}%`, width: `${r.w || 40}%`,
              color: r.text_color || "#fff", fontWeight: r.bold ? 700 : 400, textAlign: r.align || "left",
              fontSize: `${r.font_size_vh || 18}cqh`,
              lineHeight: 1.05, overflow: "hidden", textShadow: "0 1px 2px rgba(0,0,0,0.6)",
            }}>{r.text || ""}</span>
          ))}
        </div>
      )}
      {!runs && <span
        style={{
          pointerEvents: "none",
          padding: "0 6px",
          width: "100%",
          opacity: isTexty ? 1 : 0.85,
          fontSize: isTexty ? `min(${previewFontPct}px, 64px)` : 10,
          fontWeight: isTexty && st.bold ? 700 : 400,
          textAlign: isTexty ? st.align || "center" : "center",
          direction: isTexty ? st.direction || "ltr" : undefined,
          whiteSpace: zone.type === "ticker" ? "nowrap" : undefined,
          overflow: "hidden",
          textShadow: st.bg_image_url ? "0 1px 3px rgba(0,0,0,0.7)" : undefined,
        }}
      >
        {zonePreviewText(zone)}
      </span>}
      {selected && HANDLES.map((hd) => (
        <div
          key={hd.id}
          onPointerDown={(e) => startGesture(e, hd.id)}
          onPointerMove={moveGesture}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          style={{
            position: "absolute",
            left: `calc(${hd.x * 100}% - 5px)`,
            top: `calc(${hd.y * 100}% - 5px)`,
            width: 10, height: 10,
            background: "#f59e0b",
            border: "1.5px solid #fff",
            borderRadius: 3,
            cursor: hd.cursor,
            zIndex: 5,
            touchAction: "none",
          }}
        />
      ))}
      {selected ? (
        <span style={{
          position: "absolute", bottom: 2, right: 4, fontSize: 9,
          background: "rgba(0,0,0,0.55)", color: "#fff",
          padding: "1px 4px", borderRadius: 3, pointerEvents: "none",
        }}>
          {Math.round(zone.x * 10) / 10},{Math.round(zone.y * 10) / 10} · {Math.round(zone.w * 10) / 10}×{Math.round(zone.h * 10) / 10}%
          {(() => {
            // Live pixel size while dragging/resizing — what the content
            // creator actually needs ("make the image 1152×486").
            const px = zonePixelSize(zone, designWidth, designHeight);
            return px ? ` · ${px.w}×${px.h}px` : "";
          })()}
        </span>
      ) : (() => {
        // Every box carries its real pixel size at all times, so the whole
        // layout is readable at a glance without clicking each zone.
        const px = zonePixelSize(zone, designWidth, designHeight);
        return px ? (
          <span style={{
            position: "absolute", bottom: 2, right: 4, fontSize: 9,
            background: "rgba(0,0,0,0.45)", color: "#fff",
            padding: "1px 4px", borderRadius: 3, pointerEvents: "none", zIndex: 2,
          }}>
            {px.w}×{px.h}px
          </span>
        ) : null;
      })()}
    </div>
  );
}
