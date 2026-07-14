// Temperature card — themed port of the legacy TemperatureLineGraph
// (Device.js:38) + the range picker & series endpoint of the RecentLinks
// modal (RecentLinks.js:978), incl. both CSV exports.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { apiGet } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Skeleton from "../../ui/Skeleton";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import { RangeChips } from "./UptimeCard";
import { csvCell, downloadTextFile } from "./csv";

const RANGES = [
  { key: "24h", label: "24 Hours", days: 1, bucket: "hour" },
  { key: "7d", label: "7 Days", days: 7, bucket: "day" },
  { key: "30d", label: "30 Days", days: 30, bucket: "day" },
  { key: "90d", label: "90 Days", days: 90, bucket: "day" },
];

function Stat({ label, value }) {
  return (
    <div
      style={{
        padding: "8px 14px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
        background: "var(--elevated)",
        minWidth: 90,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{value}</div>
    </div>
  );
}

function LineChart({ series, range }) {
  const W = 680;
  const H = 260;
  const pad = { l: 48, r: 16, t: 16, b: 40 };

  const model = useMemo(() => {
    if (!series.length) return null;
    const tMin = series[0].t.getTime();
    const tMax = series[series.length - 1].t.getTime();
    const temps = series.map((p) => p.temperature);
    let yMin = Math.min(...temps);
    let yMax = Math.max(...temps);
    if (yMax === yMin) {
      yMax += 1;
      yMin -= 1;
    } else {
      const p = (yMax - yMin) * 0.1;
      yMax += p;
      yMin -= p;
    }
    const x = (t) => (tMax === tMin ? pad.l : pad.l + ((t - tMin) / (tMax - tMin)) * (W - pad.l - pad.r));
    const y = (v) => pad.t + ((yMax - v) / (yMax - yMin)) * (H - pad.t - pad.b);
    const pts = series.map((p) => [x(p.t.getTime()), y(p.temperature)]);
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const yTicks = Array.from({ length: 4 }, (_, i) => {
      const v = yMin + (i * (yMax - yMin)) / 3;
      return { v, y: y(v) };
    });
    const xTicks = Array.from({ length: 5 }, (_, i) => {
      const t = new Date(tMin + ((tMax - tMin) * i) / 4);
      return { t, x: x(t.getTime()) };
    });
    return { path, pts, yTicks, xTicks };
  }, [series]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!model) return null;
  const fmtTick = (d) =>
    range === "24h"
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
  const last = model.pts[model.pts.length - 1];

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Temperature over time">
        <title>Temperature over time</title>
        {model.yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} y1={t.y} x2={W - pad.r} y2={t.y} stroke="var(--border)" strokeDasharray="4,4" />
            <text x={pad.l - 6} y={t.y + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
              {t.v.toFixed(1)}°
            </text>
          </g>
        ))}
        {model.xTicks.map((t, i) => (
          <text key={i} x={t.x} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
            {fmtTick(t.t)}
          </text>
        ))}
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="var(--border-strong)" />
        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--border-strong)" />
        <path d={model.path} fill="none" stroke="var(--info)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {series.length <= 50 &&
          model.pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="var(--info)" stroke="var(--card)" strokeWidth="1.5" />)}
        {last && <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--info)" />}
      </svg>
    </div>
  );
}

export default function TemperatureCard({ mobileId }) {
  const [range, setRange] = useState("24h");
  const [state, setState] = useState({ loading: true, error: null, series: [] });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const r = RANGES.find((x) => x.key === range) || RANGES[0];
    const res = await apiGet(`/device/${encodeURIComponent(mobileId)}/temperature_series`, {
      params: { days: r.days, bucket: r.bucket },
    });
    if (res.ok) {
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      const series = items
        .map((x) => ({ t: x.t ? new Date(x.t) : null, temperature: x.temperature == null ? null : Number(x.temperature) }))
        .filter((x) => x.t && Number.isFinite(x.temperature))
        .sort((a, b) => a.t - b.t);
      setState({ loading: false, error: null, series });
    } else {
      setState({ loading: false, error: res.message, series: [] });
    }
  }, [mobileId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const { series } = state;
  const stats = useMemo(() => {
    if (!series.length) return null;
    const temps = series.map((x) => x.temperature);
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    return { cur: temps[temps.length - 1], avg, min: Math.min(...temps), max: Math.max(...temps), points: temps.length };
  }, [series]);

  const exportCsv = (mode) => {
    if (!series.length || !stats) return;
    const lines = [];
    if (mode === "absolute") {
      lines.push("Timestamp,Temperature (°C)");
      series.forEach((d) => lines.push(`${csvCell(d.t.toISOString())},${d.temperature.toFixed(2)}`));
    } else {
      lines.push("Timestamp,Temperature (°C),Deviation from Avg (°C),Deviation (%)");
      series.forEach((d) => {
        const dev = d.temperature - stats.avg;
        lines.push(
          `${csvCell(d.t.toISOString())},${d.temperature.toFixed(2)},${dev.toFixed(2)},${((dev / stats.avg) * 100).toFixed(2)}`
        );
      });
    }
    downloadTextFile(`temperature_report_${mobileId}_${range}_${mode}.csv`, lines.join("\n"));
  };

  return (
    <Card
      title="Temperature"
      actions={<RangeChips ranges={RANGES} active={range} onChange={setRange} label="Temperature range" />}
    >
      {state.loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          <Skeleton height={18} width="50%" />
          <Skeleton height={180} />
        </div>
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={load} />
      ) : !series.length ? (
        <EmptyState
          title="No temperature data for this period"
          hint="The screen reports temperature with its heartbeat once its sensor is connected."
        />
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <Stat label="Current" value={`${stats.cur.toFixed(1)}°C`} />
            <Stat label="Average" value={`${stats.avg.toFixed(1)}°C`} />
            <Stat label="Min" value={`${stats.min.toFixed(1)}°C`} />
            <Stat label="Max" value={`${stats.max.toFixed(1)}°C`} />
            <Stat label="Points" value={stats.points} />
          </div>
          <LineChart series={series} range={range} />
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Button size="sm" variant="secondary" icon={Download} onClick={() => exportCsv("absolute")}>
              CSV (absolute values)
            </Button>
            <Button size="sm" variant="secondary" icon={Download} onClick={() => exportCsv("relative")}>
              CSV (relative to average)
            </Button>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Latest points</div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "var(--table-head)" }}>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, color: "var(--text-muted)" }}>Time</th>
                    <th style={{ textAlign: "right", padding: 8, color: "var(--text-muted)" }}>Temperature</th>
                  </tr>
                </thead>
                <tbody>
                  {series.slice(-10).reverse().map((p, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: 8 }}>{formatDateTime(p.t)}</td>
                      <td style={{ padding: 8, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {p.temperature.toFixed(2)}°C
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
