// Upload flow for both stacks. Mirrors legacy Video.js/Advertisement.js:
// multipart upload with progress, rotation + fit posted after the upload
// (video stack), 409 → explicit replace confirm, and the server's silent
// "-{company}" rename surfaced in the success toast.
import { useRef, useState } from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import ProgressBar from "../../ui/ProgressBar";
import { Field, Input } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import { apiPost, uploadWithProgress } from "../../lib/api";
import { RotationChips, FitModeSelect } from "./controls";
import {
  KINDS, fileNameSansExt, inferContentType, isValidImageFile, resolveStoredName,
} from "./lib";

export default function UploadModal({ open, kind, onClose, onUploaded }) {
  const meta = KINDS[kind];
  const toast = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [rotation, setRotation] = useState(0);
  const [fitMode, setFitMode] = useState("cover");
  const [duration, setDuration] = useState(10);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);

  const type = file ? (kind === "image" ? "image" : inferContentType(file.name)) : null;
  const busy = progress !== null;

  const reset = () => {
    setFile(null);
    setName("");
    setRotation(0);
    setFitMode("cover");
    setDuration(10);
    setProgress(null);
    setError("");
    setConfirmReplace(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const pickFile = (f) => {
    if (!f) return;
    if (kind === "image" && !isValidImageFile(f)) {
      setError(`Unsupported file type. Allowed: ${meta.acceptHint}.`);
      return;
    }
    setError("");
    setFile(f);
    if (!name) setName(fileNameSansExt(f.name));
  };

  const submit = async (overwrite) => {
    if (!file || !name.trim()) return;
    setError("");
    setProgress(0);
    const fd = new FormData();
    fd.append("file", file);
    fd.append(kind === "image" ? "ad_name" : "video_name", name.trim());
    if (overwrite) fd.append("overwrite", "true");
    if (kind === "image") {
      fd.append("rotation", String(rotation));
      fd.append("fit_mode", fitMode);
      if (type !== "video") fd.append("display_duration", String(duration));
    }
    const res = await uploadWithProgress(meta.uploadPath, fd, setProgress);
    if (!res.ok) {
      setProgress(null);
      if (res.status === 409 && !overwrite) {
        setConfirmReplace(true);
        return;
      }
      setError(res.message);
      return;
    }
    const storedName = res.data?.[meta.nameField]
      ? res.data[meta.nameField]
      : await resolveStoredName(kind, res.data?.id, name.trim());
    // Video-stack rotation/fit are separate endpoints, applied post-upload
    // (mirrors legacy Video.js:537-540). Failures surface but don't undo the upload.
    if (kind === "video") {
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
      title={kind === "image" ? "Upload layout image" : "Upload playlist media"}
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
      {!confirmReplace && kind === "image" && (
        <p className="u-muted" style={{ marginTop: 0 }}>
          Layout images appear inside split/grid layout slots. For a full-screen
          image in the playlist rotation, use <strong>Upload media</strong> instead —
          the rotation accepts images too.
        </p>
      )}
      {confirmReplace ? (
        <p>
          <strong>"{name.trim()}"</strong> already exists in the library. Replacing it updates the
          file everywhere this {meta.label.toLowerCase()} is assigned. Replace it?
        </p>
      ) : (
        <>
          <Field label="File" required hint={meta.acceptHint} htmlFor="media-upload-file">
            <Input
              id="media-upload-file"
              type="file"
              accept={meta.accept}
              ref={fileRef}
              onChange={(e) => pickFile(e.target.files?.[0])}
              disabled={busy}
            />
          </Field>
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
