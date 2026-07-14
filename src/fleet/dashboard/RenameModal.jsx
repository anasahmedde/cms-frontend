// Rename a screen (friendly name over the immutable Device ID).
import { useEffect, useState } from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import { Field, Input } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import { apiPost } from "../../lib/api";

export default function RenameModal({ open, row, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(row?.device_name || "");
      setError("");
    }
  }, [open, row]);

  const save = async () => {
    setSaving(true);
    setError("");
    const res = await apiPost(
      `/device/${encodeURIComponent(row.mobile_id)}/name`,
      { device_name: name.trim() }
    );
    setSaving(false);
    if (!res.ok) {
      setError(res.message || "Could not rename the screen");
      return;
    }
    toast.success(name.trim() ? `Screen renamed to "${name.trim()}"` : "Screen name cleared");
    onSaved?.();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rename screen"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save name
          </Button>
        </>
      }
    >
      <p className="u-faint" style={{ marginTop: 0 }}>
        Device ID: <span className="mono">{row?.mobile_id}</span>
      </p>
      <Field label="Screen name" htmlFor="fleet-rename-input" error={error}>
        <Input
          id="fleet-rename-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter a friendly name"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !saving) save();
          }}
        />
      </Field>
    </Modal>
  );
}
