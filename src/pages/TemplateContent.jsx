// Template content hub: one place to fill the editable zones of the company's
// linked screen template — company-wide defaults, per-location, or per-screen
// (searchable). Resolution precedence on screens: screen > location > company.
import { useEffect, useMemo, useState } from "react";
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

function ScopeCard({ icon: Icon, title, hint, active, onClick, children }) {
  return (
    <Card
      title={<span className="u-flex"><Icon size={16} aria-hidden="true" /> {title}</span>}
      actions={active && <Badge tone="accent">selected</Badge>}
    >
      <p className="u-muted" style={{ marginTop: 0 }}>{hint}</p>
      {children || <Button variant={active ? "primary" : "secondary"} size="sm" onClick={onClick}>Edit content</Button>}
    </Card>
  );
}

export default function TemplateContent() {
  const [template, setTemplate] = useState(undefined); // undefined=loading, null=none
  const [shops, setShops] = useState([]);
  const [devices, setDevices] = useState([]);
  const [editing, setEditing] = useState(null); // {scope, targetId, targetName}
  const [shopPick, setShopPick] = useState("");
  const [deviceQuery, setDeviceQuery] = useState("");
  const [devicePick, setDevicePick] = useState("");

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
      (d) =>
        (d.device_name || "").toLowerCase().includes(needle) ||
        (d.mobile_id || "").toLowerCase().includes(needle)
    );
  }, [devices, deviceQuery]);

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <ScopeCard
          icon={Building2}
          title="Whole company"
          hint="Default content for every screen — used wherever a location or screen hasn't set its own."
          active={editing?.scope === "company"}
          onClick={() => setEditing({ scope: "company", targetId: null, targetName: "your company" })}
        />
        <ScopeCard
          icon={MapPin}
          title="One location"
          hint="Content for all screens at a location — overrides the company default."
          active={editing?.scope === "shop"}
        >
          <Field label="Location" htmlFor="tc-shop">
            <Select
              id="tc-shop"
              value={shopPick}
              onChange={(e) => setShopPick(e.target.value)}
              placeholder="Select a location…"
              options={shops.map((s) => ({ value: String(s.id), label: s.shop_name }))}
            />
          </Field>
          <Button
            size="sm"
            disabled={!shopPick}
            onClick={() => {
              const shop = shops.find((s) => String(s.id) === shopPick);
              setEditing({ scope: "shop", targetId: shop.id, targetName: shop.shop_name });
            }}
          >
            Edit location content
          </Button>
        </ScopeCard>
        <ScopeCard
          icon={MonitorPlay}
          title="One screen"
          hint="Content for a single screen — overrides its location and the company default."
          active={editing?.scope === "device"}
        >
          <SearchInput value={deviceQuery} onChange={setDeviceQuery} placeholder="Search screens…" />
          <div style={{ margin: "8px 0" }}>
            <Field label={`Screen (${deviceMatches.length})`} htmlFor="tc-device">
              <Select
                id="tc-device"
                value={devicePick}
                onChange={(e) => setDevicePick(e.target.value)}
                placeholder="Select a screen…"
                options={deviceMatches.map((d) => ({
                  value: String(d.id ?? d.mobile_id),
                  label: `${d.device_name || d.mobile_id} · ${d.mobile_id}`,
                }))}
              />
            </Field>
          </div>
          <Button
            size="sm"
            disabled={!devicePick}
            onClick={() => {
              const dev = deviceMatches.find((d) => String(d.id ?? d.mobile_id) === devicePick);
              setEditing({ scope: "device", targetId: dev.id, targetName: dev.device_name || dev.mobile_id });
            }}
          >
            Edit screen content
          </Button>
          <p className="u-faint" style={{ marginBottom: 0 }}>
            Also available on each screen's page: <Link to="/screens">Screens</Link> → Content & Layout.
          </p>
        </ScopeCard>
      </div>

      {editing && (
        <ZoneContentEditor
          scope={editing.scope}
          targetId={editing.targetId}
          targetName={editing.targetName}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
