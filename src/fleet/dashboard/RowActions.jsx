// Per-screen quick actions. Temperature/uptime reports moved to the screen
// detail Telemetry tab — the Activity button links there. The dashboard is
// visible to every role, so mutating actions are permission-gated: layout /
// rename / unassign need manage_devices, removing media needs manage_links;
// preview + telemetry stay for everyone.
import { Play, LayoutGrid, Pencil, Activity, Unlink, Trash2 } from "lucide-react";
import IconButton from "../../ui/IconButton";
import { useAuth } from "../../lib/auth";
import { useCompanyFeatures, featureOn } from "../../lib/features";
import "./dashboard.css";

export default function RowActions({ row, canPreview, onAction }) {
  const stop = (e) => e.stopPropagation(); // row click opens screen detail
  const { features } = useCompanyFeatures();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_devices");
  const canAssign = hasPermission("manage_links");
  const showLayout = canManage && featureOn(features, "grid"); // default ON; company can disable

  return (
    <div className="fleet-actions" onClick={stop}>
      <IconButton
        label="Preview content"
        icon={Play}
        size="sm"
        disabled={!canPreview}
        onClick={() => onAction("preview", row)}
      />
      {showLayout && (
        <IconButton
          label="Edit layout"
          icon={LayoutGrid}
          size="sm"
          onClick={() => onAction("layout", row)}
        />
      )}
      {canManage && (
        <IconButton
          label="Rename screen"
          icon={Pencil}
          size="sm"
          onClick={() => onAction("rename", row)}
        />
      )}
      <IconButton
        label="Telemetry (temperature and uptime reports)"
        icon={Activity}
        size="sm"
        onClick={() => onAction("telemetry", row)}
      />
      {canManage && (
        <IconButton
          label="Unassign from group"
          icon={Unlink}
          size="sm"
          disabled={row.ungrouped}
          onClick={() => onAction("unassign", row)}
        />
      )}
      {canAssign && (
        <IconButton
          label="Remove assigned media"
          icon={Trash2}
          size="sm"
          variant="danger"
          disabled={row.links.length === 0}
          onClick={() => onAction("deleteLinks", row)}
        />
      )}
    </div>
  );
}
