// Full-screen drag-and-drop template designer.
// Layout: zone palette (left) · canvas (center) · properties panel (right).
import React, { useEffect, useMemo, useReducer, useRef, useState, useCallback } from "react";
import { T as theme } from "./theme";
import { designerReducer, initialDesignerState } from "./designerReducer";
import { ZONE_TYPES, newZone } from "./zoneTypes";
import { validateZones, snapTargetsFor, clamp } from "./zoneValidation";
import ZoneBox from "./ZoneBox";
import TemplateThumb from "./TemplateThumb";
import PropertiesPanel from "./PropertiesPanel";
import { updateTemplate, publishTemplate } from "./api";

const btn = (theme, kind = "default") => ({
  padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
  border: kind === "default" ? `1px solid ${theme.border}` : "none",
  background: kind === "primary" ? theme.accent : kind === "success" ? theme.success : theme.card,
  color: kind === "default" ? theme.text : "#0a1628",
});

export default function TemplateDesigner({ template: initial, onClose, onSaved }) {
  const [state, dispatch] = useReducer(designerReducer, initialDesignerState);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [banner, setBanner] = useState(null); // {kind:"success"|"error", text}
  const [previewMode, setPreviewMode] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => { dispatch({ type: "INIT", template: initial }); }, [initial]);

  const template = state.template;
  const zoneErrors = useMemo(() => (template ? validateZones(template.zones) : []), [template]);
  const snapTargets = useMemo(
    () => (template ? snapTargetsFor(template.zones, state.selectedKey) : { xs: [], ys: [] }),
    [template, state.selectedKey]
  );

  const nudge = useCallback((dx, dy) => {
    const zone = template?.zones.find((z) => z.key === state.selectedKey);
    if (!zone) return;
    dispatch({
      type: "UPDATE_ZONE", key: zone.key, commit: true,
      patch: { x: clamp(zone.x + dx, 0, 100 - zone.w), y: clamp(zone.y + dy, 0, 100 - zone.h) },
    });
  }, [template, state.selectedKey]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "REDO" : "UNDO" });
        return;
      }
      const step = e.shiftKey ? 5 : 1;
      if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-step, 0); }
      if (e.key === "ArrowRight") { e.preventDefault(); nudge(step, 0); }
      if (e.key === "ArrowUp") { e.preventDefault(); nudge(0, -step); }
      if (e.key === "ArrowDown") { e.preventDefault(); nudge(0, step); }
      if ((e.key === "Delete" || e.key === "Backspace") && state.selectedKey) {
        e.preventDefault();
        dispatch({ type: "DELETE_ZONE", key: state.selectedKey });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nudge, state.selectedKey]);

  if (!template) return null;

  const doSave = async () => {
    if (zoneErrors.length) {
      setBanner({ kind: "error", text: `Fix before saving: ${zoneErrors[0]}` });
      return false;
    }
    setSaving(true);
    setBanner(null);
    const res = await updateTemplate(template.id, {
      name: template.name,
      description: template.description || null,
      orientation: template.orientation,
      design_width: template.design_width,
      design_height: template.design_height,
      zones: template.zones,
    });
    setSaving(false);
    if (!res.ok) {
      setBanner({ kind: "error", text: `Save failed: ${typeof res.message === "string" ? res.message : JSON.stringify(res.message)}` });
      return false;
    }
    dispatch({ type: "MARK_SAVED", patch: { status: res.data.status, version: res.data.version } });
    setBanner({ kind: "success", text: "Draft saved" });
    onSaved?.(res.data);
    return true;
  };

  const doPublish = async () => {
    setConfirmPublish(false);
    if (!(await doSave())) return;
    setPublishing(true);
    const res = await publishTemplate(template.id);
    setPublishing(false);
    if (!res.ok) {
      setBanner({ kind: "error", text: `Publish failed: ${typeof res.message === "string" ? res.message : JSON.stringify(res.message)}` });
      return;
    }
    dispatch({ type: "MARK_SAVED", patch: { status: "published", version: res.data.version } });
    setBanner({ kind: "success", text: `Published version ${res.data.version} — ${res.data.companies?.length || 0} linked compan${(res.data.companies?.length || 0) === 1 ? "y" : "ies"} will update on next device heartbeat` });
    onSaved?.(res.data);
  };

  const requestClose = () => (state.dirty ? setConfirmClose(true) : onClose());

  // Canvas geometry: fit within available space, honoring aspect ratio.
  const ratio = template.design_width / template.design_height;
  const canvasH = ratio >= 1 ? "min(62vh, 560px)" : "min(74vh, 760px)";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1200, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#0a1628", flexWrap: "wrap" }}>
        <button onClick={requestClose} style={{ ...btn(theme), background: "rgba(255,255,255,0.1)", color: "#fff", border: "none" }}>← Back</button>
        <strong style={{ color: "#fff", fontSize: 15 }}>{template.name}</strong>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: template.status === "published" ? "#16a34a" : "#f59e0b", color: "#fff", textTransform: "uppercase", fontWeight: 700 }}>
          {template.status}{template.version ? ` · v${template.version}` : ""}
        </span>
        {state.dirty && <span style={{ color: "#fbbf24", fontSize: 12 }}>● unsaved changes</span>}
        <div style={{ flex: 1 }} />
        <button onClick={() => dispatch({ type: "UNDO" })} disabled={!state.past.length} aria-label="Undo"
          style={{ ...btn(theme), opacity: state.past.length ? 1 : 0.4 }}>↩ Undo</button>
        <button onClick={() => dispatch({ type: "REDO" })} disabled={!state.future.length} aria-label="Redo"
          style={{ ...btn(theme), opacity: state.future.length ? 1 : 0.4 }}>↪ Redo</button>
        <button onClick={() => setPreviewMode((p) => !p)} style={btn(theme)}>
          {previewMode ? "✎ Edit" : "👁 Preview"}
        </button>
        <button onClick={doSave} disabled={saving} style={btn(theme, "primary")}>
          {saving ? "Saving…" : "Save draft"}
        </button>
        <button onClick={() => setConfirmPublish(true)} disabled={publishing || !!zoneErrors.length} style={{ ...btn(theme, "success"), opacity: zoneErrors.length ? 0.5 : 1 }}>
          {publishing ? "Publishing…" : "Publish"}
        </button>
      </div>

      {banner && (
        <div style={{ padding: "8px 16px", fontSize: 13, display: "flex", justifyContent: "space-between", background: banner.kind === "success" ? "#dcfce7" : "#fef2f2", color: banner.kind === "success" ? "#166534" : "#dc2626" }}>
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss message" style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }}>✕</button>
        </div>
      )}
      {!!zoneErrors.length && !banner && (
        <div style={{ padding: "6px 16px", fontSize: 12, background: "#fef3c7", color: "#92400e" }}>
          ⚠ {zoneErrors[0]}{zoneErrors.length > 1 ? ` (+${zoneErrors.length - 1} more)` : ""}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Palette */}
        {!previewMode && (
          <div style={{ width: 190, padding: 14, background: theme.card, borderRight: `1px solid ${theme.border}`, overflowY: "auto" }}>
            <h4 style={{ margin: "0 0 10px", fontSize: 13, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>Add zone</h4>
            {Object.entries(ZONE_TYPES).map(([type, def]) => (
              <button
                key={type}
                onClick={() => dispatch({ type: "ADD_ZONE", zone: newZone(type, template.zones.map((z) => z.key)) })}
                title={def.hint}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: 8,
                  padding: "10px 12px", borderRadius: 8, border: `1px solid ${theme.border}`,
                  background: theme.cardAlt, color: theme.text, cursor: "pointer", fontSize: 13, fontWeight: 600, textAlign: "left",
                }}
              >
                <span style={{ fontSize: 16 }}>{def.icon}</span> {def.label}
              </button>
            ))}
            <p style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 1.5, marginTop: 12 }}>
              Zones may overlap; use Layer (z) to order them. Sizes are % of the screen, so one template fits every resolution.
            </p>
          </div>
        )}

        {/* Canvas */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflow: "auto" }}>
          {previewMode ? (
            <TemplateThumb template={template} height={ratio >= 1 ? 480 : 700} showLabels />
          ) : (
            <div
              ref={canvasRef}
              onPointerDown={() => dispatch({ type: "SELECT", key: null })}
              style={{
                position: "relative",
                height: canvasH,
                aspectRatio: `${template.design_width} / ${template.design_height}`,
                background: "#0b0f1a",
                backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
                backgroundSize: "10% 10%",
                borderRadius: 8,
                boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
                overflow: "hidden",
              }}
            >
              {template.zones.map((z, i) => (
                <ZoneBox
                  key={z.key}
                  zone={z}
                  index={i}
                  selected={state.selectedKey === z.key}
                  canvasRef={canvasRef}
                  snapTargets={snapTargets}
                  onSelect={(key) => dispatch({ type: "SELECT", key })}
                  onChange={(patch) => dispatch({ type: "UPDATE_ZONE", key: z.key, patch })}
                  onGestureStart={() => dispatch({ type: "BEGIN_GESTURE" })}
                  onGestureEnd={() => dispatch({ type: "END_GESTURE" })}
                />
              ))}
            </div>
          )}
        </div>

        {/* Properties */}
        {!previewMode && (
          <div style={{ width: 300, padding: 16, background: theme.card, borderLeft: `1px solid ${theme.border}`, overflowY: "auto" }}>
            <PropertiesPanel theme={theme} state={state} dispatch={dispatch} />
          </div>
        )}
      </div>

      {/* Publish confirm */}
      {confirmPublish && (
        <ConfirmDialog
          theme={theme}
          title="Publish this template?"
          body={`Publishing saves the draft and creates version ${(template.version || 0) + 1}. Every company linked to this template will start rendering it on their screens at the next device heartbeat (~30s).`}
          confirmLabel="Publish now"
          onConfirm={doPublish}
          onCancel={() => setConfirmPublish(false)}
        />
      )}
      {/* Close-with-unsaved confirm */}
      {confirmClose && (
        <ConfirmDialog
          theme={theme}
          title="Discard unsaved changes?"
          body="You have unsaved changes in this template. Close the designer and lose them, or go back and save."
          confirmLabel="Discard changes"
          danger
          onConfirm={onClose}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </div>
  );
}

// Small local confirm dialog (canvas overlay is already fullscreen; the shared
// Modal would stack awkwardly under it).
function ConfirmDialog({ theme, title, body, confirmLabel, onConfirm, onCancel, danger }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(10,22,40,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "min(92vw, 440px)", background: theme.card, color: theme.text, borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{title}</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: theme.textSecondary, lineHeight: 1.5 }}>{body}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} style={btn(theme)}>Cancel</button>
          <button onClick={onConfirm} style={{ ...btn(theme, "primary"), background: danger ? theme.danger : theme.accent, color: danger ? "#fff" : "#0a1628" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
