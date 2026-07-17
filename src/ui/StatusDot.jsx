import "./kit-core.css";

// Live-status indicator. Pulses by default when online (pass pulse={false}
// to suppress, or pulse to force on another status). Without a visible
// label the status itself becomes the accessible name.
export default function StatusDot({ status = "neutral", label, pulse }) {
  const shouldPulse = pulse === undefined ? status === "online" : !!pulse;
  const cls = [
    "ui-statusdot",
    `ui-statusdot--${status}`,
    shouldPulse && "ui-statusdot--pulse",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} {...(label ? {} : { role: "img", "aria-label": status })}>
      <span className="ui-statusdot-dot" aria-hidden="true" />
      {label ? <span className="ui-statusdot-label">{label}</span> : null}
    </span>
  );
}
