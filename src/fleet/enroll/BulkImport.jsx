// Bulk screen enrollment — kit port of the legacy BulkImportModal, every
// behavior kept: template download (.xlsx/.csv), upload → validate (dry run)
// preview with per-row action badges + errors + quota, commit, pending claims.
import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, X } from "lucide-react";
import { apiGet, apiPost } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import Badge from "../../ui/Badge";
import Table from "../../ui/Table";
import Tabs from "../../ui/Tabs";
import Spinner from "../../ui/Spinner";
import { useToast } from "../../ui/Toast";
import PendingScreens from "./PendingScreens";

const ACTION_TONE = { create: "success", update: "info", unchanged: "neutral", pending: "warn", skip: "neutral", error: "danger" };
const ACTION_LABEL = { create: "Create", update: "Update", unchanged: "No change", pending: "Pending", skip: "Already exists", error: "Error" };

// Human labels for the change diff fields.
const FIELD_LABEL = { name: "Name", location: "Location", group: "Group" };
function changeLabel(field) {
  if (field.startsWith("content.")) return `Content · ${field.slice("content.".length)}`;
  return FIELD_LABEL[field] || field;
}

function Stat({ label, value, tone }) {
  return (
    <div style={{ background: "var(--elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone ? `var(--${tone})` : "var(--text)" }}>{value}</div>
      <div className="u-faint">{label}</div>
    </div>
  );
}

// One preview row as a self-contained card: identity + action on top, then the
// per-field diff in an aligned two-column grid (field | old → new). A card list
// avoids the wide table's horizontal scroll, so every change is readable inline.
function PreviewRow({ r }) {
  const err = r.action === "error" || r.reason || r.error;
  return (
    <div style={{
      border: `1px solid ${err ? "var(--danger)" : "var(--border)"}`,
      borderRadius: "var(--radius-sm)", padding: "10px 12px", background: "var(--elevated)",
    }}>
      <div className="u-flex" style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="u-faint" style={{ fontSize: 12 }}>{r.row === 0 ? "—" : `Row ${r.row}`}</span>
        <strong style={{ fontSize: 14 }}>{r.device_name || <span className="u-faint">(no name)</span>}</strong>
        <Badge tone={ACTION_TONE[r.action] || "neutral"}>{ACTION_LABEL[r.action] || r.action || "—"}</Badge>
        {r.device_id && (
          <span className="u-faint" style={{ fontFamily: "monospace", fontSize: 12, marginLeft: "auto" }}>{r.device_id}</span>
        )}
      </div>
      <div className="u-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
        {r.shop_name || "—"} · {r.group_name || <span className="u-faint">Ungrouped</span>}
      </div>
      {r.changes?.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 12px", marginTop: 8, fontSize: 12.5, alignItems: "baseline" }}>
          {r.changes.map((c, i) => (
            <React.Fragment key={i}>
              <div style={{ fontWeight: 600, whiteSpace: "nowrap", color: "var(--text-muted)" }}>{changeLabel(c.field)}</div>
              <div style={{ minWidth: 0, wordBreak: "break-word" }}>
                {c.from
                  ? <span className="u-faint" style={{ textDecoration: "line-through" }}>{c.from}</span>
                  : <span className="u-faint">(blank)</span>}
                {" → "}
                <span style={{ color: "var(--info)", fontWeight: 600 }}>{c.to}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
      {r.action === "unchanged" && !r.changes?.length && (
        <div className="u-faint" style={{ fontSize: 12.5, marginTop: 6 }}>No changes — already up to date.</div>
      )}
      {(r.reason || r.error) && (
        <div style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 6 }}>{r.reason || r.error}</div>
      )}
    </div>
  );
}

const ERROR_COLUMNS = [
  { key: "row", label: "Row", width: 52, render: (e) => (e.row === 0 ? "—" : e.row) },
  { key: "reason", label: "Problem" },
];

export default function BulkImport({ open, onClose, onImported }) {
  const toast = useToast();
  const { hasPermission } = useAuth();
  // Content editors (no manage_devices) get the content-only bulk: the sheet
  // updates content on existing screens; the backend errors rows that would
  // add screens or change fleet fields, and diverts the batch to approval
  // when the company's approval requirement applies to this user.
  const canManageDevices = hasPermission("manage_devices");
  const fileRef = useRef(null);
  const [tab, setTab] = useState("import");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null); // validate response
  const [result, setResult] = useState(null); // commit report
  const [error, setError] = useState("");

  const download = async (fmt) => {
    const res = await apiGet(`/bulk-devices/template.${fmt}`, { responseType: "blob" });
    if (!res.ok) return toast.error(`Could not download the template: ${res.message}`);
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `digix-screens-template.${fmt}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setPreview(null);
    setResult(null);
    setFileName(file.name);
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiPost("/bulk-devices/validate", fd);
    setBusy(false);
    if (!res.ok) return setError(`Validation failed: ${res.message}`);
    setPreview(res.data);
  };

  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    setError("");
    const res = await apiPost("/bulk-devices/commit", { job_id: preview.job_id, auto_create: true });
    setBusy(false);
    if (!res.ok) return setError(`Import failed: ${res.message}`);
    setResult(res.data);
    setPreview(null);
    if (res.data?.status === "pending_approval") {
      // Nothing changed live — the batch waits in the approval queue.
      toast.info(`Submitted for approval — ${res.data.content_changes} content change(s)`);
      return;
    }
    const made = Number(res.data?.created || 0) + Number(res.data?.pending || 0);
    const upd = Number(res.data?.content_updated_existing || 0);
    toast.success(`Applied — ${made} new${upd ? `, ${upd} updated` : ""}`);
    onImported?.();
  };

  const s = preview?.summary;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={canManageDevices ? "Bulk screen enrollment" : "Bulk content update"}
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}
    >
      <p className="u-muted" style={{ marginTop: 0 }}>
        {canManageDevices
          ? "Import many screens from a spreadsheet — validate first, then create."
          : "Update template content on many screens from a spreadsheet — your role changes the content columns of existing screens (rows that would add screens are flagged)."}
      </p>

      <Tabs
        tabs={canManageDevices
          ? [{ key: "import", label: "Import file" }, { key: "pending", label: "Pending screens" }]
          : [{ key: "import", label: "Import file" }]}
        active={tab}
        onChange={setTab}
      />

      {error && (
        <div role="alert" className="u-between" style={{ background: "var(--danger-soft)", color: "var(--danger-strong)", borderRadius: "var(--radius-sm)", padding: "10px 12px", margin: "12px 0" }}>
          <span>{error}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setError("")} style={{ border: "none", background: "none", color: "inherit", cursor: "pointer", display: "flex" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {tab === "import" && (
        <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
          <section>
            <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>1. Download the template</h3>
            <p className="u-muted" style={{ margin: "0 0 10px" }}>
              {canManageDevices ? (
                <>
                  One row per screen. <b>device_name</b> and <b>shop_name</b> are required. Add the <b>device_id</b> (shown on the screen)
                  if you know it and the screen auto-enrolls when it powers on; leave it blank to create a pending screen you claim on site.
                </>
              ) : (
                <>
                  The sheet exports your current screens with a column per content box — edit the <b>content</b> columns and re-upload.
                  Leave everything else as exported.
                </>
              )}
            </p>
            <div className="u-flex">
              <Button variant="secondary" size="sm" icon={Download} onClick={() => download("xlsx")}>Excel (.xlsx)</Button>
              <Button variant="secondary" size="sm" icon={Download} onClick={() => download("csv")}>CSV</Button>
            </div>
          </section>

          <section>
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>2. Upload the filled file</h3>
            <div className="u-flex">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx"
                aria-label="Upload the filled screens file"
                onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }}
              />
              {busy && <span className="u-flex u-muted"><Spinner size={14} /> Working…</span>}
              {fileName && !busy && <span className="u-faint">{fileName}</span>}
            </div>
          </section>

          {result && result.status === "pending_approval" && (
            <section role="status" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid var(--warn, #f59e0b)", borderRadius: "var(--radius-sm)", padding: 12 }}>
              <div style={{ fontWeight: 700, color: "var(--warn, #b45309)", marginBottom: 4 }}>⏳ Submitted for approval</div>
              <div>
                <b>{result.content_changes}</b> content change(s) on <b>{result.screens}</b> screen(s) are waiting
                for a manager or admin to review. Screens keep their current content until the batch is approved.
              </div>
            </section>
          )}

          {result && result.status !== "pending_approval" && (
            <section role="status" style={{ background: "var(--success-soft)", border: "1px solid var(--success)", borderRadius: "var(--radius-sm)", padding: 12 }}>
              <div style={{ fontWeight: 700, color: "var(--success)", marginBottom: 4 }}>Import complete</div>
              <div>
                Created <b>{result.created}</b> screen(s)
                {result.pending ? <>, <b>{result.pending}</b> pending (claim on the “Pending screens” tab)</> : null}
                {result.content_updated_existing ? <>, <b>{result.content_updated_existing}</b> updated</> : null}
                {result.skipped ? <>, {result.skipped} unchanged</> : null}
                . {result.shops} location(s), {result.groups} group(s) touched.
              </div>
            </section>
          )}

          {s && (
            <section>
              <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Preview — {s.total_rows} row(s)</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginBottom: 10 }}>
                <Stat label="Will create" value={s.will_create} tone="success" />
                <Stat label="Will update" value={s.will_update || 0} tone={s.will_update ? "info" : undefined} />
                <Stat label="No change" value={s.will_unchanged || 0} />
                <Stat label="Pending" value={s.will_pending} tone="warn" />
                <Stat label="Errors" value={s.error_rows} tone={s.error_rows ? "danger" : undefined} />
              </div>
              {!s.content_only && (
                <p style={{ margin: "0 0 10px", color: s.quota?.ok ? "var(--text-muted)" : "var(--danger)" }}>
                  Quota: {s.quota?.existing} existing + {s.quota?.new} new = <b>{s.quota?.after}</b>
                  {s.quota?.max > 0 ? <> / {s.quota.max}</> : <> (unlimited)</>}
                  {!s.quota?.ok && " — over the limit"}
                </p>
              )}
              {(s.new_shops?.length > 0 || s.new_groups?.length > 0) && (
                <p className="u-muted" style={{ margin: "0 0 10px" }}>
                  {s.new_shops?.length > 0 && <>Locations referenced: {s.new_shops.join(", ")}. </>}
                  {s.new_groups?.length > 0 && <>Groups referenced: {s.new_groups.join(", ")}.</>}
                </p>
              )}
              {preview.rows?.length > 0 && (
                <div style={{ display: "grid", gap: 8, maxHeight: 340, overflowY: "auto", marginBottom: 10 }}>
                  {preview.rows.map((r, i) => <PreviewRow key={r.row ?? i} r={r} />)}
                </div>
              )}
              {preview.errors?.length > 0 && (
                <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--danger)", borderRadius: "var(--radius-sm)", marginBottom: 10 }}>
                  <Table columns={ERROR_COLUMNS} rows={preview.errors} rowKey={(e, i) => i} />
                </div>
              )}
              <div className="u-flex">
                <Button onClick={commit} disabled={!s.valid} loading={busy}>
                  {s.content_only
                    ? `Apply ${s.will_update || 0} content update${(s.will_update || 0) === 1 ? "" : "s"}`
                    : `Apply — ${Number(s.will_create || 0) + Number(s.will_pending || 0)} new${s.will_update ? `, ${s.will_update} updated` : ""}`}
                </Button>
                {!s.valid && <span className="u-danger">Fix the errors above and re-upload before importing.</span>}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === "pending" && (
        <div style={{ marginTop: 12 }}>
          <p className="u-muted" style={{ marginTop: 0 }}>
            These screens were imported without a Device ID. On site, read the Device ID shown on the screen and claim it here —
            or use the <Link to="/screens/pending" onClick={onClose}>Pending screens page</Link>.
          </p>
          <PendingScreens onChanged={onImported} />
        </div>
      )}
    </Modal>
  );
}
