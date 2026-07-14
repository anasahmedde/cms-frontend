// Uptime summary — port of the legacy UptimeReportModal (RecentLinks.js:1353)
// as an inline card, null-safe (formatPercent/formatDuration handle missing
// numbers) and with a CSV export of the sessions.
import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { apiGet } from "../../lib/api";
import { formatDateTime, formatDuration, formatPercent } from "../../lib/format";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import Skeleton from "../../ui/Skeleton";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import { csvCell, downloadTextFile } from "./csv";

const RANGES = [
  { key: "24h", label: "24 Hours", days: 1 },
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
  { key: "90d", label: "90 Days", days: 90 },
];

export function RangeChips({ ranges, active, onChange, label = "Range" }) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {ranges.map((r) => (
        <Button
          key={r.key}
          size="sm"
          variant={active === r.key ? "primary" : "ghost"}
          aria-pressed={active === r.key}
          onClick={() => onChange(r.key)}
        >
          {r.label}
        </Button>
      ))}
    </div>
  );
}

function StatTile({ label, value, tone = "neutral" }) {
  const colors = {
    success: "var(--success)",
    danger: "var(--danger)",
    info: "var(--info)",
    warn: "var(--warn)",
    neutral: "var(--text)",
  };
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
        background: "var(--elevated)",
        minWidth: 110,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: colors[tone] }}>{value}</div>
    </div>
  );
}

export default function UptimeCard({ mobileId }) {
  const [range, setRange] = useState("7d");
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const days = RANGES.find((r) => r.key === range)?.days ?? 7;
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    const res = await apiGet(`/device/${encodeURIComponent(mobileId)}/uptime_report`, {
      params: {
        start_date: start.toISOString().split("T")[0],
        end_date: end.toISOString().split("T")[0],
      },
    });
    if (res.ok) setState({ loading: false, error: null, data: res.data });
    else setState({ loading: false, error: res.message, data: null });
  }, [mobileId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const data = state.data;
  const sessions = data?.sessions || [];
  const hasData = data && (sessions.length > 0 || Number(data.total_online_events) > 0);
  const onlinePct = Number(data?.online_percentage);
  const pctSafe = Number.isFinite(onlinePct) ? onlinePct : 0;

  const exportCsv = () => {
    const lines = ["Status,Start,End,Duration (s)"];
    sessions.forEach((s) => {
      lines.push(
        [
          csvCell(s.type),
          csvCell(s.start || ""),
          csvCell(s.ongoing ? "ongoing" : s.end || ""),
          csvCell(s.duration_seconds ?? ""),
        ].join(",")
      );
    });
    downloadTextFile(`uptime_report_${mobileId}_${range}.csv`, lines.join("\n"));
  };

  return (
    <Card
      title="Uptime"
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <RangeChips ranges={RANGES} active={range} onChange={setRange} label="Uptime range" />
          <Button size="sm" variant="secondary" icon={Download} onClick={exportCsv} disabled={!hasData}>
            Export CSV
          </Button>
        </div>
      }
    >
      {state.loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          <Skeleton height={18} />
          <Skeleton height={12} />
          <Skeleton height={12} width="60%" />
        </div>
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={load} />
      ) : !hasData ? (
        <EmptyState
          title="No uptime data for this period"
          hint="Uptime tracking starts when the screen first connects."
        />
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <StatTile label="Online time" value={formatDuration(data.total_online_seconds)} tone="success" />
            <StatTile label="Offline time" value={formatDuration(data.total_offline_seconds)} tone="danger" />
            <StatTile label="Uptime" value={formatPercent(pctSafe)} tone="info" />
            <StatTile label="Online events" value={data.total_online_events ?? "—"} />
            <StatTile label="Offline events" value={data.total_offline_events ?? "—"} />
          </div>

          <div
            role="img"
            aria-label={`Online ${formatPercent(pctSafe)}, offline ${formatPercent(100 - pctSafe)}`}
            style={{
              height: 20,
              borderRadius: 10,
              overflow: "hidden",
              display: "flex",
              background: "var(--elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ width: `${pctSafe}%`, background: "var(--success)" }} />
            <div style={{ width: `${100 - pctSafe}%`, background: "var(--danger)" }} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            <span>Online: {formatPercent(pctSafe)}</span>
            <span>Offline: {formatPercent(100 - pctSafe)}</span>
          </div>

          {sessions.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Recent sessions (last {Math.min(sessions.length, 100)})
              </div>
              <div
                className="u-scroll-x"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  maxHeight: 280,
                  overflowY: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--table-head)" }}>
                    <tr>
                      {["Status", "Start", "End", "Duration"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: h === "Duration" ? "right" : "left",
                            padding: 8,
                            borderBottom: "1px solid var(--border)",
                            color: "var(--text-muted)",
                            fontWeight: 600,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.slice(0, 100).map((s, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: 8 }}>
                          <Badge tone={s.type === "online" ? "success" : "danger"}>
                            {s.type === "online" ? "Online" : "Offline"}
                          </Badge>
                        </td>
                        <td style={{ padding: 8 }}>{formatDateTime(s.start)}</td>
                        <td style={{ padding: 8 }}>
                          {s.ongoing ? (
                            <span style={{ color: "var(--success)", fontWeight: 600 }}>Ongoing</span>
                          ) : (
                            formatDateTime(s.end)
                          )}
                        </td>
                        <td style={{ padding: 8, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          {formatDuration(s.duration_seconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
