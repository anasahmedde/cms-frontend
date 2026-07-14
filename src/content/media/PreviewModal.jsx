// Media preview: presigned URL (with the legacy raw-http s3_link fallback),
// rendered per content type — <video> for videos, <img> for images, an iframe
// for HTML/PDF (legacy wrongly forced these into a <video> tag). Presign
// failure shows an ErrorState with retry, never a blank stage.
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import Badge from "../../ui/Badge";
import Spinner from "../../ui/Spinner";
import ErrorState from "../../ui/ErrorState";
import { contentTypeOf, fetchPresignedUrl, FIT_LABELS, TYPE_TONES } from "./lib";
import "./media.css";

function Stage({ item, type, url }) {
  const rotation = item.rotation || 0;
  const rotate = rotation ? { transform: `rotate(${rotation}deg)` } : undefined;
  if (type === "video") {
    return (
      <video
        src={url}
        controls
        autoPlay
        style={{ maxWidth: "100%", maxHeight: 480, ...rotate }}
      />
    );
  }
  if (type === "image") {
    return (
      <img
        src={url}
        alt={`Preview of ${item.name}`}
        style={{ maxWidth: "100%", maxHeight: 480, objectFit: "contain", ...rotate }}
      />
    );
  }
  // html / pdf — sandboxed inline render plus an escape hatch.
  return (
    <div style={{ width: "100%" }}>
      <iframe
        src={url}
        title={`Preview of ${item.name}`}
        sandbox=""
        style={{ width: "100%", height: 440, border: "none", background: "var(--card)" }}
      />
      <div style={{ padding: 8, textAlign: "center" }}>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--sidebar-text)", fontSize: 13 }}>
          <ExternalLink size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Open in a new tab
        </a>
      </div>
    </div>
  );
}

export default function PreviewModal({ open, item, onClose }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    setError("");
    setUrl(null);
    const res = await fetchPresignedUrl(item);
    setLoading(false);
    if (res.ok) setUrl(res.url);
    else setError(res.message || `Could not load the ${contentTypeOf(item)} preview`);
  }, [item]);

  useEffect(() => {
    if (open && item) load();
  }, [open, item, load]);

  if (!item) return null;
  const type = contentTypeOf(item);
  const rotation = item.rotation || 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Preview — ${item.name}`}
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="media-preview-info">
        <Badge tone={item.kind === "video" ? "info" : "success"}>
          {item.kind === "video" ? "Video" : "Image"}
        </Badge>
        {item.kind === "video" && type !== "video" && (
          <Badge tone={TYPE_TONES[type] || "neutral"}>{type.toUpperCase()}</Badge>
        )}
        <span className="u-muted">Rotation: {rotation}°</span>
        <span className="u-muted">Fit: {FIT_LABELS[item.fit_mode || "cover"]}</span>
        {type !== "video" && item.display_duration != null && (
          <span className="u-muted">Duration: {item.display_duration}s</span>
        )}
      </div>

      <div className="media-preview-stage">
        {loading ? (
          <span className="u-flex">
            <Spinner size={18} /> Loading preview…
          </span>
        ) : error ? (
          <div style={{ padding: 20, width: "100%" }}>
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : url ? (
          <Stage item={item} type={type} url={url} />
        ) : null}
      </div>

      {rotation !== 0 && (
        <div className="media-preview-note">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>
            This {type === "video" ? "video" : type === "image" ? "image" : "content"} is set to
            rotate {rotation}° on the player.
          </span>
        </div>
      )}
    </Modal>
  );
}
