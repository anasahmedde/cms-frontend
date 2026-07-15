// In-zone text composer: a FIXED-size stage that frames a graph-paper grid whose
// shape matches the zone's true on-screen proportions. The grid (and the text
// items on it) zoom/pan inside the fixed frame; the frame never resizes.
// Positions/size are % of the zone, so they scale to any screen. Persists to
// zone.content.runs.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { T as theme } from "./theme";

const lbl = { fontSize: 12, color: theme.textSecondary, width: 78, flexShrink: 0 };
const row = { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 };
const inp = {
  flex: 1, minWidth: 0, padding: "6px 8px", borderRadius: 6, fontSize: 13,
  border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text,
};
const zoomBtn = {
  width: 30, height: 30, display: "grid", placeItems: "center", flexShrink: 0,
  border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text,
  borderRadius: 8, fontSize: 17, lineHeight: 1, cursor: "pointer",
};

const FRAME_H = 420;          // fixed stage height — never changes
const GRID_LINE = "rgba(148,180,220,0.20)";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => +v.toFixed(1);

const newRun = () => ({ text: "New text", x: 30, y: 40, w: 40, font_size_vh: 18, text_color: "#ffffff", bold: false, align: "left" });

export default function TextRunsEditor({ zone, designWidth, designHeight, onSave, onClose }) {
  const [runs, setRuns] = useState(() =>
    Array.isArray(zone?.content?.runs) ? JSON.parse(JSON.stringify(zone.content.runs)) : []
  );
  const [sel, setSel] = useState(runs.length ? 0 : -1);
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [panning, setPanning] = useState(false);
  const frameRef = useRef(null);
  const gridRef = useRef(null);
  const drag = useRef(null);

  // Logical grid = the zone's TRUE on-screen pixel shape: (w%×design_width) by
  // (h%×design_height). Its aspect ratio therefore matches the text block exactly.
  const grid = useMemo(() => {
    const dw = designWidth || 1920, dh = designHeight || 1080;
    const gw = Math.max(40, Math.round(((zone?.w || 50) / 100) * dw));
    const gh = Math.max(24, Math.round(((zone?.h || 20) / 100) * dh));
    return { gw, gh };
  }, [zone, designWidth, designHeight]);

  // Square graph-paper cell (~20 across the longer side), in logical px.
  const cell = Math.max(8, Math.round(Math.max(grid.gw, grid.gh) / 20));

  // Center the whole grid inside the fixed frame (Fit / initial view).
  const fit = () => {
    const fr = frameRef.current?.getBoundingClientRect();
    if (!fr) return;
    const z = clamp(Math.min((fr.width - 24) / grid.gw, (fr.height - 24) / grid.gh), 0.05, 8);
    setView({ zoom: +z.toFixed(3), panX: Math.round((fr.width - grid.gw * z) / 2), panY: Math.round((fr.height - grid.gh * z) / 2) });
  };

  // Fit on mount and whenever the zone's shape changes.
  useEffect(fit, [grid.gw, grid.gh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse-wheel zoom toward the cursor. Native, non-passive listener so
  // preventDefault() (stop the modal scrolling while zooming) is honored.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setView((v) => {
        const nz = clamp(+(v.zoom * (e.deltaY < 0 ? 1.12 : 0.89)).toFixed(3), 0.05, 8);
        const fr = el.getBoundingClientRect();
        const cx = e.clientX - fr.left, cy = e.clientY - fr.top;
        return { zoom: nz, panX: cx - (cx - v.panX) * (nz / v.zoom), panY: cy - (cy - v.panY) * (nz / v.zoom) };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // One window-level pointer listener drives item-move and grid-pan.
  useEffect(() => {
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      if (d.mode === "pan") {
        setView((v) => ({ ...v, panX: d.px0 + (e.clientX - d.sx), panY: d.py0 + (e.clientY - d.sy) }));
        return;
      }
      const g = gridRef.current?.getBoundingClientRect();
      if (!g) return;
      const px = ((e.clientX - g.left) / g.width) * 100;
      const py = ((e.clientY - g.top) / g.height) * 100;
      const idx = d.i; // capture — drag.current may be nulled by pointerup first
      setRuns((rs) => rs.map((r, i) => i === idx
        ? { ...r, x: r1(clamp(px - d.dx, 0, 100)), y: r1(clamp(py - d.dy, 0, 100)) }
        : r));
    };
    const up = () => { drag.current = null; setPanning(false); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  const patch = (p) => setRuns((rs) => rs.map((r, i) => (i === sel ? { ...r, ...p } : r)));
  const add = () => { setRuns((rs) => [...rs, newRun()]); setSel(runs.length); };
  const del = () => { setRuns((rs) => rs.filter((_, i) => i !== sel)); setSel(-1); };
  const zoomStep = (f) => setView((v) => ({ ...v, zoom: clamp(+(v.zoom * f).toFixed(3), 0.05, 8) }));

  // Drag a text item to move it; drag empty grid to pan the stage.
  const onFrameDown = (e) => {
    const el = e.target.closest("[data-run-idx]");
    if (el) {
      const i = +el.getAttribute("data-run-idx");
      setSel(i);
      const g = gridRef.current.getBoundingClientRect();
      const px = ((e.clientX - g.left) / g.width) * 100;
      const py = ((e.clientY - g.top) / g.height) * 100;
      drag.current = { mode: "move", i, dx: px - runs[i].x, dy: py - runs[i].y };
    } else {
      drag.current = { mode: "pan", sx: e.clientX, sy: e.clientY, px0: view.panX, py0: view.panY };
      setPanning(true);
    }
  };

  const cur = sel >= 0 ? runs[sel] : null;

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1300, background: theme.overlay || "rgba(0,0,0,0.6)",
               display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: theme.card, borderRadius: 12, width: "min(1040px, 96vw)", maxHeight: "92vh",
                 overflow: "auto", boxShadow: theme.shadowLg || "0 8px 32px rgba(0,0,0,0.4)", border: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${theme.border}` }}>
          <h3 style={{ margin: 0, fontSize: 15, color: theme.text }}>Text items — {zone?.key}</h3>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "none", color: theme.textSecondary, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 16, padding: 16, flexWrap: "wrap" }}>
          {/* Fixed stage framing a zoomable/pannable grid that matches the zone shape. */}
          <div style={{ flex: "1 1 580px", minWidth: 320 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: theme.textSecondary }}>
                Scroll to zoom · drag empty grid to pan · drag a text to move · click to edit
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => zoomStep(0.89)} aria-label="Zoom out" style={zoomBtn}>−</button>
                <button onClick={fit} aria-label="Fit grid to view"
                  style={{ ...zoomBtn, width: "auto", minWidth: 52, padding: "0 8px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(view.zoom * 100)}%
                </button>
                <button onClick={() => zoomStep(1.12)} aria-label="Zoom in" style={zoomBtn}>+</button>
              </div>
            </div>
            <div
              ref={frameRef}
              onPointerDown={onFrameDown}
              style={{ position: "relative", width: "100%", height: FRAME_H, overflow: "hidden",
                       background: theme.cardAlt || "rgba(0,0,0,0.25)", border: `1px solid ${theme.border}`,
                       borderRadius: 10, cursor: panning ? "grabbing" : "grab", touchAction: "none" }}
            >
              <div
                ref={gridRef}
                style={{
                  position: "absolute", left: 0, top: 0, width: grid.gw, height: grid.gh,
                  transformOrigin: "0 0",
                  transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
                  backgroundColor: zone?.style?.bg_color || theme.brandNavy || "#0a1628",
                  backgroundImage:
                    `repeating-linear-gradient(0deg, transparent 0, transparent ${cell - 1}px, ${GRID_LINE} ${cell - 1}px, ${GRID_LINE} ${cell}px),` +
                    `repeating-linear-gradient(90deg, transparent 0, transparent ${cell - 1}px, ${GRID_LINE} ${cell - 1}px, ${GRID_LINE} ${cell}px)`,
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.18)",
                }}
              >
                {runs.map((r, i) => (
                  <div
                    key={i}
                    data-run-idx={i}
                    style={{
                      position: "absolute", left: `${r.x}%`, top: `${r.y}%`, width: `${r.w || 40}%`,
                      color: r.text_color || "#fff",
                      fontSize: `${((r.font_size_vh || 18) / 100) * grid.gh}px`,
                      fontWeight: r.bold ? 700 : 400, textAlign: r.align || "left",
                      lineHeight: 1.12, cursor: "move", userSelect: "none", overflow: "hidden", whiteSpace: "pre-wrap",
                      outline: i === sel ? `2px solid ${theme.accent}` : "1px dashed rgba(255,255,255,0.4)",
                      padding: 2,
                    }}
                  >
                    {r.text || " "}
                  </div>
                ))}
                {runs.length === 0 && (
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.6)", fontSize: 13, pointerEvents: "none" }}>
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
