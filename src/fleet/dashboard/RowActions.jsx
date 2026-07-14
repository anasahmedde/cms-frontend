// Per-screen quick actions. Temperature/uptime reports moved to the screen
// detail Telemetry tab — the Activity button links there. Like the legacy
// table, actions are not permission-gated inside the dashboard (parity).
import { Play, LayoutGrid, Pencil, Activity, Unlink, Trash2 } from "lucide-react";
import IconButton from "../../ui/IconButton";
import "./dashboard.css";

export default function RowActions({ row, canPreview, onAction }) {
  const stop = (e) => e.stopPropagation(); // row click opens screen detail

  return (
    <div className="fleet-actions" onClick={stop}>
      <IconButton
        label="Preview content"
        icon={Play}
        size="sm"
        disabled={!canPreview}
        onClick={() => onAction("preview", row)}
      />
      <IconButton
        label="Edit layout"
        icon={LayoutGrid}
        size="sm"
        onClick={() => onAction("layout", row)}
      />
      <IconButton
        label="Rename screen"
        icon={Pencil}
        size="sm"
        onClick={() => onAction("rename", row)}
      />
      <IconButton
        label="Telemetry (temperature and uptime reports)"
        icon={Activity}
        size="sm"
        onClick={() => onAction("telemetry", row)}
      />
      <IconButton
        label="Unassign from group"
        icon={Unlink}
        size="sm"
        disabled={row.ungrouped}
        onClick={() => onAction("unassign", row)}
      />
      <IconButton
        label="Remove assigned media"
        icon={Trash2}
        size="sm"
        variant="danger"
        disabled={row.links.length === 0}
        onClick={() => onAction("deleteLinks", row)}
      />
    </div>
  );
}
