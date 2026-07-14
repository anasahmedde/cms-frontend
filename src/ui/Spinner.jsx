import "./kit-core.css";

// Inline loading indicator. Inherits currentColor so it matches the text of
// whatever contains it (e.g. a Button in its loading state). Decorative —
// the container communicates busy state (aria-busy / visible text).
export default function Spinner({ size = 16, className = "", style, ...rest }) {
  return (
    <span
      className={`ui-spinner ${className}`.trim()}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(2, Math.round(size / 9)),
        ...style,
      }}
      {...rest}
    />
  );
}
