import "./kit-core.css";

// Small tonal pill for statuses, kinds, and counts.
export default function Badge({ tone = "neutral", className = "", children, ...rest }) {
  return (
    <span className={`ui-badge ui-badge--${tone} ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}
