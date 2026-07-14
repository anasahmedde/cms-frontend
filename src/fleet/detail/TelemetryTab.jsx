// Telemetry tab: temperature chart, footfall, gender report (when enabled),
// device logs, online/offline history.
import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { apiGet } from "../../lib/api";
import { formatDateTime, timeAgo } from "../../lib/format";
import Card from "../../ui/Card";
import Table from "../../ui/Table";
import StatusDot from "../../ui/StatusDot";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import Skeleton from "../../ui/Skeleton";
import TemperatureCard from "./TemperatureCard";
import FootfallCard from "./FootfallCard";
import GenderCard from "./GenderCard";
import LogsCard from "./LogsCard";

function OnlineHistoryCard({ mobileId }) {
  const [state, setState] = useState({ loading: true, error: null, items: [] });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const res = await apiGet(`/device/${encodeURIComponent(mobileId)}/online_history`, {
      params: { limit: 100 },
    });
    if (res.ok) setState({ loading: false, error: null, items: res.data?.items || [] });
    else setState({ loading: false, error: res.message, items: [] });
  }, [mobileId]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      key: "event_type",
      label: "Event",
      width: 140,
      render: (row) => (
        <StatusDot
          status={row.event_type === "online" ? "online" : "offline"}
          label={row.event_type === "online" ? "Online" : "Offline"}
          pulse={false}
        />
      ),
    },
    { key: "event_at", label: "When", render: (row) => formatDateTime(row.event_at) },
    { key: "ago", label: "", render: (row) => <span style={{ color: "var(--text-muted)" }}>{timeAgo(row.event_at)}</span> },
  ];

  return (
    <Card title="Online history">
      {state.error ? (
        <ErrorState message={state.error} onRetry={load} />
      ) : (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          <Table
            columns={columns}
            rows={state.items}
            rowKey="id"
            loading={state.loading}
            stickyHeader
            empty={
              <EmptyState
                icon={History}
                title="No online history yet"
                hint="Events appear once the screen connects for the first time."
              />
            }
          />
        </div>
      )}
    </Card>
  );
}

// Reads the /webapp config once to decide whether the gender card is live.
function useGenderEnabled(mobileId) {
  const [state, setState] = useState({ loading: true, error: null, enabled: false });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiGet(`/webapp/device/${encodeURIComponent(mobileId)}/config`);
      if (cancelled) return;
      if (res.ok) setState({ loading: false, error: null, enabled: !!res.data?.gender_counting_enabled });
      else setState({ loading: false, error: res.message, enabled: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [mobileId]);
  return state;
}

export default function TelemetryTab({ device }) {
  const mobileId = device.mobile_id;
  const gender = useGenderEnabled(mobileId);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <TemperatureCard mobileId={mobileId} />
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}>
        <FootfallCard mobileId={mobileId} />
        {gender.loading ? (
          <Card title="Gender counting">
            <Skeleton height={80} />
          </Card>
        ) : gender.error ? (
          <Card title="Gender counting">
            <ErrorState message={gender.error} />
          </Card>
        ) : (
          <GenderCard mobileId={mobileId} enabled={gender.enabled} />
        )}
      </div>
      <LogsCard mobileId={mobileId} />
      <OnlineHistoryCard mobileId={mobileId} />
    </div>
  );
}
