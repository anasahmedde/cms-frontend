// One smart upload for the whole media library. The user no longer picks a
// "stack" up front: the target is inferred from the file, and — only when the
// company uses grid/split layouts AND the file is an image — the user chooses
// where it plays. Underneath, the two legacy stacks are unchanged:
//   • rotation media  → /upload_video       (video/image/html/pdf, plays in the rotation)
//   • layout image    → /upload_advertisement (image only, fills split/grid slots)
import { useRef, useState } from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import ProgressBar from "../../ui/ProgressBar";
import { Field, Input, Select } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import { apiPost, uploadWithProgress } from "../../lib/api";
import { useCompanyFeatures, featureOn } from "../../lib/features";
import { RotationChips, FitModeSelect } from "./controls";
import {
  KINDS, fileNameSansExt, inferContentType, isValidImageFile, resolveStoredName,
} from "./lib";

// The rotation stack accepts everything; the file input stays broad and the
// modal routes an image to the layout stack only on explicit intent.
const ACCEPT = KINDS.video.accept;
const ACCEPT_HINT = KINDS.video.acceptHint;

export default function UploadModal({ open, onClose, onUploaded }) {
  const toast = useToast();
  const { features } = useCompanyFeatures();
  const gridEnabled = featureOn(features, "grid");
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [rotation, setRotation] = useState(0);
  const [fitMode, setFitMode] = useState("cover");
  const [duration, setDuration] = useState(10);
  const [intent, setIntent] = useState("rotation"); // image + grid: "rotation" | "layout"
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);

  const type = file ? inferContentType(file.name) : null;
  const isImage = type === "image";
  // Layout slots exist only for grid/split companies, and only images fit them.
  const canBeLayoutImage = isImage && gridEnabled;
  const resolvedKind = canBeLayoutImage && intent === "layout" ? "image" : "video";
  const meta = KINDS[resolvedKind];
  const busy = progress !== null;

  const reset = () => {
    setFile(null); setName(""); setRotation(0); setFitMode("cover"); setDuration(10);
    setIntent("rotation"); setProgress(null); setError(""); setConfirmReplace(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => { if (busy) return; reset(); onClose(); };

  const pickFile = (f) => {
    if (!f) return;
    setError("");
    setFile(f);
    setIntent("rotation");
    if (!name) setName(fileNameSansExt(f.name));
  };

  const submit = async (overwrite) => {
    if (!file || !name.trim()) return;
    if (resolvedKind === "image" && !isValidImageFile(file)) {
      setError("Layout-slot images must be JPG, PNG, GIF, or WebP.");
      return;
    }
    setError("");
    setProgress(0);
    const fd = new FormData();
    fd.append("file", file);
    fd.append(resolvedKind === "image" ? "ad_name" : "video_name", name.trim());
    if (overwrite) fd.append("overwrite", "true");
    // Still content (image/html/pdf) gets a display duration — both endpoints accept it.
    if (type !== "video") fd.append("display_duration", String(duration));
    // The layout-image endpoint takes rotation/fit inline; the rotation endpoint
    // applies them afterwards (below), matching each stack's contract.
    if (resolvedKind === "image") {
      fd.append("rotation", String(rotation));
      fd.append("fit_mode", fitMode);
    }
    const res = await uploadWithProgress(meta.uploadPath, fd, setProgress);
    if (!res.ok) {
      setProgress(null);
      if (res.status === 409 && !overwrite) { setConfirmReplace(true); return; }
      setError(res.message);
      return;
    }
    const storedName = res.data?.[meta.nameField]
      ? res.data[meta.nameField]
      : await resolveStoredName(resolvedKind, res.data?.id, name.trim());
    // Rotation-stack rotation/fit are separate endpoints applied post-upload;
    // failures surface but don't undo the upload.
    if (resolvedKind === "video") {
      const extras = [];
      if (rotation) extras.push(apiPost(`${meta.itemPath(storedName)}/rotation`, { rotation }));
      if (fitMode !== "cover") extras.push(apiPost(`${meta.itemPath(storedName)}/fit_mode`, { fit_mode: fitMode }));
      const results = await Promise.all(extras);
      if (results.some((r) => !r.ok)) {
        toast.error(`"${storedName}" uploaded, but rotation/fit could not be applied — edit it to retry.`);
      }
    }
    setProgress(null);
    toast.success(
      storedName === name.trim()
        ? `"${storedName}" uploaded`
        : `Uploaded — stored as "${storedName}" (the server adds your company suffix)`
    );
    reset();
    onUploaded(storedName);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Upload media"
      size="sm"
      closeOnOverlay={!busy}
      footer={
        confirmReplace ? (
          <>
            <Button variant="secondary" onClick={() => setConfirmReplace(false)} disabled={busy}>Back</Button>
            <Button variant="danger" onClick={() => submit(true)} loading={busy}>Replace existing</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button>
            <Button onClick={() => submit(false)} loading={busy} disabled={!file || !name.trim()}>Upload</Button>
          </>
        )
      }
    >
      {confirmReplace ? (
        <p>
          <strong>"{name.trim()}"</strong> already exists in the library. Replacing it updates the
          file everywhere it is assigned. Replace it?
        </p>
      ) : (
        <>
          <Field label="File" required hint={ACCEPT_HINT} htmlFor="media-upload-file">
            <Input
              id="media-upload-file"
              type="file"
              accept={ACCEPT}
              ref={fileRef}
              onChange={(e) => pickFile(e.target.files?.[0])}
              disabled={busy}
            />
          </Field>

          {canBeLayoutImage && (
            <Field
              label="Where will this play?"
              hint="Layout slots only appear in split/grid layouts."
              htmlFor="media-upload-intent"
            >
              <Select
                id="media-upload-intent"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                disabled={busy}
                options={[
                  { value: "rotation", label: "Playlist rotation (plays in the screen rotation)" },
                  { value: "layout", label: "Layout slot (fills a split/grid slot)" },
                ]}
              />
            </Field>
          )}

          <Field
            label="Name"
            required
            hint='Stored with your company suffix (e.g. "-acme") appended by the server'
            htmlFor="media-upload-name"
          >
            <Input
              id="media-upload-name"
              value={name}
              placeholder={meta.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </Field>

          <RotationChips value={rotation} onChange={setRotation} disabled={busy} />
          <FitModeSelect id="media-upload-fit" value={fitMode} onChange={setFitMode} disabled={busy} />

          {file && type !== "video" && (
            <Field label="Display duration (seconds)" hint="How long each screen shows this item" htmlFor="media-upload-duration">
              <Input
                id="media-upload-duration"
                type="number"
                min={1}
                max={3600}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 10)}
                disabled={busy}
              />
            </Field>
          )}

          {busy && <ProgressBar value={progress} label={`${progress}%`} />}
          {error && (
            <div style={{ padding: 10, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 8 }}>
              {error}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
