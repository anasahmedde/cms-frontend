// In-browser preview replicating the player's six layout modes: content is
// slotted by grid_position (empty slots stay black), per-item rotation and
// fit_mode are applied, and in grid modes every slot except the first is
// muted — a faithful port of the legacy VideoPlayerModal.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import Badge from "../../ui/Badge";
import Spinner from "../../ui/Spinner";
import ErrorState from "../../ui/ErrorState";
import { apiGet } from "../../lib/api";
import { LAYOUT_LABELS } from "../lib";
import "./dashboard.css";

const SLOT_COUNTS = { single: 1, split_h: 2, split_v: 2, grid_3: 3, grid_4: 4, grid_1x4: 4 };

const GRID_TEMPLATES = {
  split_h: { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr" },
  split_v: { gridTemplateColumns: "1fr", gridTemplateRows: "1fr 1fr" },
  grid_3: { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" },
  grid_4: { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" },
  grid_1x4: { gridTemplateColumns: "1fr", gridTemplateRows: "repeat(4, 1fr)" },
};

function slotArray(items, mode) {
  const n = SLOT_COUNTS[mode] || 1;
  const slots = Array(n).fill(null);
  items.forEach((item) => {
    const pos = item.grid_position;
    const idx = pos > 0 && pos <= n ? pos - 1 : null;
    if (idx !== null && slots[idx] === null) slots[idx] = item;
  });
  return slots;
}

function SlotMedia({ item, index, videoRefs }) {
  const isImage = item.content_type === "image";
  const rotate = { transform: `rotate(${item.rotation || 0}deg)` };
  return (
    <>
      {isImage ? (
        <img
          src={item.url}
          alt={item.video_name || "Image"}
          style={{ width: "100%", height: "100%", objectFit: item.fit_mode || "cover", ...rotate }}
        />
      ) : (
        <video
          ref={(el) => { videoRefs.current[index] = el; }}
          src={item.url}
          autoPlay
          muted={index > 0}
          loop
          style={{ width: "100%", height: "100%", objectFit: "cover", ...rotate }}
        />
      )}
      <span className="fleet-preview-slot-label">
        {index + 1}. {item.video_name || (isImage ? "Image" : "Video")}
        {(item.rotation || 0) !== 0 ? ` (${item.rotation}°)` : ""}
      </span>
    </>
  );
}

export default function PreviewModal({ open, row, onClose }) {
  const [items, setItems] = useState([]);
  const [mode, setMode] = useState("single");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);
  const videoRefs = useRef([]);
  const mobileId = row?.mobile_id;

  useEffect(() => {
    if (!open || !mobileId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItems([]);
    setIndex(0);
    (async () => {
      const res = await apiGet(`/device/${encodeURIComponent(mobileId)}/videos/downloads`);
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(
          res.status === 404
            ? "No media is assigned to this screen, or its files have no storage links yet."
            : res.message
        );
        return;
      }
      const list = Array.isArray(res.data?.items) ? res.data.items : [];
      if (list.length === 0) {
        setError("No downloadable media found for this screen.");
        return;
      }
      setItems([...list].sort((a, b) => (a.grid_position || 0) - (b.grid_position || 0)));
      setMode(res.data?.layout_mode || "single");
    })();
    return () => { cancelled = true; };
  }, [open, mobileId]);

  const isGrid = mode !== "single" && items.length > 1;
  const current = !isGrid ? items[index] : null;
  const next = () => setIndex((i) => (i + 1) % items.length);
  const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);
  const restartAll = () => {
    videoRefs.current.forEach((ref) => {
      if (ref) {
        ref.currentTime = 0;
        ref.play();
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Preview — ${row?.device_name || mobileId || ""}`}
      size="xl"
    >
      <div className="fleet-preview-info">
        <span>
          Device ID: <span className="mono">{mobileId}</span>
        </span>
        <Badge tone={isGrid ? "success" : "info"}>
          {LAYOUT_LABELS[mode] || mode}
        </Badge>
      </div>

      {!isGrid && current && (
        <div className="fleet-preview-info">
          <span>
            {current.content_type === "image" ? "Image" : "Video"} {index + 1} of {items.length}:{" "}
            <strong>{current.video_name || current.filename || "Unknown"}</strong>
          </span>
          <span className="u-flex">
            {current.content_type === "image" && <Badge tone="success">Image</Badge>}
            {(current.rotation || 0) !== 0 && (
              <Badge tone="neutral">Rotation: {current.rotation}°</Badge>
            )}
          </span>
        </div>
      )}

      <div
        className="fleet-preview-stage"
        style={isGrid ? undefined : { maxHeight: "min(60vh, 520px)" }}
      >
        {loading ? (
          <div style={{ color: "#fff", padding: 40, textAlign: "center" }}>
            <Spinner size={20} /> <span style={{ marginLeft: 8 }}>Loading content…</span>
          </div>
        ) : error ? (
          <div style={{ padding: 24, width: "100%" }}>
            <ErrorState message={error} />
          </div>
        ) : isGrid ? (
          <div className="fleet-preview-grid" style={GRID_TEMPLATES[mode]}>
            {slotArray(items, mode).map((item, i) => (
              <div
                key={i}
                className="fleet-preview-slot"
                style={mode === "grid_3" && i === 2 ? { gridColumn: "1 / -1" } : undefined}
              >
                {item?.url ? (
                  <SlotMedia item={item} index={i} videoRefs={videoRefs} />
                ) : (
                  <span className="fleet-preview-empty-slot">Slot {i + 1} — empty</span>
                )}
              </div>
            ))}
          </div>
        ) : current?.url ? (
          current.content_type === "image" ? (
            <img
              src={current.url}
              alt={current.video_name || "Image"}
              style={{
                maxWidth: "100%",
                maxHeight: 480,
                objectFit: current.fit_mode || "contain",
                transform: `rotate(${current.rotation || 0}deg)`,
              }}
            />
          ) : (
            <video
              ref={(el) => { videoRefs.current[0] = el; }}
              src={current.url}
              controls
              autoPlay
              style={{
                maxWidth: "100%",
                maxHeight: 480,
                transform: `rotate(${current.rotation || 0}deg)`,
              }}
              onEnded={next}
              onError={() => setError("Failed to play this media. The link may have expired — close and reopen the preview.")}
            />
          )
        ) : (
          <span className="fleet-preview-empty-slot">No content URL available</span>
        )}
      </div>

      {!isGrid && items.length > 1 && !loading && !error && (
        <div className="fleet-preview-controls">
          <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={prev}>
            Previous
          </Button>
          <div className="fleet-preview-dots">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show item ${i + 1} of ${items.length}`}
                className={`fleet-preview-dot${i === index ? " fleet-preview-dot--active" : ""}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={next}>
            Next
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )}

      {isGrid && !loading && !error && (
        <div className="fleet-preview-controls">
          <span className="u-muted">
            Playing {slotArray(items, mode).filter(Boolean).length} items in a grid layout
          </span>
          <Button variant="secondary" size="sm" icon={RotateCcw} onClick={restartAll}>
            Restart all
          </Button>
        </div>
      )}
    </Modal>
  );
}
