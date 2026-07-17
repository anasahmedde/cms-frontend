// Platform → Templates tab: list, create, open designer, duplicate, link, delete.
import React, { useCallback, useEffect, useState } from "react";
import { T as theme } from "./theme";
import { TEMPLATE_PRESETS } from "./templatePresets";
import { CANVAS_PRESETS, CANVAS_MIN, CANVAS_MAX, normalizeCanvas } from "./zoneTypes";
import TemplateThumb from "./TemplateThumb";
import TemplateDesigner from "./TemplateDesigner";
import LinkCompaniesModal from "./LinkCompaniesModal";
import {
  listTemplates, getTemplate, createTemplate, deleteTemplate, duplicateTemplate,
} from "./api";

export default function TemplatesTab() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [customSize, setCustomSize] = useState(false);
  const [creating, setCreating] = useState(false);
  const [designing, setDesigning] = useState(null);   // full template object
  const [linking, setLinking] = useState(null);       // template object
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const res = await listTemplates();
    if (!res.ok) { setError(`Could not load templates: ${res.message}`); setItems([]); return; }
    setItems(res.data.items || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openDesigner = async (id) => {
    setBusyId(id);
    const res = await getTemplate(id);
    setBusyId(null);
    if (!res.ok) { setError(`Could not open template: ${res.message}`); return; }
    setDesigning(res.data);
  };

  const onCreate = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    let size;
    if (fd.get("preset") === "__custom__") {
      const norm = normalizeCanvas(fd.get("custom_w"), fd.get("custom_h"));
      size = { orientation: norm.orientation, w: norm.design_width, h: norm.design_height };
    } else {
      const preset = CANVAS_PRESETS.find((p) => p.label === fd.get("preset")) || CANVAS_PRESETS[0];
      size = { orientation: preset.orientation, w: preset.w, h: preset.h };
    }
    setCreating(true);
    setError("");
    const layout = TEMPLATE_PRESETS.find((t) => t.key === fd.get("layout_preset")) || TEMPLATE_PRESETS[0];
    const res = await createTemplate({
      name: fd.get("name"),
      description: fd.get("description") || null,
      orientation: layout.key !== "blank" ? layout.orientation : size.orientation,
      design_width: layout.key !== "blank" ? layout.design_width : size.w,
      design_height: layout.key !== "blank" ? layout.design_height : size.h,
      zones: JSON.parse(JSON.stringify(layout.zones)),
    });
    setCreating(false);
    if (!res.ok) { setError(`Create failed: ${res.message}`); return; }
    setShowCreate(false);
    await load();
    setDesigning(res.data); // straight into the designer
  };

  const onDuplicate = async (t) => {
    setBusyId(t.id);
    const res = await duplicateTemplate(t.id);
    setBusyId(null);
    if (!res.ok) { setError(`Duplicate failed: ${res.message}`); return; }
    setSuccess(`Duplicated as “${res.data.name}” (draft)`);
    load();
  };

  const onDelete = async (t) => {
    setConfirmDelete(null);
    setBusyId(t.id);
    const res = await deleteTemplate(t.id);
    setBusyId(null);
    if (!res.ok) {
      const detail = res.data?.detail;
      if (res.status === 409 && detail?.companies?.length) {
        setError(`Cannot delete “${t.name}” — still linked to: ${detail.companies.map((c) => c.name).join(", ")}. Unlink first.`);
      } else {
        setError(`Delete failed: ${res.message}`);
      }
      return;
    }
    setSuccess(`Deleted “${t.name}”`);
    load();
  };

  const card = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 16 };
  const btn = (bg, fg = "#0a1628") => ({
    padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
    border: "none", background: bg, color: fg, cursor: "pointer",
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: theme.text }}>Screen Templates</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: theme.textSecondary }}>
            Design a screen layout once, link it to a company — every device renders it. Companies without a template keep the default screens.
          </p>
        </div>
        <button onClick={() => { setCustomSize(false); setShowCreate(true); }} style={btn(theme.accent)}>+ New Template</button>
      </div>

      {success && (
        <div style={{ padding: 10, borderRadius: 8, background: "#dcfce7", color: "#166534", fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
          {success}
          <button onClick={() => setSuccess("")} aria-label="Dismiss" style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }}>✕</button>
        </div>
      )}
      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "#fef2f2", color: "#dc2626", fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss" style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }}>✕</button>
        </div>
      )}

      {items === null && <p style={{ color: theme.textSecondary }}>Loading templates…</p>}
      {items?.length === 0 && !error && (
        <div style={{ ...card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎨</div>
          <p style={{ color: theme.text, fontWeight: 600, margin: 0 }}>No templates yet</p>
          <p style={{ color: theme.textSecondary, fontSize: 13 }}>Create your first screen template and link it to a company.</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {items?.map((t) => (
          <div key={t.id} style={card}>
            <div style={{ display: "flex", gap: 12 }}>
              <TemplateThumb template={t} height={96} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ color: theme.text, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</strong>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700, textTransform: "uppercase", background: t.status === "published" ? "#16a34a" : "#f59e0b", color: "#fff" }}>
                    {t.status}{t.version ? ` v${t.version}` : ""}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>
                  {t.orientation} · {t.design_width}×{t.design_height} · {t.zones?.length || 0} zones
                </div>
                <div style={{ fontSize: 12, color: t.linked_companies ? theme.success : theme.textSecondary, marginTop: 2 }}>
                  {t.linked_companies
                    ? `🔗 ${t.linked_companies} compan${t.linked_companies === 1 ? "y" : "ies"} linked${t.customized_companies ? ` (${t.customized_companies} customized)` : ""}`
                    : "Not linked yet"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => openDesigner(t.id)} disabled={busyId === t.id} style={btn(theme.accent)}>
                {busyId === t.id ? "…" : "✎ Open designer"}
              </button>
              <button onClick={() => setLinking(t)} style={btn(theme.info, "#fff")}>🔗 Companies</button>
              <button onClick={() => onDuplicate(t)} disabled={busyId === t.id} style={btn(theme.cardAlt, theme.text)}>⧉ Duplicate</button>
              <button onClick={() => setConfirmDelete(t)} disabled={busyId === t.id} style={btn("transparent", theme.danger)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.7)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={onCreate}
            style={{ width: "min(95vw, 460px)", background: theme.card, borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: "0 0 16px", color: theme.text, fontSize: 16 }}>New screen template</h3>
            <label htmlFor="new-tpl-name" style={{ fontSize: 12, color: theme.textSecondary }}>Name</label>
            <input id="new-tpl-name" name="name" required minLength={1} maxLength={120} placeholder="e.g. MoltyFoam Shop Screen"
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", margin: "4px 0 12px", borderRadius: 8, border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text }} />
            <label htmlFor="new-tpl-desc" style={{ fontSize: 12, color: theme.textSecondary }}>Description (optional)</label>
            <input id="new-tpl-desc" name="description" maxLength={1000}
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", margin: "4px 0 12px", borderRadius: 8, border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text }} />
            <label htmlFor="new-tpl-layout" style={{ fontSize: 12, color: theme.textSecondary }}>Start from</label>
            <select id="new-tpl-layout" name="layout_preset" defaultValue="fullscreen"
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", margin: "4px 0 4px", borderRadius: 8, border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text }}>
              {TEMPLATE_PRESETS.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
            <p style={{ fontSize: 11, color: theme.textSecondary, margin: "0 0 12px" }}>
              A prebuilt arrangement of text, media, QR and playlist zones — everything stays editable in the designer.
            </p>
            <label htmlFor="new-tpl-preset" style={{ fontSize: 12, color: theme.textSecondary }}>Screen size</label>
            <select id="new-tpl-preset" name="preset" defaultValue={CANVAS_PRESETS[6].label}
              onChange={(e) => setCustomSize(e.target.value === "__custom__")}
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", margin: "4px 0 12px", borderRadius: 8, border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text }}>
              {CANVAS_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
              <option value="__custom__">Custom size…</option>
            </select>
            {customSize && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", margin: "0 0 16px" }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="new-tpl-w" style={{ fontSize: 12, color: theme.textSecondary }}>Width (px)</label>
                  <input id="new-tpl-w" name="custom_w" type="number" min={CANVAS_MIN} max={CANVAS_MAX} defaultValue={1080} required
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", marginTop: 4, borderRadius: 8, border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text }} />
                </div>
                <span style={{ color: theme.textSecondary, paddingBottom: 10 }}>×</span>
                <div style={{ flex: 1 }}>
                  <label htmlFor="new-tpl-h" style={{ fontSize: 12, color: theme.textSecondary }}>Height (px)</label>
                  <input id="new-tpl-h" name="custom_h" type="number" min={CANVAS_MIN} max={CANVAS_MAX} defaultValue={1920} required
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", marginTop: 4, borderRadius: 8, border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text }} />
                </div>
              </div>
            )}
            {!customSize && (
              <p style={{ fontSize: 11.5, color: theme.textSecondary, margin: "0 0 16px" }}>
                Any resolution works — zones are positioned in %, so one template fits every screen of the same shape. Pick “Custom size…” for an exact pixel size.
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setShowCreate(false)} style={btn(theme.cardAlt, theme.text)}>Cancel</button>
              <button type="submit" disabled={creating} style={btn(theme.accent)}>{creating ? "Creating…" : "Create & open designer"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.7)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(92vw, 420px)", background: theme.card, borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: "0 0 8px", color: theme.text, fontSize: 16 }}>Delete “{confirmDelete.name}”?</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: theme.textSecondary }}>
              This permanently removes the template and its version history. Directly linked companies block deletion — unlink them first. Companies running their own customized copy keep it.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setConfirmDelete(null)} style={btn(theme.cardAlt, theme.text)}>Cancel</button>
              <button onClick={() => onDelete(confirmDelete)} style={btn(theme.danger, "#fff")}>Delete template</button>
            </div>
          </div>
        </div>
      )}

      {designing && (
        <TemplateDesigner
          template={designing}
          onClose={() => { setDesigning(null); load(); }}
          onSaved={() => load()}
        />
      )}
      {linking && (
        <LinkCompaniesModal template={linking} onClose={() => { setLinking(null); load(); }} onChanged={load} />
      )}
    </div>
  );
}
