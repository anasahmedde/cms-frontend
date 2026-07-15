// Right-hand properties panel for the selected zone (or template meta when
// nothing is selected).
import React from "react";
import { ZONE_TYPES, BINDING_LABELS, CONTENT_SCOPES, CANVAS_PRESETS, CANVAS_MIN, CANVAS_MAX, normalizeCanvas, aspectLabel } from "./zoneTypes";
import MediaLibraryPicker from "./MediaLibraryPicker";

const row = { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 };
const lbl = (theme) => ({ fontSize: 12, color: theme.textSecondary, width: 86, flexShrink: 0 });
const inp = (theme) => ({
  flex: 1, minWidth: 0, padding: "6px 8px", borderRadius: 6, fontSize: 13,
  border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text,
});

function NumField({ theme, id, label, value, onChange, min = 0, max = 100, labelWidth }) {
  return (
    <div style={row}>
      <label htmlFor={id} style={{ ...lbl(theme), ...(labelWidth ? { width: labelWidth } : {}) }}>{label}</label>
      <input
        id={id} type="number" step="0.5" min={min} max={max} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={inp(theme)}
      />
    </div>
  );
}

function ColorField({ theme, id, label, value, onChange }) {
  return (
    <div style={row}>
      <label htmlFor={id} style={lbl(theme)}>{label}</label>
      <input
        id={id} type="color" value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 36, height: 28, padding: 0, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, background: theme.inputBg, cursor: "pointer" }}
      />
      <input
        aria-label={`${label} hex value`} type="text" value={value || ""}
        placeholder="none" onChange={(e) => onChange(e.target.value || undefined)}
        style={{ ...inp(theme), width: 80, flex: "none" }}
      />
      {value && (
        <button onClick={() => onChange(undefined)} aria-label={`Clear ${label}`}
          style={{ border: "none", background: "none", cursor: "pointer", color: theme.textSecondary }}>✕</button>
      )}
    </div>
  );
}

function BackgroundSection({ theme, zone, patchStyle, patchZone }) {
  const st = zone.style || {};
  // Mode is explicit state, not derived: deriving it from the values made
  // "Image (URL)" snap back to "None" before a URL could be typed (the empty
  // string is falsy) — the reported "Image URL not working".
  const derived = st.bg_image_s3 ? "media" : st.bg_image_url ? "image" : st.bg_gradient ? "gradient" : st.bg_color ? "solid" : "none";
  const [mode, setModeState] = React.useState(derived);
  React.useEffect(() => {
    setModeState(derived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.key]);
  const grad = st.bg_gradient || { stops: ["#0a1628", "#f59e0b"], angle: 135 };

  const setMode = (m) => {
    setModeState(m);
    // One background kind at a time — clear the others explicitly.
    const cleared = { bg_color: undefined, bg_gradient: undefined, bg_image_url: undefined, bg_image_s3: undefined };
    if (m === "solid") cleared.bg_color = st.bg_color || "#0a1628";
    if (m === "gradient") cleared.bg_gradient = grad;
    if (m === "image") cleared.bg_image_url = st.bg_image_url || "";
    if (m === "media") cleared.bg_image_s3 = st.bg_image_s3 || undefined;
    patchZone({ style: cleared });
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <h4 style={{ margin: "12px 0 8px", fontSize: 12, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Background
      </h4>
      <div style={row}>
        <label htmlFor="z-bg-mode" style={lbl(theme)}>Type</label>
        <select id="z-bg-mode" value={mode} onChange={(e) => setMode(e.target.value)} style={inp(theme)}>
          <option value="none">None (transparent)</option>
          <option value="solid">Solid color</option>
          <option value="gradient">Gradient</option>
          <option value="media">Image from media library</option>
          <option value="image">Image (URL)</option>
        </select>
      </div>
      {mode === "solid" && (
        <ColorField theme={theme} id="z-bg" label="Color" value={st.bg_color} onChange={(v) => patchStyle("bg_color", v)} />
      )}
      {mode === "gradient" && (
        <>
          <ColorField theme={theme} id="z-grad-a" label="From" value={grad.stops[0]}
            onChange={(v) => patchStyle("bg_gradient", { ...grad, stops: [v || "#0a1628", grad.stops[1] || "#f59e0b"] })} />
          <ColorField theme={theme} id="z-grad-b" label="To" value={grad.stops[1]}
            onChange={(v) => patchStyle("bg_gradient", { ...grad, stops: [grad.stops[0] || "#0a1628", v || "#f59e0b"] })} />
          <NumField theme={theme} id="z-grad-angle" label="Angle °" value={grad.angle ?? 135}
            onChange={(v) => patchStyle("bg_gradient", { ...grad, angle: Math.max(0, Math.min(360, Math.round(v))) })} min={0} max={360} />
        </>
      )}
      {mode === "media" && (
        <div style={row}>
          <label htmlFor="z-bg-media" style={lbl(theme)}>Media</label>
          <MediaLibraryPicker
            id="z-bg-media"
            imagesOnly
            value={st.bg_image_s3}
            onPick={(it) => patchStyle("bg_image_s3", it.s3_link)}
            style={inp(theme)}
          />
        </div>
      )}
      {mode === "image" && (
        <div style={row}>
          <label htmlFor="z-bg-img" style={lbl(theme)}>Image URL</label>
          <input id="z-bg-img" value={st.bg_image_url || ""} placeholder="https://…"
            onChange={(e) => patchStyle("bg_image_url", e.target.value || undefined)} style={inp(theme)} />
        </div>
      )}
    </div>
  );
}

// Layers list — the only reliable way to select a zone that sits under another
// one, and the fastest way to jump between zones. Ordered top-most first.
function LayersList({ theme, zones, selectedKey, onSelect }) {
  const ordered = [...zones].sort((a, b) => (b.z || 1) - (a.z || 1));
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 12, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Layers ({zones.length})
      </h4>
      {!zones.length && (
        <p style={{ fontSize: 12, color: theme.textSecondary, margin: 0 }}>No zones yet — add one from the left.</p>
      )}
      {ordered.map((z) => {
        const def = ZONE_TYPES[z.type] || {};
        const active = z.key === selectedKey;
        return (
          <button
            key={z.key}
            data-zone-key={z.key}
            onClick={() => onSelect(z.key)}
            aria-pressed={active}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              padding: "6px 8px", marginBottom: 4, borderRadius: 6, cursor: "pointer",
              fontSize: 12.5, textAlign: "left",
              border: `1px solid ${active ? theme.accent : theme.border}`,
              background: active ? "rgba(245,158,11,0.12)" : theme.cardAlt,
              color: theme.text,
            }}
          >
            <span>{def.icon}</span>
            <span style={{ fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.key}</span>
            <span style={{ fontSize: 10, color: theme.textSecondary }}>z{z.z || 1}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function PropertiesPanel({ theme, state, dispatch, onEditRuns }) {
  const { template, selectedKey } = state;
  const zone = template.zones.find((z) => z.key === selectedKey);
  const layers = (
    <LayersList
      theme={theme}
      zones={template.zones}
      selectedKey={selectedKey}
      onSelect={(key) => dispatch({ type: "SELECT", key })}
    />
  );

  const patchZone = (patch) =>
    dispatch({ type: "UPDATE_ZONE", key: zone.key, patch, commit: true });
  const patchStyle = (field, value) => patchZone({ style: { [field]: value } });

  if (!zone) {
    return (
      <div>
        {layers}
        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: theme.text }}>Template settings</h4>
        <div style={row}>
          <label htmlFor="tpl-name" style={lbl(theme)}>Name</label>
          <input id="tpl-name" value={template.name}
            onChange={(e) => dispatch({ type: "SET_META", patch: { name: e.target.value } })}
            style={inp(theme)} />
        </div>
        <div style={row}>
          <label htmlFor="tpl-desc" style={lbl(theme)}>Description</label>
          <input id="tpl-desc" value={template.description || ""}
            onChange={(e) => dispatch({ type: "SET_META", patch: { description: e.target.value } })}
            style={inp(theme)} />
        </div>
        <div style={row}>
          <label htmlFor="tpl-preset" style={lbl(theme)}>Preset</label>
          <select
            id="tpl-preset"
            value={CANVAS_PRESETS.find((p) => p.w === template.design_width && p.h === template.design_height)?.label || "__custom__"}
            onChange={(e) => {
              const preset = CANVAS_PRESETS.find((p) => p.label === e.target.value);
              if (preset) dispatch({ type: "SET_META", patch: { orientation: preset.orientation, design_width: preset.w, design_height: preset.h } });
            }}
            style={inp(theme)}
          >
            {CANVAS_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
            <option value="__custom__">Custom {template.design_width}×{template.design_height}</option>
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8 }}>
          <div style={row}>
            <label htmlFor="tpl-w" style={{ ...lbl(theme), width: 60 }}>Width</label>
            <input id="tpl-w" type="number" min={CANVAS_MIN} max={CANVAS_MAX} value={template.design_width}
              onChange={(e) => dispatch({ type: "SET_META", patch: normalizeCanvas(e.target.value, template.design_height) })}
              style={inp(theme)} />
          </div>
          <div style={row}>
            <label htmlFor="tpl-h" style={{ ...lbl(theme), width: 60 }}>Height</label>
            <input id="tpl-h" type="number" min={CANVAS_MIN} max={CANVAS_MAX} value={template.design_height}
              onChange={(e) => dispatch({ type: "SET_META", patch: normalizeCanvas(template.design_width, e.target.value) })}
              style={inp(theme)} />
          </div>
        </div>
        <p style={{ fontSize: 12, color: theme.textSecondary, margin: "0 0 10px" }}>
          {template.orientation} · {aspectLabel(template.design_width, template.design_height)} · any size 120–10000px
        </p>
        <p style={{ fontSize: 12, color: theme.textSecondary, margin: "0 0 10px" }}>
          The size above is only a design aid — zones are stored as <b>% of the screen</b>, so the
          published template fits every resolution. Screens report theirs automatically on enrollment.
        </p>
        <p style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.5 }}>
          Select a zone on the canvas to edit its position, colors and content source.
          Drag zones to move, use the handles to resize. Hold <b>Alt</b> to disable snapping.
          Arrow keys nudge the selected zone (Shift = bigger steps).
        </p>
      </div>
    );
  }

  const def = ZONE_TYPES[zone.type] || { bindings: [] };
  const source = zone.binding?.source || "static";
  const runCount = Array.isArray(zone.content?.runs) ? zone.content.runs.length : 0;

  return (
    <div>
      {layers}
      <h4 style={{ margin: "0 0 12px", fontSize: 14, color: theme.text }}>
        {def.icon} {def.label} zone
      </h4>
      <div style={row}>
        <label htmlFor="z-key" style={lbl(theme)}>Key</label>
        <input id="z-key" value={zone.key}
          onChange={(e) => patchZone({ key: e.target.value })}
          style={inp(theme)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8 }}>
        <NumField theme={theme} id="z-x" label="X" value={zone.x} onChange={(v) => patchZone({ x: v })} labelWidth={28} />
        <NumField theme={theme} id="z-y" label="Y" value={zone.y} onChange={(v) => patchZone({ y: v })} labelWidth={28} />
        <NumField theme={theme} id="z-w" label="W" value={zone.w} onChange={(v) => patchZone({ w: v })} min={1} labelWidth={28} />
        <NumField theme={theme} id="z-h" label="H" value={zone.h} onChange={(v) => patchZone({ h: v })} min={1} labelWidth={28} />
      </div>
      <p style={{ fontSize: 11, color: theme.textSecondary, margin: "0 0 10px" }}>
        All values are % of the screen — the template fits any resolution automatically.
      </p>
      <NumField theme={theme} id="z-z" label="Layer (z)" value={zone.z || 1} onChange={(v) => patchZone({ z: Math.round(v) })} min={1} max={99} />

      <div style={row}>
        <label htmlFor="z-binding" style={lbl(theme)}>Content from</label>
        <select id="z-binding" value={source}
          onChange={(e) => {
            const s = e.target.value;
            patchZone({ binding: { source: s, ...(s === "content" ? { scope: zone.binding?.scope || "shop" } : {}) } });
          }}
          style={inp(theme)}>
          {def.bindings.map((b) => <option key={b} value={b}>{BINDING_LABELS[b] || b}</option>)}
        </select>
      </div>
      {source === "content" && (
        <div style={row}>
          <label htmlFor="z-scope" style={lbl(theme)}>Managed per</label>
          <select id="z-scope" value={zone.binding?.scope || "shop"}
            onChange={(e) => patchZone({ binding: { source: "content", scope: e.target.value } })}
            style={inp(theme)}>
            {CONTENT_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
      {source === "static" && zone.type !== "clock" && !runCount && (
        <div style={row}>
          <label htmlFor="z-text" style={lbl(theme)}>Text</label>
          <textarea id="z-text" value={zone.content?.text || ""} rows={3}
            onChange={(e) => patchZone({ content: { text: e.target.value } })}
            style={{ ...inp(theme), resize: "vertical", fontFamily: "inherit" }}
            placeholder={"Fixed text shown on screen\n(multi-line supported)"} />
        </div>
      )}
      {(zone.type === "text" || zone.type === "ticker") && onEditRuns && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => onEditRuns(zone.key)}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                     border: `1px solid ${theme.accent}`, background: "rgba(245,158,11,0.12)", color: theme.text, fontWeight: 600 }}>
            {runCount ? `Edit ${runCount} text item${runCount > 1 ? "s" : ""}…` : "Compose multiple text items…"}
          </button>
          <p style={{ fontSize: 11, color: theme.textSecondary, margin: "4px 0 0" }}>
            {runCount ? "This zone shows the positioned items above; the single Text field is hidden." : "Place several styled texts freely inside this box (or double-click it on the canvas)."}
          </p>
        </div>
      )}

      <BackgroundSection theme={theme} zone={zone} patchStyle={patchStyle} patchZone={patchZone} />
      <ColorField theme={theme} id="z-fg" label="Text color" value={zone.style?.text_color} onChange={(v) => patchStyle("text_color", v)} />

      {(zone.type === "text" || zone.type === "ticker") && (
        <>
          <NumField theme={theme} id="z-font" label="Font size (vh)" value={zone.style?.font_size_vh ?? 50}
            onChange={(v) => patchStyle("font_size_vh", v)} min={5} max={100} />
          <div style={row}>
            <label htmlFor="z-align" style={lbl(theme)}>Align</label>
            <select id="z-align" value={zone.style?.align || "center"}
              onChange={(e) => patchStyle("align", e.target.value)} style={inp(theme)}>
              <option value="left">left</option><option value="center">center</option><option value="right">right</option>
            </select>
          </div>
          <div style={row}>
            <label htmlFor="z-dir" style={lbl(theme)}>Direction</label>
            <select id="z-dir" value={zone.style?.direction || "ltr"}
              onChange={(e) => patchStyle("direction", e.target.value)} style={inp(theme)}>
              <option value="ltr">LTR (English)</option>
              <option value="rtl">RTL (اردو / العربية)</option>
            </select>
          </div>
          <div style={row}>
            <label htmlFor="z-bold" style={lbl(theme)}>Bold</label>
            <input id="z-bold" type="checkbox" checked={!!zone.style?.bold}
              onChange={(e) => patchStyle("bold", e.target.checked || undefined)} />
          </div>
          <NumField theme={theme} id="z-pad" label="Padding %" value={zone.style?.padding_pct ?? 0}
            onChange={(v) => patchStyle("padding_pct", v)} min={0} max={40} />
        </>
      )}
      {zone.type === "ticker" && (
        <NumField theme={theme} id="z-speed" label="Speed" value={zone.style?.ticker_speed ?? 12}
          onChange={(v) => patchStyle("ticker_speed", v)} min={1} max={100} />
      )}
      {(zone.type === "media" || zone.type === "playlist") && (
        <div style={row}>
          <label htmlFor="z-fit" style={lbl(theme)}>Fit</label>
          <select id="z-fit" value={zone.style?.fit_mode || "cover"}
            onChange={(e) => patchStyle("fit_mode", e.target.value)} style={inp(theme)}>
            <option value="cover">cover (fill, may crop)</option>
            <option value="contain">contain (letterbox)</option>
          </select>
        </div>
      )}

      <button
        onClick={() => {
          const base = zone.key.replace(/_copy\d*$/, "");
          let n = 2, key = `${base}_copy`;
          const keys = new Set(template.zones.map((z) => z.key));
          while (keys.has(key)) key = `${base}_copy${n++}`;
          dispatch({
            type: "ADD_ZONE",
            zone: {
              ...JSON.parse(JSON.stringify(zone)),
              key,
              x: Math.min(95, (zone.x || 0) + 3),
              y: Math.min(95, (zone.y || 0) + 3),
            },
          });
        }}
        style={{
          marginTop: 12, width: "100%", padding: "8px 12px", borderRadius: 8,
          border: `1px solid ${theme.border}`, background: theme.cardAlt,
          color: theme.text, cursor: "pointer", fontWeight: 600, fontSize: 13,
        }}
      >
        Duplicate zone
      </button>
      <button
        onClick={() => dispatch({ type: "DELETE_ZONE", key: zone.key })}
        style={{
          marginTop: 8, width: "100%", padding: "8px 12px", borderRadius: 8,
          border: `1px solid ${theme.danger}`, background: "transparent",
          color: theme.danger, cursor: "pointer", fontWeight: 600, fontSize: 13,
        }}
      >
        Delete zone
      </button>
      <p style={{ fontSize: 11, color: theme.textSecondary, marginTop: 8 }}>{def.hint}</p>
    </div>
  );
}
