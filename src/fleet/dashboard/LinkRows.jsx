// Expanded row: the screen's individual media assignments (link rows),
// fetched fresh on expand so link ids are never stale. Each row deletes
// individually with a confirm.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Film, Image as ImageIcon, Trash2, Inbox } from "lucide-react";
import { apiGet, apiDelete } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import IconButton from "../../ui/IconButton";
import ConfirmModal from "../../ui/ConfirmModal";
import ErrorState from "../../ui/ErrorState";
import EmptyState from "../../ui/EmptyState";
import Skeleton from "../../ui/Skeleton";
import Badge from "../../ui/Badge";
import { useToast } from "../../ui/Toast";
import "./dashboard.css";

export default function LinkRows({ mobileId, onChanged }) {
  const toast = useToast();
  const [links, setLinks] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null); // link row pending confirm
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLinks(null);
    // GET /links?mobile_id= 500s server-side (the filter binds its pattern into
    // the tenant_id placeholder) — fetch unfiltered and match exactly here,
    // which is what the pre-revamp dashboard did too.
    const res = await apiGet("/links", {
      params: { limit: 1000, offset: 0 },
    });
    if (!res.ok) {
      setError(res.message);
      return;
    }
    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    // Keep exact rows only, and only real assignments (synthesized group rows
    // have no video).
    setLinks(
      items
        .filter((it) => it.mobile_id === mobileId && it.video_name)
        .sort((a, b) => (a.grid_position || 0) - (b.grid_position || 0))
    );
  }, [mobileId]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const res = await apiDelete(`/link/${deleting.id}`);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message || "Could not remove the media assignment");
      return;
    }
    toast.success(`Removed "${deleting.video_name}" from this screen`);
    setDeleting(null);
    load();
    onChanged?.();
  };

  return (
    <div className="fleet-linkrows">
      <p className="fleet-linkrows-title">Assigned media</p>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : links === null ? (
        <div style={{ display: "grid", gap: 8 }}>
          <Skeleton height={14} width="60%" />
          <Skeleton height={14} width="45%" />
        </div>
      ) : links.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No media assigned to this screen"
          hint="Assign media to its group to start playback."
          action={<Link to="/assign">Assign media</Link>}
        />
      ) : (
        links.map((l) => {
          const isImage = l.content_type === "image";
          const KindIcon = isImage ? ImageIcon : Film;
          return (
            <div className="fleet-linkrow" key={l.id}>
              <KindIcon size={14} aria-hidden="true" />
              <Link
                to={`/media?kind=${isImage ? "image" : "video"}&q=${encodeURIComponent(l.video_name)}`}
              >
                {l.video_name}
              </Link>
              <Badge tone={isImage ? "success" : "info"}>
                {isImage ? "Image" : "Video"}
              </Badge>
              {l.grid_position > 0 && (
                <span className="fleet-linkrow-meta">Slot {l.grid_position}</span>
              )}
              <span className="fleet-linkrow-meta">
                Added {timeAgo(l.created_at)}
              </span>
              <span style={{ marginLeft: "auto" }}>
                <IconButton
                  label={`Remove ${l.video_name} from this screen`}
                  icon={Trash2}
                  size="sm"
                  variant="danger"
                  onClick={() => setDeleting(l)}
                />
              </span>
            </div>
          );
        })
      )}

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Remove assigned media"
        message={`Remove "${deleting?.video_name || ""}" from this screen? It will stop playing on the screen after the next sync.`}
        danger
        confirmLabel="Remove media"
        loading={busy}
      />
    </div>
  );
}
