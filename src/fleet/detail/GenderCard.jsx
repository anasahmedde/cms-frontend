// Gender counting report — themed port of GenderReportModal.jsx as a card.
// Rendered only when the feature is enabled for this screen (the caller
// checks /webapp/device/{id}/config); shows a pointer to Settings otherwise.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { apiGet } from "../../lib/api";
import Card from "../../ui/Card";
import Skeleton from "../../ui/Skeleton";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import { RangeChips } from "./UptimeCard";

const RANGES = [
  { key: "24h", label: "Last 24h" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

const MALE = "var(--info)";
const FEMALE = "var(--accent)";

function Stat({ title, male, female }) {
  const total = (male || 0) + (female || 0);
  return (
    <div
      style={{
        flex: 1,
        minWidth: 120,
        background: "var(--elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 14px",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{total}</div>
      <div style={{ fontSize: 12, marginTop: 2, display: "flex", gap: 10 }}>
        <span style={{ color: MALE }}>Male {male || 0}</span>
        <span style={{ color: FEMALE }}>Female {female || 0}</span>
      </div>
    </div>
  );
}

function fmtLabel(t, range) {
  const d = new Date(t);
  return range === "24h"
    ? d.toLocaleTimeString([], { hour: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function StackedBars({ data, range }) {
  const max = Math.max(1, ...data.map((d) => d.male + d.female));
  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 12 }}>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: MALE, marginRight: 4, borderRadius: 2 }} />
          Male
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: FEMALE, marginRight: 4, borderRadius: 2 }} />
          Female
        </span>
      </div>
      <div
        className="u-scroll-x"
        role="img"
        aria-label="Gender counts over time"
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 4,
          height: 220,
          borderBottom: "1px solid var(--border)",
          overflowX: "auto",
          paddingTop: 8,
        }}
      >
        {data.map((d, i) => {
          const total = d.male + d.female;
          const h = Math.round((total / max) * 190);
          const mh = total ? Math.round((d.male / total) * h) : 0;
          return (
            <div
              key={i}
              title={`${fmtLabel(d.t, range)} — Male: ${d.male}, Female: ${d.female}`}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 24 }}
            >
              <div style={{ display: "flex", flexDirection: "column-reverse", height: h, width: 14 }}>
                <div style={{ height: mh, background: MALE, borderRadius: "2px 2px 0 0" }} />
                <div style={{ height: h - mh, background: FEMALE, borderRadius: "2px 2px 0 0" }} />
              </div>
              <div style={{ fontSize: 9, color: "var(--text-faint)", marginTop: 4, whiteSpace: "nowrap" }}>
                {fmtLabel(d.t, range)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GenderCard({ mobileId, enabled }) {
  const [range, setRange] = useState("24h");
  const [state, setState] = useState({ loading: true, error: null, rows: [], summary: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const [series, summary] = await Promise.all([
      apiGet(`/webapp/device/${encodeURIComponent(mobileId)}/gender-series`, { params: { range } }),
      apiGet(`/webapp/device/${encodeURIComponent(mobileId)}/gender-summary`),
    ]);
    if (!series.ok) {
      setState({ loading: false, error: series.message || "Failed to load gender report", rows: [], summary: null });
      return;
    }
    setState({
      loading: false,
      error: null,
      rows: (series.data?.series || []).map((x) => ({
        t: x.t,
        male: Number(x.male) || 0,
        female: Number(x.female) || 0,
      })),
      summary: summary.ok ? summary.data : null,
    });
  }, [mobileId, range]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  if (!enabled) {
    return (
      <Card title="Gender counting">
        <EmptyState
          icon={Users}
          title="Gender counting is off for this screen"
          hint="It uses the camera on Linux web-player screens."
          action={<Link to={`/screens/${encodeURIComponent(mobileId)}?tab=settings`}>Enable it in Settings</Link>}
        />
      </Card>
    );
  }

  return (
    <Card
      title="Gender counting"
      actions={<RangeChips ranges={RANGES} active={range} onChange={setRange} label="Gender range" />}
    >
      {state.loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          <Skeleton height={40} />
          <Skeleton height={140} />
        </div>
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={load} />
      ) : (
        <>
          {state.summary && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <Stat title="Today" male={state.summary.today?.male} female={state.summary.today?.female} />
              <Stat title="This month" male={state.summary.month?.male} female={state.summary.month?.female} />
              <Stat title="All time" male={state.summary.alltime?.male} female={state.summary.alltime?.female} />
            </div>
          )}
          {state.rows.length === 0 ? (
            <EmptyState icon={Users} title="No gender data yet for this screen" />
          ) : (
            <StackedBars data={state.rows} range={range} />
          )}
        </>
      )}
    </Card>
  );
}
