// Storage card — GET /device/{id}/storage. The backend returns storage:null
// when the screen hasn't reported yet; that is a legitimate "not reported"
// empty state, never a crash. Fields: total_bytes, used_bytes,
// available_for_content_bytes, percent_used, storage_limit_percent (RAM and
// per-media breakdown are not persisted server-side, so they aren't shown).
import { useCallback, useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { apiGet } from "../../lib/api";
import { formatBytes, timeAgo } from "../../lib/format";
import Card from "../../ui/Card";
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
    const { storage, last_updated: lastUpdated } = state.data;
    const pct = Number(storage.percent_used) || 0;
    const limit = storage.storage_limit_percent ?? 80;
    body = (
      <>
        <ProgressBar
          value={pct}
          tone={pct >= 95 ? "danger" : pct >= limit ? "warn" : "success"}
          label={`${Math.round(pct)}% used`}
        />
        <div style={{ marginTop: 12 }}>
          <KeyValue
            columns={2}
            items={[
              { label: "Total", value: formatBytes(storage.total_bytes), mono: true },
              { label: "Used", value: formatBytes(storage.used_bytes), mono: true },
              { label: "Free for content", value: formatBytes(storage.available_for_content_bytes), mono: true },
              { label: "Content limit", value: `${limit}% of disk` },
              { label: "Reported", value: timeAgo(lastUpdated) },
            ]}
          />
        </div>
      </>
    );
  }

  return <Card title="Storage">{body}</Card>;
}
