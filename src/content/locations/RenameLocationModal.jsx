// Rename-location modal (legacy "✏️ Rename Shop", now with a checked result).
// Locations are keyed by name in the API, so a rename changes the location's
// URL — the caller navigates to the new path via onRenamed(newName).
import { useEffect, useState } from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import { Field, Input } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import { renameLocation } from "./lib";

export default function RenameLocationModal({ open, currentName, onClose, onRenamed }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(currentName || "");
      setError("");
    }
  }, [open, currentName]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a new name for the location.");
      return;
    }
    if (trimmed === currentName) {
      onClose();
      return;
    }
    setBusy(true);
    setError("");
    const res = await renameLocation(currentName, trimmed);
    setBusy(false);
    if (!res.ok) {
      setError(res.message || "Could not rename the location.");
      return;
    }
    toast.success(`Location renamed to "${trimmed}"`);
    onRenamed(trimmed);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Rename location"
      size="sm"
      closeOnOverlay={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Save new name
          </Button>
        </>
      }
    >
      <Field label="Current name" htmlFor="rename-location-current">
        <Input id="rename-location-current" value={currentName || ""} disabled />
      </Field>
      <Field
        label="New name"
        htmlFor="rename-location-new"
        error={error}
        hint={error ? undefined : "The location's link changes with its name — update any saved bookmarks."}
        required
      >
        <Input
          id="rename-location-new"
          value={name}
          autoFocus
          placeholder="e.g. Downtown Mart"
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </Field>
    </Modal>
  );
}
