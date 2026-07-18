// Expanded row: what the screen is actually playing — the resolved template
// layout (when one is linked) and the individual media assignments (link
// rows), fetched fresh on expand so link ids are never stale. Each link row
// deletes individually with a confirm.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Film,
  Image as ImageIcon,
  Trash2,
  Inbox,
  LayoutTemplate,
  Type,
  QrCode,
  ListVideo,
  Clock,
} from "lucide-react";
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

const ZONE_ICONS = { media: Film, qr: QrCode, playlist: ListVideo, clock: Clock };

// One-line human summary of what a resolved zone renders right now.
function zoneSummary(zone) {
  const c = zone.content || {};
  if (zone.type === "playlist" || c.playlist) {
    return { label: "Plays the assigned media (playlist zone)", faint: false };
  }
  if (zone.type === "clock") return { label: "Clock", faint: false };
  if (zone.type === "qr") {
    return c.media_url
      ? { label: "QR code", faint: false }
      : { label: "No QR set", faint: true };
  }
  if (zone.type === "media") {
    if (!c.media_url) return { label: "Nothing set", faint: true };
    return { label: c.media_type === "video" ? "Video" : "Image", faint: false, url: c.media_url };
  }
  // text / ticker: prefer plain words, else the designed runs' words.
  const words =
    (typeof c.text === "string" && c.text.trim()) ||
    (Array.isArray(c.runs) && c.runs.map((r) => r.text).filter(Boolean).join(" · "));
  return words
    ? { label: `“${words.length > 80 ? `${words.slice(0, 80)}…` : words}”`, faint: false }
    : { label: "No text set", faint: true };
}

// The resolved template a linked screen renders — same endpoint the player
// itself fetches, so this panel is the playback truth, not a guess.
function TemplateZones({ mobileId, onPlaylistZone }) {
  const [tpl, setTpl] = useState(null); // null = loading
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    setTpl(null);
    const res = await apiGet(`/device/${encodeURIComponent(mobileId)}/template`);
    if (!res.ok) {
      // 404 = template unlinked between list refreshes — treat as "no panel".
      if (res.status === 404) setTpl({ zones: [] });
      else setError(res.message);
      return;
    }
    setTpl(res.data || { zones: [] });
    onPlaylistZone?.(
      (res.data?.zones || []).some((z) => z.type === "playlist" || z.content?.playlist)
    );
  }, [mobileId, onPlaylistZone]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div style={{ marginBottom: 12 }}>
        <p className="fleet-linkrows-title">Template layout</p>
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }
  if (tpl === null) {
    return (
      <div style={{ marginBottom: 12, display: "grid", gap: 8 }}>
        <Skeleton height={14} width="40%" />
        <Skeleton height={14} width="65%" />
      </div>
    );
  }
  if (!tpl.zones || tpl.zones.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <p className="fleet-linkrows-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <LayoutTemplate size={14} aria-hidden="true" />
        Template layout{tpl.name ? ` — ${tpl.name}` : ""}
        <span className="fleet-linkrow-meta">v{tpl.version}</span>
      </p>
      {tpl.zones.map((z) => {
        const ZoneIcon = ZONE_ICONS[z.type] || Type;
        const s = zoneSummary(z);
        return (
          <div className="fleet-linkrow" key={z.key}>
            <ZoneIcon size={14} aria-hidden="true" />
            <span style={{ fontWeight: 500 }}>{z.key}</span>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            ) : (
              <span className={s.faint ? "fleet-linkrow-meta" : undefined}>{s.label}</span>
            )}
          </div>
        );
      })}
      <p className="fleet-linkrow-meta" style={{ margin: "6px 0 0" }}>
        Content resolves screen &gt; group &gt; location &gt; company —{" "}
        <Link to="/template-content">manage template content</Link>
      </p>
    </div>
  );
}

export default function LinkRows({ mobileId, templateLinked = false, onChanged }) {
  const toast = useToast();
  const [links, setLinks] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null); // link row pending confirm
  const [busy, setBusy] = useState(false);
  const [hasPlaylistZone, setHasPlaylistZone] = useState(false);

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
      {templateLinked && (
        <TemplateZones mobileId={mobileId} onPlaylistZone={setHasPlaylistZone} />
      )}

      {/* The playlist section is only meaningful when something plays it: hide
          it entirely for a template screen without a playlist zone instead of
          showing a misleading "No media assigned" for a screen that IS playing. */}
      {templateLinked && !hasPlaylistZone && (links === null || links.length === 0) ? null : (
        <>
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
              title={
                templateLinked
                  ? "The template's playlist zone has no media yet"
                  : "No media assigned to this screen"
              }
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
        </>
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
