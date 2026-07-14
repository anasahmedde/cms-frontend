// Tabs — underline-style tab strip. Purely controlled.
// <Tabs tabs={[{key, label, icon, badge}]} active onChange />
import Badge from "./Badge";
import "./kit-overlays.css";

export default function Tabs({ tabs = [], active, onChange }) {
  const handleKeyDown = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const idx = tabs.findIndex((t) => t.key === active);
    const next = tabs[(idx + dir + tabs.length) % tabs.length];
    if (next) onChange?.(next.key);
  };

  return (
    <div className="ui-tabs" role="tablist" onKeyDown={handleKeyDown}>
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`ui-tab${isActive ? " ui-tab-active" : ""}`}
            onClick={() => onChange?.(t.key)}
          >
            {Icon ? <Icon size={16} aria-hidden="true" /> : null}
            <span>{t.label}</span>
            {t.badge ? <Badge tone={isActive ? "accent" : "neutral"}>{t.badge}</Badge> : null}
          </button>
        );
      })}
    </div>
  );
}
