// Copies `value` to the clipboard; flips to "Copied" for 1.5s only when the
// write actually succeeded (no fake success on clipboard failure).
import { useEffect, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import "./kit-data.css";

export default function CopyButton({ value, label = "Copy", small = false }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value == null ? "" : String(value));
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const Icon = copied ? Check : Copy;
  const className = [
    "ui-copy-btn",
    small && "ui-copy-btn-small",
    copied && "ui-copy-btn-copied",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      onClick={handleCopy}
      aria-label={copied ? "Copied to clipboard" : `${label} to clipboard`}
      title={copied ? "Copied to clipboard" : `${label} to clipboard`}
    >
      <Icon size={16} aria-hidden="true" />
      {copied ? "Copied" : label}
    </button>
  );
}
