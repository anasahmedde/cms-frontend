// Bulk device enrollment UI: download a CSV/XLSX template, upload a filled file,
// preview validation (errors + counts + quota), commit, and claim pending devices.
import React, { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;
const authHeader = () => {
  const t = localStorage.getItem("digix_token") || localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

async function apiJSON(method, path, body) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  return { ok: res.ok, status: res.status, data };
}

async function downloadTemplate(fmt) {
  const res = await fetch(`${API_BASE}/bulk-devices/template.${fmt}`, { headers: authHeader() });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `digix-devices-template.${fmt}`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export default function BulkImportModal({ onClose, onImported }) {
  const [tab, setTab] = useState("import");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);   // validate response
  const [result, setResult] = useState(null);     // commit report
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);

  const [pending, setPending] = useState(null);
  const [claimId, setClaimId] = useState({});      // device_id -> typed android id
  const [claimBusy, setClaimBusy] = useState(null);
  const [claimMsg, setClaimMsg] = useState("");

  const loadPending = useCallback(async () => {
    const r = await apiJSON("GET", "/bulk-devices/pending");
    if (!r.ok) { setError(`Could not load pending devices: ${r.data?.detail || r.status}`); setPending([]); return; }
    setPending(r.data.items || []);
  }, []);
  useEffect(() => { if (tab === "pending") loadPending(); }, [tab, loadPending]);

  const onFile = async (file) => {
    if (!file) return;
    setBusy(true); setError(""); setPreview(null); setResult(null); setFileName(file.name);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/bulk-devices/validate`, { method: "POST", headers: authHeader(), body: fd });
    setBusy(false);
    let data = null; try { data = await res.json(); } catch (e) {}
    if (!res.ok) { setError(`Validation failed: ${data?.detail || res.status}`); return; }
    setPreview(data);
  };

  const commit = async () => {
    if (!preview) return;
    setBusy(true); setError("");
    const r = await apiJSON("POST", "/bulk-devices/commit", { job_id: preview.job_id });
    setBusy(false);
    if (!r.ok) { setError(`Import failed: ${r.data?.detail || r.status}`); return; }
    setResult(r.data);
    setPreview(null);
    onImported && onImported();
  };

  const claim = async (dev) => {
    const mid = (claimId[dev.id] || "").trim();
    if (!mid) { setClaimMsg(""); setError("Enter the device's ANDROID_ID to claim it"); return; }
    setClaimBusy(dev.id); setError(""); setClaimMsg("");
    const r = await apiJSON("POST", "/bulk-devices/claim", { device_id: dev.id, mobile_id: mid });
    setClaimBusy(null);
    if (!r.ok) { setError(`Claim failed: ${r.data?.detail || r.status}`); return; }
    setClaimMsg(`Claimed “${dev.device_name}” → ${mid}. It will come online shortly.`);
    loadPending();
    onImported && onImported();
  };

  const s = preview?.summary;
  const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 };
  const btn = (bg, fg = "#0a1628") => ({ padding: "9px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, border: "none", background: bg, color: fg, cursor: "pointer" });
  const tabBtn = (active) => ({ padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", background: active ? "#0a1628" : "#f1f5f9", color: active ? "#fff" : "#475569" });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.7)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(96vw, 820px)", maxHeight: "90vh", background: "#f8fafc", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", background: "#0a1628", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong style={{ fontSize: 17 }}>Bulk device enrollment</strong>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>Import many screens from a spreadsheet — validate first, then create</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: 6, width: 30, height: 30, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: "12px 20px 0", display: "flex", gap: 8 }}>
          <button style={tabBtn(tab === "import")} onClick={() => setTab("import")}>Import file</button>
          <button style={tabBtn(tab === "pending")} onClick={() => setTab("pending")}>Pending devices</button>
        </div>

        <div style={{ padding: 20, overflowY: "auto" }}>
          {error && (
            <div style={{ padding: 10, borderRadius: 8, background: "#fef2f2", color: "#dc2626", fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss" style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }}>✕</button>
            </div>
          )}

          {tab === "import" && (
            <>
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>1. Download the template</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
                  One row per screen. <b>device_name</b> and <b>shop_name</b> are required. Add the <b>device_id</b> (ANDROID_ID) if you know it and the screen auto-enrolls when it powers on; leave it blank to create a “pending” screen you claim on site.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={btn("#f59e0b")} onClick={() => downloadTemplate("xlsx").catch((e) => setError(e.message))}>⬇ Excel (.xlsx)</button>
                  <button style={btn("#e2e8f0", "#0a1628")} onClick={() => downloadTemplate("csv").catch((e) => setError(e.message))}>⬇ CSV</button>
                </div>
              </div>

              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>2. Upload the filled file</div>
                <input ref={fileRef} type="file" accept=".csv,.xlsx" data-bulk-file
                  onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }}
                  style={{ fontSize: 14 }} />
                {busy && <span style={{ marginLeft: 10, fontSize: 13, color: "#6b7280" }}>Working…</span>}
                {fileName && !busy && <span style={{ marginLeft: 10, fontSize: 13, color: "#6b7280" }}>{fileName}</span>}
              </div>

              {result && (
                <div style={{ ...card, borderColor: "#16a34a", background: "#f0fdf4" }}>
                  <div style={{ fontWeight: 700, color: "#166534", marginBottom: 8 }}>✓ Import complete</div>
                  <div style={{ fontSize: 14, color: "#166534" }}>
                    Created <b>{result.created}</b> device(s){result.pending ? <>, <b>{result.pending}</b> pending (claim on the “Pending devices” tab)</> : null}
                    {result.skipped ? <>, {result.skipped} already existed</> : null}. {result.shops} shop(s), {result.groups} group(s) touched.
                  </div>
                </div>
              )}

              {s && (
                <div style={card}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>Preview — {s.total_rows} row(s)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 12 }}>
                    <Stat label="Will create" value={s.will_create} color="#16a34a" />
                    <Stat label="Pending" value={s.will_pending} color="#f59e0b" />
                    <Stat label="Already exist" value={s.will_skip} color="#6b7280" />
                    <Stat label="Errors" value={s.error_rows} color={s.error_rows ? "#dc2626" : "#6b7280"} />
                  </div>
                  <div style={{ fontSize: 13, color: s.quota.ok ? "#6b7280" : "#dc2626", marginBottom: 10 }}>
                    Quota: {s.quota.existing} existing + {s.quota.new} new = <b>{s.quota.after}</b>
                    {s.quota.max > 0 ? <> / {s.quota.max}</> : <> (unlimited)</>}
                    {!s.quota.ok && " — over the limit"}
                  </div>
                  {(s.new_shops.length > 0 || s.new_groups.length > 0) && (
                    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
                      {s.new_shops.length > 0 && <>Shops referenced: {s.new_shops.join(", ")}. </>}
                      {s.new_groups.length > 0 && <>Groups referenced: {s.new_groups.join(", ")}.</>}
                    </div>
                  )}
                  {preview.errors.length > 0 && (
                    <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #fecaca", borderRadius: 8, marginBottom: 12 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead><tr style={{ background: "#fef2f2" }}>
                          <th style={{ textAlign: "left", padding: "6px 10px", width: 60 }}>Row</th>
                          <th style={{ textAlign: "left", padding: "6px 10px" }}>Problem</th>
                        </tr></thead>
                        <tbody>
                          {preview.errors.map((e, i) => (
                            <tr key={i} style={{ borderTop: "1px solid #fee2e2" }}>
                              <td style={{ padding: "6px 10px", color: "#dc2626" }}>{e.row === 0 ? "—" : e.row}</td>
                              <td style={{ padding: "6px 10px" }}>{e.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button style={{ ...btn(s.valid ? "#16a34a" : "#e2e8f0", s.valid ? "#fff" : "#94a3b8"), cursor: s.valid ? "pointer" : "not-allowed" }}
                      disabled={!s.valid || busy} onClick={commit}>
                      {busy ? "Importing…" : `Import ${s.will_create + s.will_pending} device(s)`}
                    </button>
                    {!s.valid && <span style={{ fontSize: 13, color: "#dc2626" }}>Fix the errors above and re-upload before importing.</span>}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "pending" && (
            <div style={card}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Pending devices</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
                These screens were imported without a device id. On site, read the ANDROID_ID shown on the screen and enter it here to activate that screen.
              </div>
              {claimMsg && <div style={{ padding: 10, borderRadius: 8, background: "#f0fdf4", color: "#166534", fontSize: 13, marginBottom: 12 }}>{claimMsg}</div>}
              {pending === null && <div style={{ color: "#6b7280", fontSize: 13 }}>Loading…</div>}
              {pending && pending.length === 0 && <div style={{ color: "#6b7280", fontSize: 13 }}>No pending devices. 🎉</div>}
              {pending && pending.map((d) => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 180, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{d.device_name || "(unnamed)"}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {d.shop_name || "no shop"}{d.group_name ? ` · ${d.group_name}` : ""} · code <b>{d.code}</b>
                    </div>
                  </div>
                  <input placeholder="ANDROID_ID from the screen"
                    aria-label={`ANDROID_ID for ${d.device_name}`}
                    value={claimId[d.id] || ""}
                    onChange={(e) => setClaimId((m) => ({ ...m, [d.id]: e.target.value }))}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, minWidth: 220 }} />
                  <button style={btn("#f59e0b")} disabled={claimBusy === d.id} onClick={() => claim(d)}>
                    {claimBusy === d.id ? "…" : "Claim"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "10px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end" }}>
          <button style={btn("#e2e8f0", "#0a1628")} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
    </div>
  );
}
