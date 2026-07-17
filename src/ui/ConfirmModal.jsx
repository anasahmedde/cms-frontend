// ConfirmModal — small confirm dialog on top of Modal. States exactly what is
// lost: renders the backend 409 `linked` counts and an optional typed-confirm
// input that must match before the confirm button enables.
// <ConfirmModal open onClose onConfirm title message danger confirmLabel
//   loading linked={{video_links: 3}} typedConfirm="slug">{optional}</ConfirmModal>
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import { Input } from "./Field";
import "./kit-overlays.css";

function humanizeKey(key) {
  return String(key).replace(/_/g, " ");
}

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  danger = false,
  confirmLabel = "Confirm",
  loading = false,
  linked,
  typedConfirm,
  children,
}) {
  const [typed, setTyped] = useState("");

  // Clear the typed value whenever the dialog closes so it never pre-matches.
  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const linkedItems = linked
    ? Object.entries(linked).filter(([, count]) => Number(count) > 0)
    : [];
  const typedMismatch = Boolean(typedConfirm) && typed !== typedConfirm;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnOverlay={!loading}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
            disabled={typedMismatch}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message ? <p className="ui-confirm-message">{message}</p> : null}

      {linkedItems.length > 0 && (
        <div className="ui-confirm-linked">
          <div className="ui-confirm-linked-title">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>This will also remove:</span>
          </div>
          <ul>
            {linkedItems.map(([key, count]) => (
              <li key={key}>
                {count} {humanizeKey(key)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {children}

      {typedConfirm ? (
        <div className="ui-confirm-typed">
          <label className="ui-confirm-typed-label" htmlFor="ui-confirm-typed-input">
            Type <span className="mono">{typedConfirm}</span> to confirm
          </label>
          <Input
            id="ui-confirm-typed-input"
            className="mono"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={typedConfirm}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      ) : null}
    </Modal>
  );
}
