import Spinner from "./Spinner";
import "./kit-core.css";

// Primary action button. `loading` disables the button and swaps the icon
// slot for an inline Spinner so layout doesn't jump.
export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon: Icon,
  type = "button",
  onClick,
  className = "",
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === "sm" ? 13 : 15} />
      ) : Icon ? (
        <Icon size={16} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
