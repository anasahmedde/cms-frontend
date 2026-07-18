// Screen detail header: breadcrumbs, name (inline rename), Device ID + copy,
// live status, chips, and the header action buttons.
import { useState } from "react";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { apiPost } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import PageHeader from "../../ui/PageHeader";
import Badge from "../../ui/Badge";
import StatusDot from "../../ui/StatusDot";
import CopyButton from "../../ui/CopyButton";
import IconButton from "../../ui/IconButton";
import Button from "../../ui/Button";
import { Input } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import { useAuth } from "../../lib/auth";
import { contentStatusBadge, deviceStatus } from "../lib";
import HeaderActions from "./HeaderActions";

function NameEditor({ device, onPatched }) {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canRename = hasPermission("manage_devices");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const start = () => {
    setValue(device.device_name || "");
    setEditing(true);
  };

  const save = async () => {
    const name = value.trim();
    if (name === (device.device_name || "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const res = await apiPost(`/device/${encodeURIComponent(device.mobile_id)}/name`, {
      device_name: name,
    });
    setSaving(false);
    if (res.ok) {
      onPatched({ device_name: name });
      toast.success("Screen renamed");
      setEditing(false);
    } else {
      toast.error(res.message || "Could not rename the screen");
    }
  };

  if (!editing) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        {device.device_name || <span style={{ color: "var(--text-faint)" }}>Unnamed screen</span>}
        {canRename && <IconButton label="Rename screen" icon={Pencil} size="sm" onClick={start} />}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. Store #1 main display"
        aria-label="Screen name"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        style={{ width: 260 }}
      />
      <Button size="sm" onClick={save} loading={saving}>
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
        Cancel
      </Button>
    </span>
  );
}

// The whole action row (refresh/mute/activate/delete) is device management.
function GatedHeaderActions(props) {
  const { hasPermission } = useAuth();
  if (!hasPermission("manage_devices")) return null;
  return <HeaderActions {...props} />;
}

export default function ScreenHeader({ device, shopName, onPatched, onChanged }) {
  const status = deviceStatus(device);
  const content = contentStatusBadge(device);
  const mismatch =
    device.reported_resolution &&
    device.resolution &&
    device.reported_resolution !== device.resolution;

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Screens", to: "/screens" },
          { label: device.device_name || device.mobile_id },
        ]}
        title={<NameEditor device={device} onPatched={onPatched} />}
        actions={<GatedHeaderActions device={device} onPatched={onPatched} onChanged={onChanged} />}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          margin: "-6px 0 16px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          Device ID: {device.mobile_id}
          <CopyButton value={device.mobile_id} small />
        </span>
        <StatusDot status={status} label={status === "online" ? "Online" : "Offline"} />
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Last seen {timeAgo(device.last_online_at)}
        </span>
        {device.group_name ? (
          // TODO: link to /groups/{gname} once the Group detail route ships (next wave).
          <Link to={`/groups?q=${encodeURIComponent(device.group_name)}`}>
            <Badge tone="info">{device.group_name}</Badge>
          </Link>
        ) : (
          <Badge tone="warn">Ungrouped</Badge>
        )}
        {shopName && (
          // TODO: link to /locations/{shop_name} once the Location detail route ships (next wave).
          <Link to={`/locations?q=${encodeURIComponent(shopName)}`}>
            <Badge tone="neutral">{shopName}</Badge>
          </Link>
        )}
        {device.app_version && <Badge tone="neutral">v{device.app_version}</Badge>}
        <Badge tone={content.tone}>{content.label}</Badge>
        {mismatch && <Badge tone="warn">Reports {device.reported_resolution}</Badge>}
        {device.is_active === false && <Badge tone="danger">Deactivated</Badge>}
        {device.is_muted && <Badge tone="neutral">Muted</Badge>}
      </div>
    </div>
  );
}
