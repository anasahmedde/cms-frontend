// Template content hub: see the linked template as a visual layout and click a
// box to set what it shows — company-wide, per location, or per screen.
// Screens resolve content as screen > location > company.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, MapPin, MonitorPlay, LayoutTemplate, Users, Upload } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import SearchInput from "../ui/SearchInput";
import EmptyState from "../ui/EmptyState";
import { SkeletonText } from "../ui/Skeleton";
import { Field, Select } from "../ui/Field";
import ConfirmModal from "../ui/ConfirmModal";
import { apiGet, normalizeList } from "../lib/api";
import { useAuth, CONTENT_EDIT_PERMS } from "../lib/auth";
import { timeAgo } from "../lib/format";
import BulkImport from "../fleet/enroll/BulkImport";
import ZoneContentEditor from "../components/templates/ZoneContentEditor";
import TemplateMap from "../components/templates/TemplateMap";
import TemplatePreview from "../components/templates/TemplatePreview";
import TemplateDesigner from "../components/templates/TemplateDesigner";
import {
  getCompanyContent, getShopContent, getDeviceContent, getGroupContent,
  getCompanyTemplateDesign, updateCompanyTemplateDesign, publishCompanyTemplateDesign,
  getContentOverrides, clearZoneOverrides, getTemplatePreview,
} from "../components/templates/api";

const SCOPES = [
  { key: "company", label: "Whole company", icon: Building2, hint: "Default for every screen" },
  { key: "group", label: "One group", icon: Users, hint: "Applies to every device in the group, wherever it's located — overrides the location + company defaults" },
  { key: "shop", label: "One location", icon: MapPin, hint: "Overrides the company default" },
  { key: "device", label: "One screen", icon: MonitorPlay, hint: "Overrides its group, location + company" },
];

const STATUS_TONES = { pending: "warn", approved: "success", rejected: "danger", cancelled: "neutral", expired: "neutral" };

// Keep the actual payload (not just a boolean) so the layout preview can show
// what each editable zone is set to at this scope. Empty payloads are dropped,
// so `!!byKey[zoneKey]` still reads as "has content set here".
function contentByKeyOf(data) {
  const out = {};
  Object.entries(data?.content || {}).forEach(([k, v]) => {
    if (v && v.payload && Object.keys(v.payload).length) out[k] = v.payload;
  });
  return out;
}

export default function TemplateContent() {
  const [template, setTemplate] = useState(undefined); // undefined=loading, null=none
  const [shops, setShops] = useState([]);
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [scope, setScope] = useState("company");
  const [shopPick, setShopPick] = useState("");
  const [groupPick, setGroupPick] = useState("");
  const [deviceQuery, setDeviceQuery] = useState("");
  const [devicePick, setDevicePick] = useState("");
  const [contentByKey, setContentByKey] = useState({});
  const [editing, setEditing] = useState(null); // {scope, targetId, targetName, focusZoneKey}
  const [designerTpl, setDesignerTpl] = useState(null); // template loaded into the designer
  const [designerBusy, setDesignerBusy] = useState(false);
  const [notice, setNotice] = useState(null); // {kind:"error"|"info", text}
  const [overrides, setOverrides] = useState({}); // zone_key -> {shops:[], devices:[]}
  const [clearing, setClearing] = useState(null); // {zoneKey, count} pending confirm
  const [clearBusy, setClearBusy] = useState(false);
  const [preview, setPreview] = useState(null); // {template, zones} resolved WYSIWYG
  const [scopeTemplate, setScopeTemplate] = useState(null); // effective template at the picked scope
  const [bulkOpen, setBulkOpen] = useState(false); // bulk-import modal
  const [contentRequests, setContentRequests] = useState([]); // template_content approval requests
  const { user, hasPermission } = useAuth();
  const companyName = user?.company?.name || "your company";
  const canDesign = hasPermission("manage_company_settings");
  const canEdit = CONTENT_EDIT_PERMS.some((p) => hasPermission(p)); // viewer role → read-only
  // Every content editor gets the sheet: manage_devices holders do full bulk
  // (enroll + content); editors get content-only bulk, approval-aware — the
  // backend enforces both modes server-side.
  const canBulk = canEdit;

  const loadTemplate = useCallback(() => {
    apiGet("/company/template").then((res) =>
      setTemplate(res.ok ? res.data?.template || null : null)
    );
  }, []);

  const loadOverrides = useCallback(() => {
    getContentOverrides().then((res) => setOverrides(res.ok ? res.data?.overrides || {} : {}));
  }, []);

  // Template-content approval requests: drive the per-zone ⏳ badges and the
  // requester's own submissions strip. Older backends without the
  // request_type filter just return an unfiltered list — harmless.
  const loadContentRequests = useCallback(() => {
    apiGet("/content-changes", {
      params: { status: "all", request_type: "template_content", limit: 100 },
    }).then((res) => {
      if (!res.ok) { setContentRequests([]); return; }
      const items = res.data?.requests || [];
      setContentRequests(items.filter((r) => r.request_type === "template_content"));
    });
  }, []);

  useEffect(() => {
    loadTemplate();
    loadOverrides();
    loadContentRequests();
    apiGet("/shops", { params: { limit: 1000, offset: 0 } }).then(
      (res) => res.ok && setShops(normalizeList(res.data, "items").items)
    );
    apiGet("/devices", { params: { limit: 500, offset: 0 } }).then(
      (res) => res.ok && setDevices(normalizeList(res.data, "items").items)
    );
    apiGet("/groups", { params: { limit: 1000, offset: 0 } }).then(
      (res) => res.ok && setGroups(normalizeList(res.data, "items").items)
    );
  }, [loadTemplate, loadOverrides, loadContentRequests]);

  const doClearOverrides = useCallback(async () => {
    if (!clearing) return;
    setClearBusy(true);
    const res = await clearZoneOverrides(clearing.zoneKey);
    setClearBusy(false);
    const zk = clearing.zoneKey;
    setClearing(null);
    if (!res.ok) { setNotice({ kind: "error", text: `Couldn't clear pins for “${zk}”: ${res.message}` }); return; }
    if (res.data?.status === "pending_approval") {
      setNotice({ kind: "info", text: `Clearing the pins for “${zk}” was submitted for approval — nothing changes until a manager or admin approves it.` });
      loadContentRequests();
      return;
    }
    setNotice({ kind: "info", text: `Cleared ${res.data?.cleared ?? 0} pinned override(s) for “${zk}”. Screens fall back to the company setting within ~30s.` });
    loadOverrides();
  }, [clearing, loadOverrides, loadContentRequests]);

  const openDesigner = useCallback(async () => {
    setDesignerBusy(true);
    setNotice(null);
    const res = await getCompanyTemplateDesign();
    setDesignerBusy(false);
    if (!res.ok || !res.data?.template) {
      setNotice({ kind: "error", text: `Couldn't open the designer: ${res.message || "no template to edit"}` });
      return;
    }
    setDesignerTpl(res.data.template);
  }, []);

  const closeDesigner = useCallback(() => {
    setDesignerTpl(null);
    loadTemplate(); // a publish may have changed the live template/version
  }, [loadTemplate]);

  const deviceMatches = useMemo(() => {
    const needle = deviceQuery.trim().toLowerCase();
    if (!needle) return devices;
    return devices.filter(
      (d) => (d.device_name || "").toLowerCase().includes(needle) || (d.mobile_id || "").toLowerCase().includes(needle)
    );
  }, [devices, deviceQuery]);

  // The resolved editing target for the chosen scope (null until a shop/screen picked).
  const target = useMemo(() => {
    if (scope === "company") return { scope: "company", targetId: null, targetName: companyName };
    if (scope === "group") {
      const g = groups.find((x) => String(x.id) === groupPick);
      return g ? { scope: "group", targetId: g.id, targetName: g.gname } : null;
    }
    if (scope === "shop") {
      const s = shops.find((x) => String(x.id) === shopPick);
      return s ? { scope: "shop", targetId: s.id, targetName: s.shop_name } : null;
    }
    const d = deviceMatches.find((x) => String(x.id ?? x.mobile_id) === devicePick);
    return d ? { scope: "device", targetId: d.id, targetName: d.device_name || d.mobile_id } : null;
  }, [scope, shopPick, groupPick, devicePick, shops, groups, deviceMatches, companyName]);

  const reloadContentState = useCallback(async () => {
    if (!target) { setContentByKey({}); setPreview(null); setScopeTemplate(null); return; }
    const res = target.scope === "device"
      ? await getDeviceContent(target.targetId)
      : target.scope === "group"
        ? await getGroupContent(target.targetId)
        : target.scope === "shop"
          ? await getShopContent(target.targetId)
          : await getCompanyContent();
    setContentByKey(res.ok ? contentByKeyOf(res.data) : {});
    // The scope's EFFECTIVE template (a group/screen may render a different one
    // than the company default) — drives the layout map for this scope.
    setScopeTemplate(res.ok ? res.data?.template || null : null);
    const pv = await getTemplatePreview({
      scope: target.scope,
      shopId: target.scope === "shop" ? target.targetId : undefined,
      deviceId: target.scope === "device" ? target.targetId : undefined,
      groupId: target.scope === "group" ? target.targetId : undefined,
    });
    setPreview(pv.ok ? pv.data : null);
  }, [target]);

  useEffect(() => { reloadContentState(); }, [reloadContentState]);

  // Content changes arrive from OUTSIDE this tab too — an Excel upload in
  // another window, a teammate's edit, a bulk commit. Refetch whenever the
  // tab regains focus so the map/preview can't sit stale ("I updated on
  // Excel and the screen changed but this page didn't").
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        reloadContentState();
        loadOverrides();
        loadContentRequests();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [reloadContentState, loadOverrides, loadContentRequests]);

  // Zones with a change waiting for approval at the CURRENTLY selected
  // scope/target — shown as ⏳ on the layout map (any requester's).
  const pendingKeys = useMemo(() => {
    const keys = new Set();
    if (!target) return keys;
    contentRequests.forEach((r) => {
      if (r.status !== "pending") return;
      const cd = r.change_data || {};
      if (cd.scope !== target.scope) return;
      const cdTarget = cd.device_id ?? cd.group_id ?? cd.shop_id ?? null;
      const matches = target.scope === "company"
        ? true
        : String(cdTarget) === String(target.targetId);
      if (matches && cd.zone_key) keys.add(cd.zone_key);
    });
    return keys;
  }, [contentRequests, target]);

  // The user's own submissions (editors under the approval requirement):
  // everything pending plus the latest decided ones, so a rejection with its
  // note is never invisible to the person who asked.
  const mySubmissions = useMemo(() => {
    const mine = contentRequests.filter((r) => r.requested_by === user?.id);
    const pending = mine.filter((r) => r.status === "pending");
    const decided = mine.filter((r) => r.status !== "pending").slice(0, 5);
    return { pending, decided, any: pending.length + decided.length > 0 };
  }, [contentRequests, user?.id]);

  if (template === undefined) {
    return (
      <div>
        <PageHeader title="Template content" subtitle="Fill the editable zones of your screen template" />
        <SkeletonText lines={5} />
      </div>
    );
  }
  if (template === null) {
    return (
      <div>
        <PageHeader title="Template content" subtitle="Fill the editable zones of your screen template" />
        <EmptyState
          icon={LayoutTemplate}
          title="No screen template linked"
          hint="Your platform administrator can link a template to your company; its editable zones then appear here."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Template content"
        subtitle={
          <span className="u-flex">
            Template <Badge tone="info">{template.name} · v{template.version}</Badge>
            <span className="u-faint">Screens resolve content as screen → group → location → company</span>
          </span>
        }
        actions={
          <div className="u-flex" style={{ gap: 8 }}>
            {canBulk && (
              <Button variant="secondary" icon={Upload} onClick={() => setBulkOpen(true)}>
                Bulk upload
              </Button>
            )}
            {canDesign && (
              <Button variant="secondary" icon={LayoutTemplate} onClick={openDesigner} disabled={designerBusy}>
                {designerBusy ? "Opening…" : "Open designer"}
              </Button>
            )}
          </div>
        }
      />

      {notice && (
        <Card>
          <div className="u-flex" style={{ justifyContent: "space-between", gap: 8, color: notice.kind === "error" ? "var(--danger)" : "var(--text)" }}>
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss message" style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }}>✕</button>
          </div>
        </Card>
      )}

      {mySubmissions.any && (
        <Card title="Your submitted changes">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...mySubmissions.pending, ...mySubmissions.decided].map((r) => {
              const cd = r.change_data || {};
              return (
                <div key={r.id} className="u-flex" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <Badge tone={STATUS_TONES[r.status] || "neutral"}>{r.status}</Badge>
                  <span>
                    <strong>{cd.zone_label || cd.zone_key}</strong>
                    {r.target_name ? <> on <strong>{r.target_name}</strong></> : null}
                    {cd.action === "delete" || cd.action === "clear_overrides" ? " (clear content)" : ""}
                  </span>
                  <span className="u-faint">{timeAgo(r.requested_at)}</span>
                  {r.status === "rejected" && r.review_note && (
                    <span className="u-muted">— “{r.review_note}”</span>
                  )}
                </div>
              );
            })}
          </div>
          {mySubmissions.pending.length > 0 && (
            <p className="u-muted" style={{ margin: "10px 0 0" }}>
              Pending changes apply to screens only after a manager or admin approves them.
            </p>
          )}
        </Card>
      )}

      <Card title="Editing content for">
        <div className="u-flex" style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {SCOPES.map((s) => (
            <Button
              key={s.key}
              variant={scope === s.key ? "primary" : "secondary"}
              size="sm"
              icon={s.icon}
              onClick={() => setScope(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </div>
        {scope === "group" && (
          <Field label={`Group (${groups.length})`} htmlFor="tc-group">
            <Select
              id="tc-group"
              value={groupPick}
              onChange={(e) => setGroupPick(e.target.value)}
              placeholder="Select a group…"
              options={groups.map((g) => ({ value: String(g.id), label: g.gname }))}
            />
          </Field>
        )}
        {scope === "shop" && (
          <Field label="Location" htmlFor="tc-shop">
            <Select
              id="tc-shop"
              value={shopPick}
              onChange={(e) => setShopPick(e.target.value)}
              placeholder="Select a location…"
              options={shops.map((s) => ({ value: String(s.id), label: s.shop_name }))}
            />
          </Field>
        )}
        {scope === "device" && (
          <>
            <SearchInput value={deviceQuery} onChange={setDeviceQuery} placeholder="Search screens…" />
            <div style={{ marginTop: 8 }}>
              <Field label={`Screen (${deviceMatches.length})`} htmlFor="tc-device">
                <Select
                  id="tc-device"
                  value={devicePick}
                  onChange={(e) => setDevicePick(e.target.value)}
                  placeholder="Select a screen…"
                  options={deviceMatches.map((d) => ({ value: String(d.id ?? d.mobile_id), label: `${d.device_name || d.mobile_id} · ${d.mobile_id}` }))}
                />
              </Field>
            </div>
          </>
        )}
        <p className="u-muted" style={{ margin: "4px 0 0" }}>
          {SCOPES.find((s) => s.key === scope)?.hint}.
          {scope === "device" && <> Also on each screen's page: <Link to="/screens">Screens</Link> → Content &amp; Layout.</>}
        </p>
      </Card>

      {scope === "company" && Object.keys(overrides).length > 0 && (
        <Card title="Some boxes are pinned to specific screens or locations">
          <p className="u-muted" style={{ marginTop: 0 }}>
            These boxes have their own content set on specific screens/locations, so your
            company-wide changes <strong>won't appear there</strong> until you clear the pins.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(overrides).map(([zoneKey, o]) => {
              const nD = (o.devices || []).length, nS = (o.shops || []).length, nG = (o.groups || []).length;
              const parts = [
                nD && `${nD} screen${nD > 1 ? "s" : ""}`,
                nG && `${nG} group${nG > 1 ? "s" : ""}`,
                nS && `${nS} location${nS > 1 ? "s" : ""}`,
              ].filter(Boolean);
              return (
                <div key={zoneKey} className="u-flex" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span>📌 <strong>{zoneKey}</strong> — pinned on {parts.join(", ")}</span>
                  {canEdit && (
                    <Button variant="secondary" size="sm" onClick={() => setClearing({ zoneKey, count: nD + nS + nG })}>
                      Clear pins
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        {!target ? (
          <EmptyState
            icon={scope === "shop" ? MapPin : scope === "group" ? Users : MonitorPlay}
            title={scope === "shop" ? "Pick a location" : scope === "group" ? "Pick a group" : "Pick a screen"}
            hint="Choose one above to see its template layout and set content per box."
          />
        ) : (
          <Card
            title={`Layout — ${target.targetName}${scopeTemplate && scopeTemplate.id !== template?.id ? ` · renders “${scopeTemplate.name}”` : ""}`}
            actions={
              <Button variant="secondary" size="sm" onClick={() => { reloadContentState(); loadOverrides(); }}>
                Refresh
              </Button>
            }
          >
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div>
                <p className="u-faint" style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600 }}>
                  {canEdit ? "Click a box to set its content" : "The template's boxes and what they show"}
                </p>
                <TemplateMap
                  template={scopeTemplate || template}
                  contentByKey={contentByKey}
                  overrides={scope === "company" ? overrides : {}}
                  selectedKey={editing?.focusZoneKey}
                  readOnly={!canEdit}
                  pendingKeys={pendingKeys}
                  onZoneClick={(zoneKey) => canEdit && setEditing({ ...target, focusZoneKey: zoneKey })}
                />
              </div>
              <div>
                <p className="u-faint" style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600 }}>How it looks on screen</p>
                {preview?.zones
                  ? <TemplatePreview template={preview.template} zones={preview.zones}
                      overrides={scope === "company" ? overrides : {}} />
                  : <div style={{ width: 240, minHeight: 120 }}><SkeletonText lines={3} /></div>}
              </div>
            </div>
          </Card>
        )}
      </div>

      {editing && (
        <ZoneContentEditor
          scope={editing.scope}
          targetId={editing.targetId}
          targetName={editing.targetName}
          focusZoneKey={editing.focusZoneKey}
          onPendingSubmitted={loadContentRequests}
          onClose={() => { setEditing(null); reloadContentState(); loadContentRequests(); }}
        />
      )}

      {designerTpl && (
        <TemplateDesigner
          template={designerTpl}
          saveApi={updateCompanyTemplateDesign}
          publishApi={publishCompanyTemplateDesign}
          onClose={closeDesigner}
          onSaved={() => {}}
        />
      )}

      {bulkOpen && (
        <BulkImport
          open
          onClose={() => setBulkOpen(false)}
          onImported={() => {
            // New screens/locations/groups + per-screen content may have landed —
            // refresh the pickers, the pinned-override list and the current preview.
            loadOverrides();
            reloadContentState();
            apiGet("/shops", { params: { limit: 1000, offset: 0 } }).then((res) => res.ok && setShops(normalizeList(res.data, "items").items));
            apiGet("/devices", { params: { limit: 500, offset: 0 } }).then((res) => res.ok && setDevices(normalizeList(res.data, "items").items));
            apiGet("/groups", { params: { limit: 1000, offset: 0 } }).then((res) => res.ok && setGroups(normalizeList(res.data, "items").items));
          }}
        />
      )}

      <ConfirmModal
        open={!!clearing}
        onClose={() => setClearing(null)}
        onConfirm={doClearOverrides}
        title={`Clear pinned content for “${clearing?.zoneKey}”?`}
        message={`${clearing?.count || 0} screen/group/location override(s) for this box will be removed — those screens fall back to the company-wide setting. This can't be undone.`}
        danger
        confirmLabel="Clear pins"
        loading={clearBusy}
      />
    </div>
  );
}
