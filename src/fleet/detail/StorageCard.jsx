// Storage & memory card — GET /device/{id}/storage. The backend returns
// {storage: null, error: …} when the columns/report don't exist yet; that is
// a legitimate "not reported" state, never a crash (design doc §6).
import { useCallback, useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { apiGet } from "../../lib/api";
import { formatBytes, timeAgo } from "../../lib/format";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import KeyValue from "../../ui/KeyValue";
import ProgressBar from "../../ui/ProgressBar";
import Skeleton from "../../ui/Skeleton";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";

export default function StorageCard({ mobileId }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const res = await apiGet(`/device/${encodeURIComponent(mobileId)}/storage`);
    if (res.ok) setState({ loading: false, error: null, data: res.data });
    else setState({ loading: false, error: res.message, data: null });
  }, [mobileId]);

  useEffect(() => {
    load();
  }, [load]);

  let body;
  if (state.loading) {
    body = (
      <div style={{ display: "grid", gap: 10 }}>
        <Skeleton height={12} />
        <Skeleton height={12} width="70%" />
        <Skeleton height={12} width="50%" />
      </div>
    );
  } else if (state.error) {
    body = <ErrorState message={state.error} onRetry={load} />;
  } else if (!state.data?.storage) {
    body = (
      <EmptyState
        icon={HardDrive}
        title="Not reported yet"
        hint="The screen reports storage after its next check-in."
      />
    );
  } else {
    const { storage, ram, low_memory: lowMemory, is_tv: isTv, last_updated: lastUpdated } = state.data;
    const pct = Number(storage.percent_used) || 0;
    body = (
      <>
        <ProgressBar
          value={pct}
          tone={pct >= 95 ? "danger" : pct >= 80 ? "warn" : "success"}
          label={`${Math.round(pct)}% used`}
        />
        <div style={{ marginTop: 12 }}>
          <KeyValue
            columns={2}
            items={[
              { label: "Total", value: formatBytes(storage.total_bytes), mono: true },
              { label: "Available", value: formatBytes(storage.available_bytes), mono: true },
              { label: "Used by media", value: formatBytes(storage.content_bytes), mono: true },
              {
                label: "RAM",
                value: ram
                  ? `${formatBytes(ram.available_bytes)} free of ${formatBytes(ram.total_bytes)}`
                  : null,
                mono: true,
              },
              { label: "Reported", value: timeAgo(lastUpdated) },
            ]}
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {lowMemory && <Badge tone="warn">Low memory</Badge>}
          {isTv && <Badge tone="neutral">TV device</Badge>}
        </div>
      </>
    );
  }

  return <Card title="Storage">{body}</Card>;
}
