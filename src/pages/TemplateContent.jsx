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
import { apiGet, normalizeList } from "../lib/api";
import ZoneContentEditor from "../components/templates/ZoneContentEditor";
import TemplateMap from "../components/templates/TemplateMap";
import {
  getCompanyContent, getShopContent, getDeviceContent,
} from "../components/templates/api";

const SCOPES = [
  { key: "company", label: "Whole company", icon: Building2, hint: "Default for every screen" },
  { key: "shop", label: "One location", icon: MapPin, hint: "Overrides the company default" },
  { key: "device", label: "One screen", icon: MonitorPlay, hint: "Overrides its location + company" },
];

function contentKeysOf(data) {
  const out = {};
  Object.entries(data?.content || {}).forEach(([k, v]) => {
    if (v && v.payload && Object.keys(v.payload).length) out[k] = true;
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

  useEffect(() => {
    apiGet("/company/template").then((res) =>
      setTemplate(res.ok ? res.data?.template || null : null)
    );
    apiGet("/shops", { params: { limit: 1000, offset: 0 } }).then(
      (res) => res.ok && setShops(normalizeList(res.data, "items").items)
    );
    apiGet("/devices", { params: { limit: 500, offset: 0 } }).then(
      (res) => res.ok && setDevices(normalizeList(res.data, "items").items)
    );
  }, []);

  const deviceMatches = useMemo(() => {
    const needle = deviceQuery.trim().toLowerCase();
    if (!needle) return devices;
    return devices.filter(
      (d) => (d.device_name || "").toLowerCase().includes(needle) || (d.mobile_id || "").toLowerCase().includes(needle)
    );
  }, [devices, deviceQuery]);

  // The resolved editing target for the chosen scope (null until a shop/screen picked).
  const target = useMemo(() => {
    if (scope === "company") return { scope: "company", targetId: null, targetName: "your company" };
    if (scope === "shop") {
      const s = shops.find((x) => String(x.id) === shopPick);
      return s ? { scope: "shop", targetId: s.id, targetName: s.shop_name } : null;
    }
    const d = deviceMatches.find((x) => String(x.id ?? x.mobile_id) === devicePick);
    return d ? { scope: "device", targetId: d.id, targetName: d.device_name || d.mobile_id } : null;
  }, [scope, shopPick, devicePick, shops, deviceMatches]);

  const reloadContentState = useCallback(async () => {
    if (!target) { setContentByKey({}); return; }
    const res = target.scope === "device"
      ? await getDeviceContent(target.targetId)
      : target.scope === "shop"
        ? await getShopContent(target.targetId)
        : await getCompanyContent();
    setContentByKey(res.ok ? contentKeysOf(res.data) : {});
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
      />

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
    </div>
  );
}
