// Horizontal progress bar. tone: accent (default) | success | danger | warn |
// info. NaN/null-safe: bad values clamp to 0.
import "./kit-data.css";

const TONE_VAR = {
  accent: "var(--accent)",
  success: "var(--success)",
  danger: "var(--danger)",
  warn: "var(--warn)",
  info: "var(--info)",
};

export default function ProgressBar({
  value,
  max = 100,
  tone = "accent",
  label,
  height = 6,
}) {
  const safeMax = Number(max) > 0 ? Number(max) : 100;
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const pct = Math.min(100, Math.max(0, (safeValue / safeMax) * 100));

  return (
    <div className="ui-progress">
      <div
        className="ui-progress-track"
        style={{ height }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={typeof label === "string" ? label : "Progress"}
      >
        <div
          className="ui-progress-fill"
          style={{
            width: `${pct}%`,
            background: TONE_VAR[tone] || TONE_VAR.accent,
          }}
        />
      </div>
      {label != null && <span className="ui-progress-label">{label}</span>}
    </div>
  );
}
