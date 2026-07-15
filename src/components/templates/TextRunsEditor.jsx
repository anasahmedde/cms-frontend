// In-zone text composer: a zoomed view of one text zone where you place
// multiple text items freely and style each one. Positions/size are % of the
// zone, so they scale to any screen. Persists to zone.content.runs.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { T as theme } from "./theme";

const lbl = { fontSize: 12, color: theme.textSecondary, width: 78, flexShrink: 0 };
const row = { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 };
const inp = {
  flex: 1, minWidth: 0, padding: "6px 8px", borderRadius: 6, fontSize: 13,
  border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text,
};
const zoomBtn = {
  width: 28, height: 28, display: "grid", placeItems: "center", flexShrink: 0,
  border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text,
  borderRadius: 6, fontSize: 16, lineHeight: 1, cursor: "pointer",
};
// Drag handle drawn on the selected text item (resize by cursor).
const handleBase = {
  position: "absolute", width: 12, height: 12, background: theme.accent,
  border: "1.5px solid #fff", borderRadius: 3, zIndex: 5, touchAction: "none",
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => +v.toFixed(1);

const newRun = () => ({ text: "New text", x: 30, y: 40, w: 40, font_size_vh: 18, text_color: "#ffffff", bold: false, align: "left" });

export default function TextRunsEditor({ zone, designWidth, designHeight, onSave, onClose }) {
  const [runs, setRuns] = useState(() =>
    Array.isArray(zone?.content?.runs) ? JSON.parse(JSON.stringify(zone.content.runs)) : []
  );
  const [sel, setSel] = useState(runs.length ? 0 : -1);
  const [zoom, setZoom] = useState(1);
  const boardRef = useRef(null);
  const viewportRef = useRef(null);
  const drag = useRef(null);

  const clampZoom = (z) => +clamp(z, 0.4, 4).toFixed(2);

  // Canvas mirrors the zone's TRUE on-screen shape: its pixel size on the target
  // screen is (w% × design_width) by (h% × design_height), so the aspect ratio
  // must use the template's design resolution — not the raw w%/h% (which only
  // match on a square screen). The box is scaled down to fit, keeping that ratio.
  const aspect = useMemo(() => {
    const dw = designWidth || 1920, dh = designHeight || 1080;
    const zwPx = ((zone?.w || 50) / 100) * dw;
    const zhPx = ((zone?.h || 20) / 100) * dh;
    const MAX_W = 680, MAX_H = 520;
    let w = MAX_W, h = Math.round((MAX_W * zhPx) / zwPx);
    if (h > MAX_H) { h = MAX_H; w = Math.round((MAX_H * zwPx) / zhPx); }
    return { w, h };
  }, [zone, designWidth, designHeight]);

  // Zoomed pixel size of the canvas; run font size & drag math derive from this.
  const bw = Math.round(aspect.w * zoom);
  const bh = Math.round(aspect.h * zoom);

  // A single window-level pointer listener drives move + both resize gestures.
  useEffect(() => {
    const move = (e) => {
      const d = drag.current;
      if (!d || !boardRef.current) return;
      const b = boardRef.current.getBoundingClientRect();
      const px = ((e.clientX - b.left) / b.width) * 100;
      const py = ((e.clientY - b.top) / b.height) * 100;
      const idx = d.i; // capture now — drag.current may be nulled by pointerup before the updater runs
      setRuns((rs) => rs.map((r, i) => {
        if (i !== idx) return r;
        if (d.mode === "w") return { ...r, w: r1(clamp(px - d.x0, 5, 100)) };       // right edge → width
        if (d.mode === "size") return { ...r, font_size_vh: r1(clamp(py - d.y0, 2, 100)) }; // bottom edge → text size
        return { ...r, x: r1(clamp(px - d.dx, 0, 100)), y: r1(clamp(py - d.dy, 0, 100)) };   // body → move
      }));
    };
    const up = () => { drag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  // Mouse-wheel zoom on the canvas. A native, non-passive listener is required —
  // React attaches wheel handlers as passive, so preventDefault() (to stop the
  // modal from scrolling while zooming) would be ignored there.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.1 : 0.9)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const patch = (p) => setRuns((rs) => rs.map((r, i) => (i === sel ? { ...r, ...p } : r)));
  const add = () => { setRuns((rs) => [...rs, newRun()]); setSel(runs.length); };
  const del = () => { setRuns((rs) => rs.filter((_, i) => i !== sel)); setSel(-1); };

  const startDrag = (e, i) => {
    e.stopPropagation();
    setSel(i);
    const b = boardRef.current.getBoundingClientRect();
    const px = ((e.clientX - b.left) / b.width) * 100;
    const py = ((e.clientY - b.top) / b.height) * 100;
    drag.current = { i, mode: "move", dx: px - runs[i].x, dy: py - runs[i].y };
  };

  // Resize by cursor: mode "w" tracks width (% of canvas), "size" tracks font
  // size (% of canvas height) — both are direct pointer-to-value mappings.
  const startResize = (e, i, mode) => {
    e.stopPropagation();
    setSel(i);
    drag.current = { i, mode, x0: runs[i].x, y0: runs[i].y };
  };

  const cur = sel >= 0 ? runs[sel] : null;

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1300, background: theme.overlay || "rgba(0,0,0,0.6)",
               display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: theme.card, borderRadius: 12, width: "min(1120px, 96vw)", maxHeight: "92vh",
                 overflow: "auto", boxShadow: theme.shadowLg || "0 8px 32px rgba(0,0,0,0.4)", border: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${theme.border}` }}>
          <h3 style={{ margin: 0, fontSize: 15, color: theme.text }}>Text items — {zone?.key}</h3>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "none", color: theme.textSecondary, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 16, padding: 16, flexWrap: "wrap" }}>
          {/* Zoomed zone canvas: click a box to select, drag to move, handles to resize. */}
          <div style={{ flex: "1 1 620px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: theme.textSecondary }}>
                Drag items to move; use the orange handles to resize width &amp; text size. Scroll to zoom.
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => setZoom((z) => clampZoom(z * 0.9))} aria-label="Zoom out" style={zoomBtn}>−</button>
                <button onClick={() => setZoom(1)} aria-label="Reset zoom to 100%"
                  style={{ ...zoomBtn, width: "auto", minWidth: 46, padding: "0 8px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(zoom * 100)}%
                </button>
                <button onClick={() => setZoom((z) => clampZoom(z * 1.1))} aria-label="Zoom in" style={zoomBtn}>+</button>
              </div>
            </div>
            <div
              ref={viewportRef}
              style={{ overflow: "auto", maxHeight: "62vh", padding: 12,
                       background: theme.cardAlt || "rgba(0,0,0,0.25)",
                       border: `1px solid ${theme.border}`, borderRadius: 8 }}
            >
              <div
                ref={boardRef}
                style={{ position: "relative", width: bw, height: bh, margin: "0 auto",
                         background: zone?.style?.bg_color || theme.brandNavy || "#0a1628",
                         borderRadius: 6, overflow: "hidden", border: `1px solid ${theme.border}` }}
              >
                {runs.map((r, i) => (
                  <div
                    key={i}
                    onPointerDown={(e) => startDrag(e, i)}
                    style={{
                      position: "absolute", left: `${r.x}%`, top: `${r.y}%`, width: `${r.w || 40}%`,
                      color: r.text_color || "#fff",
                      fontSize: `${((r.font_size_vh || 18) / 100) * bh}px`,
                      fontWeight: r.bold ? 700 : 400, textAlign: r.align || "left",
                      lineHeight: 1.1, cursor: "move", userSelect: "none",
                      overflow: i === sel ? "visible" : "hidden",
                      outline: i === sel ? `2px solid ${theme.accent}` : "1px dashed rgba(255,255,255,0.4)",
                      padding: 2,
                    }}
                  >
                    {r.text || " "}
                    {i === sel && (
                      <>
                        <div onPointerDown={(e) => startResize(e, i, "w")} aria-hidden="true"
                          title="Drag to change width"
                          style={{ ...handleBase, right: -6, top: "calc(50% - 6px)", cursor: "ew-resize" }} />
                        <div onPointerDown={(e) => startResize(e, i, "size")} aria-hidden="true"
                          title="Drag to change text size"
                          style={{ ...handleBase, bottom: -6, left: "calc(50% - 6px)", cursor: "ns-resize" }} />
                      </>
                    )}
                  </div>
                ))}
                {runs.length === 0 && (
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                    No text items yet — click “Add text”.
                  </div>
                )}
              </div>
            </div>
            <button onClick={add}
              style={{ marginTop: 10, padding: "8px 14px", borderRadius: 8, border: "none", background: theme.accent, color: theme.brandNavy || "#0a1628", fontWeight: 700, cursor: "pointer" }}>
              + Add text
            </button>
          </div>

          {/* Selected-item style panel */}
          <div style={{ flex: "1 1 300px", minWidth: 260 }}>
            {!cur ? (
              <p style={{ fontSize: 13, color: theme.textSecondary }}>Select a text item to edit it, or add one.</p>
            ) : (
              <>
                <div style={{ ...row, alignItems: "flex-start" }}>
                  <label style={lbl}>Text</label>
                  <textarea value={cur.text} rows={2} onChange={(e) => patch({ text: e.target.value })}
                    style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div style={row}>
                  <label style={lbl}>Size</label>
                  <input type="number" min={2} max={100} value={cur.font_size_vh || 18}
                    onChange={(e) => patch({ font_size_vh: clamp(parseFloat(e.target.value) || 18, 2, 100) })} style={inp} />
                  <span style={{ fontSize: 11, color: theme.textSecondary }}>% of box</span>
                </div>
                <div style={row}>
                  <label style={lbl}>Width</label>
                  <input type="number" min={5} max={100} value={cur.w || 40}
                    onChange={(e) => patch({ w: clamp(parseFloat(e.target.value) || 40, 5, 100) })} style={inp} />
                  <span style={{ fontSize: 11, color: theme.textSecondary }}>%</span>
                </div>
                <div style={row}>
                  <label style={lbl}>Color</label>
                  <input type="color" value={cur.text_color || "#ffffff"} onChange={(e) => patch({ text_color: e.target.value })}
                    style={{ width: 40, height: 28, padding: 0, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, cursor: "pointer" }} />
                </div>
                <div style={row}>
                  <label style={lbl}>Align</label>
                  <select value={cur.align || "left"} onChange={(e) => patch({ align: e.target.value })} style={inp}>
                    <option value="left">left</option><option value="center">center</option><option value="right">right</option>
                  </select>
                </div>
                <div style={row}>
                  <label style={lbl}>Bold</label>
                  <input type="checkbox" checked={!!cur.bold} onChange={(e) => patch({ bold: e.target.checked })} />
                </div>
                <button onClick={del}
                  style={{ marginTop: 4, padding: "6px 12px", borderRadius: 8, border: `1px solid ${theme.danger}`, background: "transparent", color: theme.danger, cursor: "pointer", fontSize: 13 }}>
                  Delete item
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 16px", borderTop: `1px solid ${theme.border}` }}>
          <button onClick={onClose} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.cardAlt, color: theme.text, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onSave(runs)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: theme.accent, color: theme.brandNavy || "#0a1628", fontWeight: 700, cursor: "pointer" }}>
            Done ({runs.length})
          </button>
        </div>
      </div>
    </div>
  );
}
