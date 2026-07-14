// Edit a library item: rename (PUT), rotation, fit mode, display duration.
// Each save reports per-field results honestly (legacy swallowed failures).
import { useEffect, useState } from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import { Field, Input } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import { apiPost, apiPut } from "../../lib/api";
import { RotationChips, FitModeSelect } from "./controls";
import { KINDS, contentTypeOf } from "./lib";

export default function EditModal({ open, item, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [rotation, setRotation] = useState(0);
  const [fitMode, setFitMode] = useState("cover");
  const [duration, setDuration] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setRotation(item.rotation || 0);
    setFitMode(item.fit_mode || "cover");
    setDuration(item.display_duration ?? 10);
    setError("");
  }, [item]);

  if (!item) return null;
  const meta = KINDS[item.kind];
  const type = contentTypeOf(item);

  const save = async () => {
    setSaving(true);
    setError("");
    const failures = [];
    let currentName = item.name;

    const newName = name.trim();
    if (newName && newName !== item.name) {
      const body = item.kind === "image" ? { ad_name: newName } : { video_name: newName };
      const res = await apiPut(meta.itemPath(item.name), body);
      if (res.ok) currentName = newName;
      else failures.push(`rename: ${res.message}`);
    }
    if ((item.rotation || 0) !== rotation) {
      const res = await apiPost(`${meta.itemPath(currentName)}/rotation`, { rotation });
      if (!res.ok) failures.push(`rotation: ${res.message}`);
    }
    if ((item.fit_mode || "cover") !== fitMode) {
      const res = await apiPost(`${meta.itemPath(currentName)}/fit_mode`, { fit_mode: fitMode });
      if (!res.ok) failures.push(`fit mode: ${res.message}`);
    }
    if (type !== "video" && (item.display_duration ?? 10) !== duration) {
      const res = await apiPut(meta.itemPath(currentName), { display_duration: duration });
      if (!res.ok) failures.push(`duration: ${res.message}`);
    }

    setSaving(false);
    if (failures.length) {
      setError(failures.join(" · "));
      return;
    }
    toast.success(`"${currentName}" updated`);
    onSaved();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${item.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save changes</Button>
        </>
      }
    >
      <Field
        label="Name"
        hint="Renaming updates every assignment that references this item by name"
        htmlFor="media-edit-name"
      >
        <Input id="media-edit-name" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
      </Field>
      <RotationChips value={rotation} onChange={setRotation} disabled={saving} />
      <FitModeSelect id="media-edit-fit" value={fitMode} onChange={setFitMode} disabled={saving} />
      {type !== "video" && (
        <Field label="Display duration (seconds)" htmlFor="media-edit-duration">
          <Input
            id="media-edit-duration"
            type="number"
            min={1}
            max={3600}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 10)}
            disabled={saving}
          />
        </Field>
      )}
      {error && (
        <div role="alert" style={{ padding: 10, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 8 }}>
          Some changes failed — {error}
        </div>
      )}
    </Modal>
  );
}
