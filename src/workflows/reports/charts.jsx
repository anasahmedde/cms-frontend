// Reports charts — plain SVG, app tokens, dataviz mark specs: 2px lines,
// 4px rounded column caps with 2px gaps, recessive grid, labels in text
// tokens (never the series color), crosshair+tooltip on lines, per-mark
// tooltip on columns, selective direct labels (last point / peak only).
// Series hue is validated against --card in BOTH themes (light #3b82f6 on
// #ffffff, dark #3987e5 on #111a2e) and swapped via the .rpt-viz CSS scope.
import { useMemo, useRef, useState, useLayoutEffect, useCallback } from "react";
import "./reports.css";

function useMeasuredWidth(min = 320) {
  const ref = useRef(null);
  const [w, setW] = useState(640);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver((entries) => {
      const next = Math.max(min, Math.floor(entries[0].contentRect.width));
      setW((prev) => (Math.abs(prev - next) > 2 ? next : prev));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [min]);
  return [ref, w];
}

// Clean y-axis ticks: ~4 steps rounded to 1/2/5×10^n.
function niceTicks(maxVal, count = 4) {
  if (!(maxVal > 0)) return [0, 1];
  const rawStep = maxVal / count;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) || rawStep;
  const top = Math.ceil(maxVal / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

const fmtNum = (v) => (v == null ? "—" : Number(v).toLocaleString());

function fmtTick(iso, bucket) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return String(iso);
  if (bucket === "hour") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (bucket === "month") return d.toLocaleDateString([], { month: "short", year: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtFull(iso, bucket) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return String(iso);
  if (bucket === "hour") return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  if (bucket === "month") return d.toLocaleDateString([], { month: "long", year: "numeric" });
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function Tooltip({ x, y, children }) {
  return (
    <div className="rpt-tooltip" style={{ left: x, top: y }} role="status">
      {children}
    </div>
  );
}

const PAD = { top: 14, right: 16, bottom: 26, left: 44 };

/**
 * Line with optional min–max band + crosshair tooltip.
 * points: [{t, value, min?, max?}] — t is an ISO string.
 */
export function TrendChart({ points, unit = "", bucket = "day", height = 240, label = "value" }) {
  const [wrapRef, width] = useMeasuredWidth();
  const [hover, setHover] = useState(null); // point index
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const geo = useMemo(() => {
    if (!points.length) return null;
    const vals = points.flatMap((p) => [p.value, p.min, p.max]).filter((v) => v != null);
    const hi = Math.max(...vals);
    const lo0 = Math.min(...vals);
    const pad = (hi - lo0 || 1) * 0.12;
    const lo = lo0 - pad;
    const span = hi + pad - lo;
    const n = points.length;
    const xOf = (i) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yOf = (v) => PAD.top + innerH - ((v - lo) / span) * innerH;
    const band = points.every((p) => p.min != null && p.max != null) && n > 1
      ? points.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i)} ${yOf(p.max)}`).join(" ") +
        [...points].reverse().map((p, j) => ` L ${xOf(n - 1 - j)} ${yOf(p.min)}`).join("") + " Z"
      : null;
    return {
      xs: points.map((_, i) => xOf(i)),
      ys: points.map((p) => yOf(p.value)),
      band,
      ticks: niceTicks(hi).filter((t) => t >= lo && t <= hi + pad).map((t) => ({ v: t, y: yOf(t) })),
    };
  }, [points, innerW, innerH]);

  const onMove = useCallback((e) => {
    if (!geo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    for (let i = 1; i < geo.xs.length; i += 1) {
      if (Math.abs(geo.xs[i] - px) < Math.abs(geo.xs[best] - px)) best = i;
    }
    setHover(best);
  }, [geo]);

  if (!points.length || !geo) return null;
  const { xs, ys, band, ticks } = geo;
  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xs[i]} ${ys[i]}`).join(" ");
  const last = points.length - 1;
  const xTickEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div ref={wrapRef} className="rpt-viz" style={{ position: "relative" }}>
      <svg width={width} height={height} role="img"
        aria-label={`${label} trend, ${points.length} points`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t.v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={t.y} y2={t.y} className="rpt-grid" />
            <text x={PAD.left - 8} y={t.y + 3.5} textAnchor="end" className="rpt-axis">{fmtNum(t.v)}</text>
          </g>
        ))}
        {points.map((p, i) => (i % xTickEvery === 0 || i === last) && (
          <text key={p.t} x={xs[i]} y={height - 8} textAnchor="middle" className="rpt-axis">
            {fmtTick(p.t, bucket)}
          </text>
        ))}
        {band && <path d={band} className="rpt-band" />}
        <path d={lineD} className="rpt-line" fill="none" />
        {/* selective direct label: the latest value only */}
        <circle cx={xs[last]} cy={ys[last]} r={4} className="rpt-dot" />
        <text x={Math.min(xs[last] + 6, width - PAD.right - 2)} y={ys[last] - 8}
          textAnchor={xs[last] > width - 90 ? "end" : "start"} className="rpt-value">
          {fmtNum(points[last].value)}{unit}
        </text>
        {hover != null && (
          <g>
            <line x1={xs[hover]} x2={xs[hover]} y1={PAD.top} y2={PAD.top + innerH} className="rpt-crosshair" />
            <circle cx={xs[hover]} cy={ys[hover]} r={4.5} className="rpt-dot rpt-dot--hover" />
          </g>
        )}
      </svg>
      {hover != null && (
        <Tooltip x={Math.min(xs[hover] + 12, width - 180)} y={PAD.top}>
          <strong>{fmtFull(points[hover].t, bucket)}</strong>
          <div>{label}: <b>{fmtNum(points[hover].value)}{unit}</b></div>
          {points[hover].min != null && (
            <div className="rpt-tooltip-faint">range {fmtNum(points[hover].min)}–{fmtNum(points[hover].max)}{unit}</div>
          )}
        </Tooltip>
      )}
    </div>
  );
}

/**
 * Columns with per-mark hover tooltip; only the peak column is direct-labeled.
 * points: [{t, value}].
 */
export function ColumnChart({ points, unit = "", bucket = "day", height = 240, label = "value" }) {
  const [wrapRef, width] = useMeasuredWidth();
  const [hover, setHover] = useState(null);
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const n = points.length;
  const maxVal = Math.max(...points.map((p) => p.value), 1);
  const ticks = niceTicks(maxVal);
  const top = ticks[ticks.length - 1];
  const slot = n ? innerW / n : innerW;
  const barW = Math.max(4, Math.min(48, slot - 2)); // 2px surface gap between fills
  const yOf = (v) => PAD.top + innerH - (v / top) * innerH;
  const peak = n ? points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0) : 0;
  const xTickEvery = Math.max(1, Math.ceil(n / 6));

  if (!n) return null;
  return (
    <div ref={wrapRef} className="rpt-viz" style={{ position: "relative" }}>
      <svg width={width} height={height} role="img" aria-label={`${label} per ${bucket}, ${n} bars`}
        onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={yOf(t)} y2={yOf(t)} className="rpt-grid" />
            <text x={PAD.left - 8} y={yOf(t) + 3.5} textAnchor="end" className="rpt-axis">{fmtNum(t)}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const y = yOf(p.value);
          const h = Math.max(0, PAD.top + innerH - y);
          const cap = Math.min(4, h);
          return (
            <g key={p.t}>
              {/* hit target: the whole slot, taller than the mark */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH}
                fill="transparent" onPointerEnter={() => setHover(i)} />
              <path
                className={`rpt-col${hover === i ? " rpt-col--hover" : ""}`}
                d={`M ${x} ${y + cap} q 0 ${-cap} ${cap} ${-cap} h ${Math.max(0, barW - 2 * cap)} q ${cap} 0 ${cap} ${cap} v ${Math.max(0, h - cap)} h ${-barW} Z`}
              />
              {(i % xTickEvery === 0 || i === n - 1) && (
                <text x={PAD.left + i * slot + slot / 2} y={height - 8} textAnchor="middle" className="rpt-axis">
                  {fmtTick(p.t, bucket)}
                </text>
              )}
              {i === peak && p.value > 0 && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="rpt-value">
                  {fmtNum(p.value)}{unit}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <Tooltip x={Math.min(PAD.left + hover * slot + slot, width - 180)} y={PAD.top}>
          <strong>{fmtFull(points[hover].t, bucket)}</strong>
          <div>{label}: <b>{fmtNum(points[hover].value)}{unit}</b></div>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * Horizontal ranked bars (magnitude, one hue) — value at the tip.
 * items: [{key, label, pct(0-100)|null, display}].
 */
export function RankBars({ items, maxRows = 10 }) {
  const shown = items.slice(0, maxRows);
  return (
    <div className="rpt-viz">
      {shown.map((it) => (
        <div key={it.key} className="rpt-rank-row">
          <span className="rpt-rank-label" title={it.label}>{it.label}</span>
          <span className="rpt-rank-track" aria-hidden="true">
            <span className="rpt-rank-fill" style={{ width: `${Math.max(1, it.pct ?? 0)}%` }} />
          </span>
          <span className="rpt-rank-value">{it.display}</span>
        </div>
      ))}
      {items.length > maxRows && (
        <p className="u-faint" style={{ margin: "6px 0 0" }}>
          Top {maxRows} of {items.length} — the full list is in the table below.
        </p>
      )}
    </div>
  );
}

// ── Legacy compat (PlatformActivity) ───────────────────────────────────────
// Old signature: data [{label, value}], title, yLabel, color, height.
export function BarChart({ data, title, yLabel = "", height = 240 }) {
  const points = (data || []).map((d) => ({ t: d.label ?? d.date, value: Number(d.value ?? d.count) || 0 }));
  if (!points.length) {
    return <div style={{ padding: 32, textAlign: "center", color: "var(--text-faint)" }}>No data available for the selected period</div>;
  }
  return (
    <div>
      {title && <p className="u-muted" style={{ margin: "0 0 6px", fontWeight: 600 }}>{title}</p>}
      <ColumnChart points={points} bucket="day" height={height} label={yLabel || "value"} />
    </div>
  );
}
