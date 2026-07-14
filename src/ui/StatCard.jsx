import Skeleton from "./Skeleton";
import "./kit-core.css";

// KPI tile. With onClick it renders as a real <button> (keyboard reachable)
// and exposes `active` via aria-pressed — the Dashboard uses these as
// click-to-filter toggles. `loading` swaps the value for a skeleton.
export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "accent",
  onClick,
  active = false,
  loading = false,
}) {
  const Tag = onClick ? "button" : "div";
  const cls = [
    "ui-statcard",
    `ui-statcard--${tone}`,
    onClick && "ui-statcard--clickable",
    active && "ui-statcard--active",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={cls} {...(onClick ? { type: "button", onClick, "aria-pressed": active } : {})}>
      {Icon ? (
        <span className="ui-statcard-icon">
          <Icon size={18} aria-hidden="true" />
        </span>
      ) : null}
      <span className="ui-statcard-info">
        <span className="ui-statcard-label">{label}</span>
        {loading ? (
          <Skeleton width={56} height={22} />
        ) : (
          <span className="ui-statcard-value">{value}</span>
        )}
        {hint ? <span className="ui-statcard-hint">{hint}</span> : null}
      </span>
    </Tag>
  );
}
