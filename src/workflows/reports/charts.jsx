// Themed SVG charts for the Reports page (ported from legacy Reports.js,
// token colors + a11y). Wide charts scroll inside .u-scroll-x wrappers.
import { useMemo } from "react";

const W = 700;

export function LineChart({ data, title, yLabel, color = "var(--info)", height = 300 }) {
  const padding = { top: 30, right: 40, bottom: 50, left: 60 };
  const innerWidth = W - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const processed = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data
      .map((d) => ({
        time: new Date(d.time || d.logged_at || d.date),
        value: parseFloat(d.value ?? d.count ?? 0),
      }))
      .filter((d) => !Number.isNaN(d.value) && d.time instanceof Date && !Number.isNaN(+d.time))
      .sort((a, b) => a.time - b.time);
  }, [data]);

  if (processed.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)" }}>No data available for the selected period</div>;
  }

  const minTime = processed[0].time.getTime();
  const maxTime = processed[processed.length - 1].time.getTime();
  const timeRange = maxTime - minTime || 1;
  const values = processed.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valRange = maxVal - minVal || 1;
  const valPadding = valRange * 0.1;
  const scaleX = (t) => padding.left + ((t - minTime) / timeRange) * innerWidth;
  const scaleY = (v) =>
    padding.top + innerHeight - ((v - (minVal - valPadding)) / (valRange + 2 * valPadding)) * innerHeight;
  const pathD = processed
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.time.getTime())} ${scaleY(p.value)}`)
    .join(" ");

  return (
    <div className="u-scroll-x">
      <svg width={W} height={height} role="img" aria-label={`${title} line chart`} style={{ background: "var(--elevated)", borderRadius: 8 }}>
        <title>{title}</title>
        <text x={W / 2} y={20} textAnchor="middle" style={{ fontSize: 14, fontWeight: 600, fill: "var(--text)" }}>{title}</text>
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const val = minVal - valPadding + (valRange + 2 * valPadding) * (1 - pct);
          const y = padding.top + innerHeight * pct;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={padding.left + innerWidth} y2={y} stroke="var(--border)" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" style={{ fontSize: 10, fill: "var(--text-muted)" }}>{val.toFixed(1)}</text>
            </g>
          );
        })}
        <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
        {processed.map((p, i) => (
          <circle key={i} cx={scaleX(p.time.getTime())} cy={scaleY(p.value)} r={3} fill={color} />
        ))}
        <text x={15} y={height / 2} transform={`rotate(-90, 15, ${height / 2})`} textAnchor="middle" style={{ fontSize: 11, fill: "var(--text-muted)" }}>{yLabel}</text>
      </svg>
    </div>
  );
}

export function BarChart({ data, title, yLabel, color = "var(--success)", height = 300 }) {
  const padding = { top: 30, right: 40, bottom: 60, left: 60 };
  const innerWidth = W - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  if (!data || data.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)" }}>No data available for the selected period</div>;
  }

  const maxVal = Math.max(...data.map((d) => d.value ?? d.count ?? 0), 1);
  const barWidth = Math.min(40, innerWidth / data.length - 4);

  return (
    <div className="u-scroll-x">
      <svg width={W} height={height} role="img" aria-label={`${title} bar chart`} style={{ background: "var(--elevated)", borderRadius: 8 }}>
        <title>{title}</title>
        <text x={W / 2} y={20} textAnchor="middle" style={{ fontSize: 14, fontWeight: 600, fill: "var(--text)" }}>{title}</text>
        {data.map((d, i) => {
          const val = d.value ?? d.count ?? 0;
          const barHeight = (val / maxVal) * innerHeight;
          const x = padding.left + (i / data.length) * innerWidth + (innerWidth / data.length - barWidth) / 2;
          const y = padding.top + innerHeight - barHeight;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} rx={2} />
              <text x={x + barWidth / 2} y={padding.top + innerHeight + 15} textAnchor="middle" style={{ fontSize: 9, fill: "var(--text-muted)" }}>{d.label || d.date || i + 1}</text>
              <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" style={{ fontSize: 9, fill: "var(--text)", fontWeight: 600 }}>{val}</text>
            </g>
          );
        })}
        <text x={15} y={height / 2} transform={`rotate(-90, 15, ${height / 2})`} textAnchor="middle" style={{ fontSize: 11, fill: "var(--text-muted)" }}>{yLabel}</text>
      </svg>
    </div>
  );
}
