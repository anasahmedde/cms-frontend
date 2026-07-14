import "./kit-core.css";

// Content container. Header renders only when title or actions are given.
// `padding` overrides the body padding (number = px; 0/false = flush body,
// useful when a Table fills the card).
export default function Card({ title, actions, padding, className = "", children }) {
  const bodyStyle =
    padding === undefined
      ? undefined
      : { padding: typeof padding === "number" ? `${padding}px` : padding || 0 };
  return (
    <section className={`ui-card ${className}`.trim()}>
      {title || actions ? (
        <header className="ui-card-head">
          {title ? <h3 className="ui-card-title">{title}</h3> : <span />}
          {actions ? <div className="ui-card-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="ui-card-body" style={bodyStyle}>
        {children}
      </div>
    </section>
  );
}
