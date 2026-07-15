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

const newRun = () => ({ text: "New text", x: 30, y: 40, w: 40, font_size_vh: 18, text_color: "#ffffff", bold: false, align: "left" });

export default function TextRunsEditor({ zone, onSave, onClose }) {
  const [runs, setRuns] = useState(() =>
    Array.isArray(zone?.content?.runs) ? JSON.parse(JSON.stringify(zone.content.runs)) : []
  );
  const [sel, setSel] = useState(runs.length ? 0 : -1);
  const boardRef = useRef(null);
  const drag = useRef(null);

  // Canvas sized to the zone's on-screen aspect (w%×h% of the template canvas).
  const aspect = useMemo(() => {
    const zw = zone?.w || 50, zh = zone?.h || 20;
    const bw = 640;
    return { w: bw, h: Math.max(120, Math.round((bw * zh) / zw)) };
  }, [zone]);

  useEffect(() => {
    const move = (e) => {
      if (!drag.current || !boardRef.current) return;
      const b = boardRef.current.getBoundingClientRect();
      const x = ((e.clientX - b.left) / b.width) * 100 - drag.current.dx;
      const y = ((e.clientY - b.top) / b.height) * 100 - drag.current.dy;
      setRuns((rs) => rs.map((r, i) => i === drag.current.i
        ? { ...r, x: Math.max(0, Math.min(100, +x.toFixed(1))), y: Math.max(0, Math.min(100, +y.toFixed(1))) }
        : r));
    };
    const up = () => { drag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
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
    drag.current = { i, dx: px - runs[i].x, dy: py - runs[i].y };
  };

  const cur = sel >= 0 ? runs[sel] : null;

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1300, background: theme.overlay || "rgba(0,0,0,0.6)",
               display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: theme.card, borderRadius: 12, width: "min(1000px, 96vw)", maxHeight: "92vh",
                 overflow: "auto", boxShadow: theme.shadowLg || "0 8px 32px rgba(0,0,0,0.4)", border: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${theme.border}` }}>
          <h3 style={{ margin: 0, fontSize: 15, color: theme.text }}>Text items — {zone?.key}</h3>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "none", color: theme.textSecondary, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 16, padding: 16, flexWrap: "wrap" }}>
          {/* Zoomed zone canvas: click a box to select, drag to move. */}
          <div style={{ flex: "1 1 560px" }}>
            <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 6 }}>
              Drag items to position them inside the box. Click one to edit it.
            </div>
            <div
              ref={boardRef}
              style={{ position: "relative", width: "100%", maxWidth: aspect.w, height: aspect.h,
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
                    fontSize: `${((r.font_size_vh || 18) / 100) * aspect.h}px`,
                    fontWeight: r.bold ? 700 : 400, textAlign: r.align || "left",
                    lineHeight: 1.1, cursor: "move", userSelect: "none", overflow: "hidden",
                    outline: i === sel ? `2px solid ${theme.accent}` : "1px dashed rgba(255,255,255,0.4)",
                    padding: 2,
                  }}
                >
                  {r.text || " "}
                </div>
              ))}
              {runs.length === 0 && (
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                  No text items yet — click “Add text”.
                </div>
              )}
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
                    onChange={(e) => patch({ font_size_vh: Math.max(2, Math.min(100, parseFloat(e.target.value) || 18)) })} style={inp} />
                  <span style={{ fontSize: 11, color: theme.textSecondary }}>% of box</span>
                </div>
                <div style={row}>
                  <label style={lbl}>Width</label>
                  <input type="number" min={5} max={100} value={cur.w || 40}
                    onChange={(e) => patch({ w: Math.max(5, Math.min(100, parseFloat(e.target.value) || 40)) })} style={inp} />
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
