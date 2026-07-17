// Add-location modal. The legacy Shop page fired POST /insert_shop and never
// checked the result — here every outcome is surfaced (created / already
// exists / failed) and the form keeps its state on failure.
import { useEffect, useState } from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import { Field, Input } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import { createLocation } from "./lib";

export default function CreateLocationModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
    }
  }, [open]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for the location.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await createLocation(trimmed);
    setBusy(false);
    if (!res.ok) {
      setError(res.message || "Could not create the location.");
      return;
    }
    if (res.data?.existed) {
      toast.info(`Location "${trimmed}" already exists`);
    } else {
      toast.success(`Location "${trimmed}" created`);
    }
    onCreated(trimmed);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Add location"
      size="sm"
      closeOnOverlay={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Add location
          </Button>
        </>
      }
    >
      <Field
        label="Location name"
        htmlFor="create-location-name"
        error={error}
        hint={error ? undefined : "A store, branch, or venue — you assign screens to it from each screen's Settings tab."}
        required
      >
        <Input
          id="create-location-name"
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
