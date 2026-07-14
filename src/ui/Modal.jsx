// Modal — portal overlay dialog with focus trap, ESC close, focus restore.
// <Modal open onClose title size="sm|md|lg|xl" footer={node} closeOnOverlay>{children}</Modal>
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import IconButton from "./IconButton";
import "./kit-overlays.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  title,
  size = "md",
  footer,
  closeOnOverlay = true,
  children,
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  // On open: remember the opener, move focus into the dialog. On close: restore.
  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;
    const panel = panelRef.current;
    const first = panel ? panel.querySelector(FOCUSABLE) : null;
    (first || panel)?.focus();
    return () => {
      const el = restoreRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose?.();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll(FOCUSABLE));
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement;
    if (e.shiftKey && (current === first || current === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && current === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleOverlayMouseDown = (e) => {
    if (closeOnOverlay && e.target === e.currentTarget) onClose?.();
  };

  return createPortal(
    <div className="ui-modal-overlay" onMouseDown={handleOverlayMouseDown} onKeyDown={handleKeyDown}>
      <div
        ref={panelRef}
        className={`ui-modal ui-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
      >
        <div className="ui-modal-header">
          <h2 className="ui-modal-title">{title}</h2>
          <IconButton label="Close" icon={X} variant="ghost" size="sm" onClick={onClose} />
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer ? <div className="ui-modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
