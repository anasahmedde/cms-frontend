import "./kit-core.css";

// Icon-only button. `label` is mandatory in practice: it becomes both the
// accessible name (aria-label) and the hover tooltip (title).
export default function IconButton({
  label,
  icon: Icon,
  variant = "ghost",
  size = "md",
  onClick,
  disabled = false,
  className = "",
  ...rest
}) {
  return (
    <button
      type="button"
      className={`ui-iconbtn ui-iconbtn--${variant} ui-iconbtn--${size} ${className}`.trim()}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {Icon ? <Icon size={size === "sm" ? 16 : 18} aria-hidden="true" /> : null}
    </button>
  );
}
