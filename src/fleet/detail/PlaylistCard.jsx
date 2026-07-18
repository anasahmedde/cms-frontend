// Assigned playlist for one screen: link rows with per-link removal plus the
// add-single-link form. Content is normally assigned per group — the hint
// links to the Assign page for group-wide edits.
import { useState } from "react";
import { Link } from "react-router-dom";
import { Film, Trash2 } from "lucide-react";
import { apiDelete } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import Table from "../../ui/Table";
import IconButton from "../../ui/IconButton";
import ConfirmModal from "../../ui/ConfirmModal";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import { useToast } from "../../ui/Toast";
import AddLinkForm from "./AddLinkForm";
import { useAuth } from "../../lib/auth";

export default function PlaylistCard({ device, links, loading, error, reload, onDeviceReload }) {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canAssign = hasPermission("manage_links"); // editors keep playlist edits; viewers read-only
  const [removeTarget, setRemoveTarget] = useState(null); // link row pending confirm
  const [removing, setRemoving] = useState(false);

  const removeLink = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    const res = await apiDelete(`/link/${removeTarget.id}`);
    setRemoving(false);
    setRemoveTarget(null);
    if (res.ok) {
      toast.success(`Removed "${removeTarget.video_name}" from this screen's playlist`);
      reload();
      onDeviceReload();
    } else {
      toast.error(res.message || "Could not remove the item");
    }
  };

  const columns = [
    {
      key: "video_name",
      label: "Media",
      render: (row) => (
        <Link
          to={`/media?kind=video&q=${encodeURIComponent(row.video_name)}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Film size={14} aria-hidden="true" />
          {row.video_name}
        </Link>
      ),
    },
    {
      key: "gname",
      label: "Group",
      render: (row) =>
        row.gname && row.gname.toLowerCase() !== "unassigned" ? (
          // TODO: /groups/{gname} once the Group detail route ships.
          <Link to={`/groups?q=${encodeURIComponent(row.gname)}`}>
            <Badge tone="info">{row.gname}</Badge>
          </Link>
        ) : (
          <Badge tone="warn">Ungrouped</Badge>
        ),
    },
    {
      key: "shop_name",
      label: "Location",
      render: (row) =>
        row.shop_name ? (
          // TODO: /locations/{shop_name} once the Location detail route ships.
          <Link to={`/locations?q=${encodeURIComponent(row.shop_name)}`}>{row.shop_name}</Link>
        ) : (
          "—"
        ),
    },
    { key: "updated_at", label: "Updated", render: (row) => timeAgo(row.updated_at) },
    ...(canAssign ? [{
      key: "actions",
      label: "",
      width: 48,
      align: "right",
      render: (row) => (
        <IconButton
          label={`Remove ${row.video_name} from playlist`}
          icon={Trash2}
          size="sm"
          onClick={() => setRemoveTarget(row)}
        />
      ),
    }] : []),
  ];

  return (
    <Card title={`Assigned playlist${links.length ? ` (${links.length})` : ""}`}>
      {device.group_name && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
          Content is assigned per group — screens in <strong>{device.group_name}</strong> share a
          playlist. <Link to="/assign">Edit the group playlist</Link> to change every screen at
          once; changes below affect only this screen.
        </p>
      )}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <Table
          columns={columns}
          rows={links}
          rowKey="id"
          loading={loading}
          empty={
            <EmptyState
              icon={Film}
              title="Nothing assigned to this screen"
              hint="Assign media below, or add the screen to a group with a playlist."
              action={<Link to="/assign">Open Assign</Link>}
            />
          }
        />
      )}

      {canAssign && (
      <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <AddLinkForm
          device={device}
          existingVideos={links.map((l) => l.video_name)}
          defaultShop={links.find((l) => l.shop_name)?.shop_name || ""}
          onAdded={() => {
            reload();
            onDeviceReload();
          }}
        />
      </div>
      )}

      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeLink}
        loading={removing}
        danger
        title="Remove from playlist"
        confirmLabel="Remove"
        message={
          removeTarget
            ? `Remove "${removeTarget.video_name}" from this screen's playlist? The screen stops playing it after its next sync.`
            : ""
        }
      />
    </Card>
  );
}
