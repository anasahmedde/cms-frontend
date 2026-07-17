// One fleet-table row. Clicking the row opens the screen detail page; inner
// links/chips/actions stop propagation. Layout arrives lazily (cached by
// useDeviceLayouts): undefined = loading, null = fetch failed.
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Thermometer } from "lucide-react";
import IconButton from "../../ui/IconButton";
import CopyButton from "../../ui/CopyButton";
import StatusDot from "../../ui/StatusDot";
import Badge from "../../ui/Badge";
import { useCompanyFeatures } from "../../lib/features";
import ProgressBar from "../../ui/ProgressBar";
import Skeleton from "../../ui/Skeleton";
import { timeAgo, formatBytes } from "../../lib/format";
import { LAYOUT_LABELS, contentStatusBadge, deviceStatus } from "../lib";
import RowActions from "./RowActions";
import "./dashboard.css";

const SLOT_COUNTS = { single: 1, split_h: 2, split_v: 2, grid_3: 3, grid_4: 4, grid_1x4: 4 };

// Slot summary: prefer the saved layout_config; fall back to link rows
// ordered by grid_position (same rules as the legacy table).
function buildSlots(layout, links) {
  if (!layout) return [];
  const n = SLOT_COUNTS[layout.mode] || 1;
  const slots = [];
  if (Array.isArray(layout.config) && layout.config.length > 0) {
    for (let i = 0; i < n; i++) {
      const c = layout.config.find((s) => s.position === i + 1);
      if (c?.ad_name && c?.content_type === "image") {
        slots.push({ type: "image", name: c.ad_name, rotation: c.rotation ?? 0 });
      } else if (c?.video_name) {
        slots.push({ type: "video", name: c.video_name, rotation: c.rotation ?? 0 });
      } else {
        slots.push({ type: "empty", name: null, rotation: 0 });
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      const l = links[i];
      if (l) {
        slots.push({
          type: l.content_type === "image" ? "image" : "video",
          name: l.video_name,
          rotation: l.device_rotation ?? l.rotation ?? 0,
        });
      } else {
        slots.push({ type: "empty", name: null, rotation: 0 });
      }
    }
  }
  // A bare "single" layout with one filled slot needs no chip strip.
  if (slots.length === 1 && slots[0].type !== "image") return [];
  return slots;
}

export default function FleetRow({ row, layout, progress, expanded, onToggleExpand, onAction }) {
  const { features } = useCompanyFeatures();
  const navigate = useNavigate();
  const stop = (e) => e.stopPropagation();
  const status = deviceStatus(row);
  const content = contentStatusBadge(row);
  const slots = buildSlots(layout, row.links);
  const downloading = progress?.is_downloading;
  const canPreview =
    row.links.length > 0 ||
    (row.video_count || 0) > 0 ||
    (Array.isArray(layout?.config) && layout.config.some((s) => s.ad_name));

  const openDetail = () => navigate(`/screens/${encodeURIComponent(row.mobile_id)}`);

  return (
    <tr
        className="ui-table-row-clickable"
        onClick={openDetail}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) openDetail();
        }}
        tabIndex={0}
      >
        <td onClick={stop} style={{ width: 36 }}>
          <IconButton
            label={expanded ? "Collapse media assignments" : "Show media assignments"}
            icon={expanded ? ChevronDown : ChevronRight}
            size="sm"
            onClick={() => onToggleExpand(row.mobile_id)}
            aria-expanded={expanded}
          />
        </td>
        <td>
          <div className="fleet-screen-cell">
            <Link
              className="fleet-screen-name"
              to={`/screens/${encodeURIComponent(row.mobile_id)}`}
              onClick={stop}
            >
              {row.device_name || row.mobile_id}
            </Link>
            <span className="fleet-screen-id mono" onClick={stop}>
              {row.mobile_id}
              <CopyButton value={row.mobile_id} label="Copy Device ID" small />
            </span>
            <span className="fleet-screen-status">
              <StatusDot status={status} label={status === "online" ? "Online" : "Offline"} />
              <span>· last seen {timeAgo(row.last_online_at)}</span>
            </span>
          </div>
        </td>
        <td>
          {row.ungrouped ? (
            <Badge tone="warn">Ungrouped</Badge>
          ) : (
            /* TODO(next wave): link to /groups/{gname} detail once it ships */
            <Link
              className="fleet-chip"
              to={`/groups?q=${encodeURIComponent(row.gname)}`}
              onClick={stop}
              title={row.gname}
            >
              {row.gname}
            </Link>
          )}
        </td>
        <td>
          {row.location ? (
            /* TODO(next wave): link to /locations/{shop_name} detail once it ships */
            <Link
              className="fleet-chip"
              to={`/locations?q=${encodeURIComponent(row.location)}`}
              onClick={stop}
              title={row.location}
            >
              {row.location}
            </Link>
          ) : (
            <span className="u-faint">—</span>
          )}
        </td>
        <td>
          {layout === undefined ? (
            <Skeleton width={70} height={16} />
          ) : layout === null ? (
            <span className="u-faint" title="Could not load this screen's layout">
              —
            </span>
          ) : (
            <>
              <Badge tone={layout.mode !== "single" ? "success" : "neutral"}>
                {LAYOUT_LABELS[layout.mode] || layout.mode}
              </Badge>
              {slots.length > 0 && (
                <span className="fleet-slots">
                  {slots.map((s, i) => (
                    <span
                      key={i}
                      className={`fleet-slot${s.type === "image" ? " fleet-slot--image" : ""}${s.type === "empty" ? " fleet-slot--empty" : ""}`}
                      title={
                        s.type === "empty"
                          ? `Slot ${i + 1}: empty`
                          : `Slot ${i + 1}: ${s.name} (${s.rotation}°)`
                      }
                    >
                      {s.type === "empty" ? `S${i + 1}: —` : `${s.name} ${s.rotation}°`}
                    </span>
                  ))}
                </span>
              )}
            </>
          )}
        </td>
        <td>
          <div className="fleet-playing">
            <span className="fleet-playing-summary">
              <Badge tone={content.tone}>{content.label}</Badge>
              {(row.video_count || 0) > 0 && (
                <span className="u-muted">
                  {row.downloaded_count || 0}/{row.video_count} synced
                </span>
              )}
            </span>
            {downloading && (
              <>
                <ProgressBar
                  value={Number(progress.progress) || 0}
                  tone="info"
                  label={`${Number(progress.progress) || 0}%`}
                />
                <span className="fleet-progress-file">
                  File {progress.current_file}/{progress.total_files}
                  {progress.file_name ? ` · ${progress.file_name}` : ""}
                  {progress.total_bytes > 0
                    ? ` · ${formatBytes(progress.downloaded_bytes)} / ${formatBytes(progress.total_bytes)}`
                    : ""}
                </span>
              </>
            )}
          </div>
        </td>
        <td>
          <div className="fleet-telemetry">
            {features.temperature && row.temperature != null && (
              <Badge tone="warn">
                <Thermometer size={11} aria-hidden="true" /> {row.temperature}°C
              </Badge>
            )}
            {features.footfall && row.daily_count != null && <Badge tone="info">Daily: {row.daily_count}</Badge>}
            {features.footfall && row.monthly_count != null && (
              <Badge tone="neutral">Monthly: {row.monthly_count}</Badge>
            )}
            {(!features.temperature || row.temperature == null) && (!features.footfall || (row.daily_count == null && row.monthly_count == null)) && (
              <span className="u-faint">—</span>
            )}
          </div>
        </td>
        <td>
          <RowActions row={row} canPreview={canPreview} onAction={onAction} />
        </td>
      </tr>
  );
}
