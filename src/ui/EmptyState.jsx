import "./kit-core.css";

// "Nothing here yet" panel. Only render when a load SUCCEEDED and returned
// zero items — a failed request must use ErrorState instead, never this.
export default function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="ui-empty">
      {Icon ? (
        <span className="ui-empty-icon">
          <Icon size={18} aria-hidden="true" />
        </span>
      ) : null}
      {title ? <p className="ui-empty-title">{title}</p> : null}
      {hint ? <p className="ui-empty-hint">{hint}</p> : null}
      {action ? <div className="ui-empty-action">{action}</div> : null}
    </div>
  );
}
