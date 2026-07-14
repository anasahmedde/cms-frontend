// Overview tab: details, playlist summary + live download progress,
// uptime summary, storage.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { formatBytes, formatDateTime, timeAgo } from "../../lib/format";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import KeyValue from "../../ui/KeyValue";
import ProgressBar from "../../ui/ProgressBar";
import { contentStatusBadge, useDownloadProgress } from "../lib";
import UptimeCard from "./UptimeCard";
import StorageCard from "./StorageCard";

function DetailsCard({ device, shopName }) {
  const [ble, setBle] = useState({ loading: true, error: false, value: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiGet(`/device/${encodeURIComponent(device.mobile_id)}/ble-id`);
      if (cancelled) return;
      if (res.ok) setBle({ loading: false, error: false, value: res.data?.ble_device_id || null });
      else setBle({ loading: false, error: true, value: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [device.mobile_id]);

  const mismatch =
    device.reported_resolution &&
    device.resolution &&
    device.reported_resolution !== device.resolution;

  const items = [
    {
      label: "Resolution",
      value: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)" }}>{device.resolution || "Auto"}</span>
          {mismatch && <Badge tone="warn">reports {device.reported_resolution}</Badge>}
        </span>
      ),
    },
    { label: "App version", value: device.app_version, mono: true },
    {
      label: "BLE ID",
      value: ble.loading ? "Loading…" : ble.error ? "Couldn't load" : ble.value || "Not set",
      mono: !ble.loading && !ble.error && !!ble.value,
    },
    {
      label: "Group",
      value: device.group_name ? (
        // TODO: point at /groups/{gname} when the Group detail route ships.
        <Link to={`/groups?q=${encodeURIComponent(device.group_name)}`}>{device.group_name}</Link>
      ) : (
        "Ungrouped"
      ),
    },
    {
      label: "Location",
      value: shopName ? (
        // TODO: point at /locations/{shop_name} when the Location detail route ships.
        <Link to={`/locations?q=${encodeURIComponent(shopName)}`}>{shopName}</Link>
      ) : null,
    },
    { label: "Created", value: formatDateTime(device.created_at) },
    { label: "Last seen", value: timeAgo(device.last_online_at) },
    { label: "Updated", value: formatDateTime(device.updated_at) },
  ];

  return (
    <Card title="Details">
      <KeyValue items={items} columns={2} />
    </Card>
  );
}

function PlaylistSummaryCard({ device, progress }) {
  const videoCount = Number(device.video_count) || 0;
  const downloadedCount = Number(device.downloaded_count) || 0;
  const content = contentStatusBadge(device);

  return (
    <Card
      title="Current playlist"
      actions={<Link to={`/screens/${encodeURIComponent(device.mobile_id)}?tab=content`}>View playlist</Link>}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Badge tone={content.tone}>{content.label}</Badge>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {videoCount === 0
            ? "No media assigned"
            : `${downloadedCount} of ${videoCount} item${videoCount === 1 ? "" : "s"} downloaded`}
        </span>
      </div>
      {videoCount > 0 && (
        <ProgressBar
          value={downloadedCount}
          max={videoCount}
          tone={downloadedCount >= videoCount ? "success" : "info"}
          label={`${downloadedCount}/${videoCount}`}
        />
      )}
      {progress && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
            Downloading file {progress.current_file}/{progress.total_files}
            {progress.file_name ? ` — ${progress.file_name}` : ""}
          </div>
          <ProgressBar
            value={Number(progress.progress) || 0}
            tone="info"
            label={`${Number(progress.progress) || 0}% · ${formatBytes(progress.downloaded_bytes)} / ${formatBytes(progress.total_bytes)}`}
          />
        </div>
      )}
    </Card>
  );
}

export default function OverviewTab({ device, shopName }) {
  const deviceList = useMemo(() => (device ? [device] : []), [device]);
  const { progressByMobileId } = useDownloadProgress(deviceList);
  const progress = progressByMobileId[device.mobile_id];

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}>
      <DetailsCard device={device} shopName={shopName} />
      <PlaylistSummaryCard device={device} progress={progress} />
      <StorageCard mobileId={device.mobile_id} />
      <div style={{ gridColumn: "1 / -1" }}>
        <UptimeCard mobileId={device.mobile_id} />
      </div>
    </div>
  );
}
