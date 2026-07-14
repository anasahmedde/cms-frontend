// One media item card: content-type thumb, kind + type badges, rotation/fit/
// duration chips, and the four item actions (preview, edit, where-used,
// delete). Replaces the legacy Video.js / Advertisement.js table rows.
import { Play, Eye, Pencil, FolderTree, Trash2, RotateCw, Timer } from "lucide-react";
import Badge from "../../ui/Badge";
import IconButton from "../../ui/IconButton";
import CopyButton from "../../ui/CopyButton";
import { timeAgo } from "../../lib/format";
import { contentTypeOf, TYPE_ICONS, TYPE_TONES, FIT_LABELS } from "./lib";
import "./media.css";

export default function MediaCard({ item, onPreview, onEdit, onWhereUsed, onDelete }) {
  const type = contentTypeOf(item);
  const ThumbIcon = TYPE_ICONS[type] || TYPE_ICONS.video;
  const PreviewIcon = type === "video" ? Play : Eye;
  const rotation = item.rotation || 0;
  const fit = item.fit_mode || "cover";

  return (
    <article className="media-card" aria-label={item.name}>
      <div className="media-card-thumb" style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}>
        <ThumbIcon size={34} aria-hidden="true" />
      </div>

      <div className="media-card-body">
        <div className="media-card-name" title={item.name}>{item.name}</div>

        <div className="media-card-meta">
          <Badge tone={item.kind === "video" ? "info" : "success"}>
            {item.kind === "video" ? "Playlist" : "Layout image"}
          </Badge>
          {item.kind === "video" && type !== "video" && (
            <Badge tone={TYPE_TONES[type] || "neutral"}>{type.toUpperCase()}</Badge>
          )}
          {item.company_name && <Badge tone="accent">{item.company_name}</Badge>}
        </div>

        <div className="media-card-meta">
          <Badge tone="neutral">
            <RotateCw size={11} aria-hidden="true" style={{ transform: `rotate(${rotation}deg)` }} /> {rotation}°
          </Badge>
          <Badge tone="neutral">{FIT_LABELS[fit] || fit}</Badge>
          {type !== "video" && item.display_duration != null && (
            <Badge tone="neutral">
              <Timer size={11} aria-hidden="true" /> {item.display_duration}s
            </Badge>
          )}
        </div>

        <div className="u-faint u-flex">
          <span>ID {item.id}{item.created_at ? ` · added ${timeAgo(item.created_at)}` : ""}</span>
          {item.s3_link && <CopyButton value={item.s3_link} label="Copy link" small />}
        </div>
      </div>

      <div className="media-card-actions">
        <IconButton label={`Preview ${item.name}`} icon={PreviewIcon} size="sm" onClick={() => onPreview(item)} />
        <IconButton label={`Edit ${item.name}`} icon={Pencil} size="sm" onClick={() => onEdit(item)} />
        <IconButton label={`Where ${item.name} is used`} icon={FolderTree} size="sm" onClick={() => onWhereUsed(item)} />
        <IconButton label={`Delete ${item.name}`} icon={Trash2} variant="danger" size="sm" onClick={() => onDelete(item)} />
      </div>
    </article>
  );
}
