// Aspect-correct preview of the screen. Slots accept drag-and-drop AND click:
// clicking (or Enter/Space on) a slot selects it as the target for the content
// picker — the keyboard path for what used to be drag-only in the legacy editor.
import { Film, Image as ImageIcon, Plus, X } from "lucide-react";
import { LAYOUT_PRESETS, parseResolution } from "./presets";

export default function SlotGrid({
  layoutMode,
  slots,
  resolution,
  resolutionKnown,
  selectedSlot,
  onSelectSlot,
  onDropContent,
  onRemoveSlot,
}) {
  const preset = LAYOUT_PRESETS[layoutMode] || LAYOUT_PRESETS.single;
  const { width, height } = parseResolution(resolution);
  const aspectRatio = width / height;
  const orientation = aspectRatio > 1 ? "Landscape" : aspectRatio < 1 ? "Portrait" : "Square";

  return (
    <div className="le-preview-wrap">
      <div
        className="le-preview"
        style={{
          aspectRatio: `${width} / ${height}`,
          // Portrait screens: cap width so the preview stays ~340px tall.
          maxWidth: aspectRatio < 1 ? `${Math.round(340 * aspectRatio)}px` : "100%",
        }}
      >
        {preset.rows.map((row, ri) => (
          <div key={ri} className="le-preview-row">
            {row.map((slotIdx) => (
              <SlotBox
                key={slotIdx}
                slot={slots[slotIdx]}
                index={slotIdx}
                selected={selectedSlot === slotIdx}
                onSelect={onSelectSlot}
                onDropContent={onDropContent}
                onRemove={onRemoveSlot}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="le-preview-caption mono">
        Resolution: {width} × {height} ({orientation})
        {resolutionKnown ? "" : " — default, screen hasn't reported one"}
      </p>
    </div>
  );
}

function SlotBox({ slot, index, selected, onSelect, onDropContent, onRemove }) {
  const hasContent = Boolean(slot?.video || slot?.advertisement);
  const isImage = slot?.content_type === "image" || Boolean(slot?.advertisement);
  const name = slot?.video?.video_name || slot?.advertisement?.ad_name || "";
  const classNames = [
    "le-slot",
    hasContent ? (isImage ? "le-slot-image" : "le-slot-video") : "le-slot-empty",
    selected ? "le-slot-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classNames}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={
        hasContent
          ? `Slot ${index + 1}: ${name}${selected ? " (selected)" : ""}`
          : `Slot ${index + 1}: empty${selected ? " (selected)" : ""}`
      }
      onClick={() => onSelect(index)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(index);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropContent(index);
      }}
    >
      {hasContent ? (
        <>
          {isImage ? (
            <ImageIcon size={16} aria-hidden="true" />
          ) : (
            <Film size={16} aria-hidden="true" />
          )}
          <span className="le-slot-name" title={name}>
            {name}
          </span>
          <span className="le-slot-rotation">
            {slot.rotation != null ? `${slot.rotation}°` : "Default"}
          </span>
          <button
            type="button"
            className="le-slot-remove"
            aria-label={`Clear slot ${index + 1}`}
            title={`Clear slot ${index + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(index);
            }}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </>
      ) : (
        <span className="le-slot-placeholder">
          <Plus size={16} aria-hidden="true" />
          <span>Slot {index + 1}</span>
        </span>
      )}
    </div>
  );
}
