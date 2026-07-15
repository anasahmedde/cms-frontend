// Template content hub: see the linked template as a visual layout and click a
// box to set what it shows — company-wide, per location, or per screen.
// Screens resolve content as screen > location > company.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, MapPin, MonitorPlay, LayoutTemplate } from "lucide-react";
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
import { useAuth } from "../lib/auth";
import ZoneContentEditor from "../components/templates/ZoneContentEditor";
import TemplateMap from "../components/templates/TemplateMap";
import TemplateDesigner from "../components/templates/TemplateDesigner";
import {
  getCompanyContent, getShopContent, getDeviceContent,
  getCompanyTemplateDesign, updateCompanyTemplateDesign, publishCompanyTemplateDesign,
  getContentOverrides, clearZoneOverrides,
} from "../components/templates/api";

const SCOPES = [
  { key: "company", label: "Whole company", icon: Building2, hint: "Default for every screen" },
  { key: "shop", label: "One location", icon: MapPin, hint: "Overrides the company default" },
  { key: "device", label: "One screen", icon: MonitorPlay, hint: "Overrides its location + company" },
];

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
  const [scope, setScope] = useState("company");
  const [shopPick, setShopPick] = useState("");
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
  const { user, hasPermission } = useAuth();
  const companyName = user?.company?.name || "your company";
  const canDesign = hasPermission("manage_company_settings");

  const loadTemplate = useCallback(() => {
    apiGet("/company/template").then((res) =>
      setTemplate(res.ok ? res.data?.template || null : null)
    );
  }, []);

  const loadOverrides = useCallback(() => {
    getContentOverrides().then((res) => setOverrides(res.ok ? res.data?.overrides || {} : {}));
  }, []);

  useEffect(() => {
    loadTemplate();
    loadOverrides();
    apiGet("/shops", { params: { limit: 1000, offset: 0 } }).then(
      (res) => res.ok && setShops(normalizeList(res.data, "items").items)
    );
    apiGet("/devices", { params: { limit: 500, offset: 0 } }).then(
      (res) => res.ok && setDevices(normalizeList(res.data, "items").items)
    );
  }, [loadTemplate, loadOverrides]);

  const doClearOverrides = useCallback(async () => {
    if (!clearing) return;
    setClearBusy(true);
    const res = await clearZoneOverrides(clearing.zoneKey);
    setClearBusy(false);
    const zk = clearing.zoneKey;
    setClearing(null);
    if (!res.ok) { setNotice({ kind: "error", text: `Couldn't clear pins for “${zk}”: ${res.message}` }); return; }
    setNotice({ kind: "info", text: `Cleared ${res.data?.cleared ?? 0} pinned override(s) for “${zk}”. Screens fall back to the company setting within ~30s.` });
    loadOverrides();
  }, [clearing, loadOverrides]);

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
    if (scope === "shop") {
      const s = shops.find((x) => String(x.id) === shopPick);
      return s ? { scope: "shop", targetId: s.id, targetName: s.shop_name } : null;
    }
    const d = deviceMatches.find((x) => String(x.id ?? x.mobile_id) === devicePick);
    return d ? { scope: "device", targetId: d.id, targetName: d.device_name || d.mobile_id } : null;
  }, [scope, shopPick, devicePick, shops, deviceMatches, companyName]);

  const reloadContentState = useCallback(async () => {
    if (!target) { setContentByKey({}); return; }
    const res = target.scope === "device"
      ? await getDeviceContent(target.targetId)
      : target.scope === "shop"
        ? await getShopContent(target.targetId)
        : await getCompanyContent();
    setContentByKey(res.ok ? contentByKeyOf(res.data) : {});
  }, [target]);

  useEffect(() => { reloadContentState(); }, [reloadContentState]);

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
            <span className="u-faint">Screens resolve content as screen → location → company</span>
          </span>
        }
        actions={
          canDesign && (
            <Button variant="secondary" icon={LayoutTemplate} onClick={openDesigner} disabled={designerBusy}>
              {designerBusy ? "Opening…" : "Open designer"}
            </Button>
          )
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
              const nD = (o.devices || []).length, nS = (o.shops || []).length;
              const parts = [nD && `${nD} screen${nD > 1 ? "s" : ""}`, nS && `${nS} location${nS > 1 ? "s" : ""}`].filter(Boolean);
              return (
                <div key={zoneKey} className="u-flex" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span>📌 <strong>{zoneKey}</strong> — pinned on {parts.join(", ")}</span>
                  <Button variant="secondary" size="sm" onClick={() => setClearing({ zoneKey, count: nD + nS })}>
                    Clear pins
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        {!target ? (
          <EmptyState
            icon={scope === "shop" ? MapPin : MonitorPlay}
            title={scope === "shop" ? "Pick a location" : "Pick a screen"}
            hint="Choose one above to see its template layout and set content per box."
          />
        ) : (
          <Card title={`Layout — ${target.targetName}`}>
            <TemplateMap
              template={template}
              contentByKey={contentByKey}
              overrides={scope === "company" ? overrides : {}}
              selectedKey={editing?.focusZoneKey}
              onZoneClick={(zoneKey) => setEditing({ ...target, focusZoneKey: zoneKey })}
            />
          </Card>
        )}
      </div>

      {editing && (
        <ZoneContentEditor
          scope={editing.scope}
          targetId={editing.targetId}
          targetName={editing.targetName}
          focusZoneKey={editing.focusZoneKey}
          onClose={() => { setEditing(null); reloadContentState(); }}
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

      <ConfirmModal
        open={!!clearing}
        onClose={() => setClearing(null)}
        onConfirm={doClearOverrides}
        title={`Clear pinned content for “${clearing?.zoneKey}”?`}
        message={`${clearing?.count || 0} screen/location override(s) for this box will be removed — those screens fall back to the company-wide setting. This can't be undone.`}
        danger
        confirmLabel="Clear pins"
        loading={clearBusy}
      />
    </div>
  );
}
