// Footfall (door-open) counts — GET /device/{id}/count_history (+ summary):
// today / this-month / this-year tiles plus a daily bar strip.
import { useCallback, useEffect, useState } from "react";
import { Footprints } from "lucide-react";
import { apiGet } from "../../lib/api";
import Card from "../../ui/Card";
import StatCard from "../../ui/StatCard";
import Skeleton from "../../ui/Skeleton";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";

function DailyBars({ items }) {
  const data = [...items].reverse(); // API returns newest first
  const max = Math.max(1, ...data.map((d) => Number(d.count_value) || 0));
  return (
    <div
      className="u-scroll-x"
      role="img"
      aria-label="Daily footfall counts"
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 4,
        height: 140,
        borderBottom: "1px solid var(--border)",
        overflowX: "auto",
        paddingTop: 8,
        marginTop: 14,
      }}
    >
      {data.map((d, i) => {
        const v = Number(d.count_value) || 0;
        const label = d.period_date
          ? new Date(d.period_date).toLocaleDateString([], { month: "short", day: "numeric" })
          : "—";
        return (
          <div
            key={d.id ?? i}
            title={`${label}: ${v}`}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 26 }}
          >
            <div
              style={{
                height: Math.max(2, Math.round((v / max) * 110)),
                width: 14,
                background: "var(--info)",
                borderRadius: "2px 2px 0 0",
              }}
            />
            <div style={{ fontSize: 9, color: "var(--text-faint)", marginTop: 4, whiteSpace: "nowrap" }}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FootfallCard({ mobileId }) {
  const [state, setState] = useState({ loading: true, error: null, history: null, summary: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const [history, summary] = await Promise.all([
      apiGet(`/device/${encodeURIComponent(mobileId)}/count_history`, {
        params: { period_type: "daily", limit: 30 },
      }),
      apiGet(`/device/${encodeURIComponent(mobileId)}/count_history/summary`),
    ]);
    if (!history.ok) {
      setState({ loading: false, error: history.message, history: null, summary: null });
      return;
    }
    setState({
      loading: false,
      error: null,
      history: history.data,
      summary: summary.ok ? summary.data : null, // summary failure degrades to no year tile
    });
  }, [mobileId]);

  useEffect(() => {
    load();
  }, [load]);

  const { history, summary } = state;
  const current = history?.current;
  const items = history?.items || [];
  const hasAnything = current || items.length > 0;

  return (
    <Card title="Footfall">
      {state.loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          <Skeleton height={40} />
          <Skeleton height={100} />
        </div>
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={load} />
      ) : !hasAnything ? (
        <EmptyState
          icon={Footprints}
          title="No footfall data yet"
          hint="Counts appear when the screen's door sensor reports events."
        />
      ) : (
        <>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            <StatCard icon={Footprints} label="Today" value={current?.daily_count ?? "—"} tone="info" />
            <StatCard icon={Footprints} label="This month" value={current?.monthly_count ?? "—"} tone="accent" />
            {summary && (
              <StatCard
                icon={Footprints}
                label={`Year ${summary.year || new Date().getFullYear()}`}
                value={summary.yearly_total ?? "—"}
                tone="success"
              />
            )}
          </div>
          {items.length > 0 && <DailyBars items={items} />}
        </>
      )}
    </Card>
  );
}
