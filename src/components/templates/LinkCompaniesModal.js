// Link/unlink a published template to companies. One PUT per toggle, with
// explicit per-row feedback — no silent failures.
import React, { useEffect, useState } from "react";
import { T as theme } from "./theme";
import { listCompanies, linkCompanyTemplate, getTemplate, unlinkCompanyExtraTemplate } from "./api";

export default function LinkCompaniesModal({ template, onClose, onChanged }) {
  const [companies, setCompanies] = useState(null);
  const [extraIds, setExtraIds] = useState(new Set()); // companies linked "as extra"
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    const [res, tpl] = await Promise.all([listCompanies(), getTemplate(template.id)]);
    if (!res.ok) { setError(`Could not load companies: ${res.message}`); setCompanies([]); return; }
    const items = Array.isArray(res.data) ? res.data : res.data.companies || res.data.items || [];
    setCompanies(items);
    // Additional links (per-group/screen assignment) — from the template's own
    // linked-companies view, flagged additional: true.
    if (tpl.ok) {
      setExtraIds(new Set((tpl.data?.companies || []).filter((c) => c.additional).map((c) => c.id)));
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const removeExtra = async (company) => {
    setBusyId(company.id);
    setError("");
    const res = await unlinkCompanyExtraTemplate(company.id, template.id);
    setBusyId(null);
    if (!res.ok) {
      setError(`Couldn't remove the extra link for ${company.name}: ${res.message}`);
      return;
    }
    setExtraIds((s) => { const n = new Set(s); n.delete(company.id); return n; });
    onChanged?.();
  };

  const toggle = async (company) => {
    const linked = company.template_id === template.id;
    setBusyId(company.id);
    setError("");
    const res = await linkCompanyTemplate(company.id, linked ? null : template.id);
    setBusyId(null);
    if (!res.ok) {
      setError(`${linked ? "Unlink" : "Link"} failed for ${company.name}: ${res.message}`);
      return;
    }
    setCompanies((cs) => cs.map((c) => (c.id === company.id
      ? { ...c, template_id: linked ? null : template.id, template_source_id: null }
      : c)));
    onChanged?.();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.7)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(95vw, 560px)", maxHeight: "85vh", background: theme.card, color: theme.text, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", background: "#0a1628", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Link “{template.name}” to companies</strong>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: 6, width: 28, height: 28, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: 16, overflowY: "auto" }}>
          {template.status !== "published" && (
            <div style={{ padding: 10, borderRadius: 8, background: "#fef3c7", color: "#92400e", fontSize: 13, marginBottom: 12 }}>
              This template is a draft — publish it first; only published templates can be linked.
            </div>
          )}
          {error && (
            <div style={{ padding: 10, borderRadius: 8, background: "#fef2f2", color: "#dc2626", fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error" style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }}>✕</button>
            </div>
          )}
          {companies === null && <p style={{ color: theme.textSecondary, fontSize: 13 }}>Loading companies…</p>}
          {companies?.length === 0 && !error && <p style={{ color: theme.textSecondary, fontSize: 13 }}>No companies yet — onboard one from the Companies tab.</p>}
          {companies?.map((c) => {
            const linkedHere = c.template_id === template.id;
            // Linked through the company's own published customized copy of
            // THIS template (fork) — still "this template" to the platform.
            const customizedHere = !linkedHere && c.template_source_id === template.id;
            const extraHere = extraIds.has(c.id);
            const linkedElsewhere = c.template_id != null && !linkedHere && !customizedHere;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${theme.border}` }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: customizedHere || extraHere ? theme.success : theme.textSecondary }}>
                    {c.slug}
                    {linkedHere ? " · linked as this company's DEFAULT"
                      : customizedHere ? " · runs its own customized copy of this template"
                      : linkedElsewhere ? " · another template is its default"
                      : " · default screens (no template)"}
                    {extraHere && !linkedHere ? " · linked as an EXTRA (assignable to groups/screens)" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {extraHere && !linkedHere && (
                    <button
                      onClick={() => removeExtra(c)}
                      disabled={busyId === c.id}
                      style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                               border: `1px solid ${theme.danger}`, background: "transparent", color: theme.danger }}
                    >
                      {busyId === c.id ? "…" : "Remove extra"}
                    </button>
                  )}
                  <button
                    onClick={() => toggle(c)}
                    disabled={busyId === c.id || template.status !== "published"}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      border: "none", opacity: template.status !== "published" ? 0.5 : 1,
                      background: linkedHere ? theme.danger : theme.accent,
                      color: linkedHere ? "#fff" : "#0a1628",
                    }}
                  >
                    {busyId === c.id ? "…"
                      : linkedHere ? "Unlink"
                      : customizedHere ? "Reset to original"
                      : linkedElsewhere ? "Make default"
                      : "Link"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
