// LayoutEditor — full-featured PANEL (no Modal wrapper of its own; parents
// render it inline in a Card or inside a Modal size="xl") that edits ONE
// screen's multi-slot layout. Port of components/GridLayoutEditor.js with the
// design-doc §7 fixes: shared authenticated client, per-link save failures
// surfaced (not console.warn'd), no default-overwrite after a failed layout
// load, ConfirmModal instead of the inline two-step group confirm.
//
// Public API (cross-agent contract — do not change):
//   default export <LayoutEditor mobileId gname onSaved onClose />
import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../ui/Button";
import CopyButton from "../../ui/CopyButton";
import ErrorState from "../../ui/ErrorState";
import Skeleton from "../../ui/Skeleton";
import { useToast } from "../../ui/Toast";
import { saveLayoutForDevice } from "./save";
import useEditorData from "./useEditorData";
import useLayoutState from "./useLayoutState";
import ApplyToGroup from "./ApplyToGroup";
import ModePicker from "./ModePicker";
import SequentialPanel from "./SequentialPanel";
import SlotEditor from "./SlotEditor";
import SlotGrid from "./SlotGrid";
import "./layout-editor.css";

export default function LayoutEditor({ mobileId, gname, onSaved, onClose }) {
  const toast = useToast();
  const data = useEditorData(mobileId, gname);
  const editor = useLayoutState(data, {
    onAllSlotsFull: () =>
      toast.info("All slots are filled — select a slot or clear one first."),
  });

  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    const res = await saveLayoutForDevice({
      mobileId,
      targetVideos: data.videos,
      slots: editor.slots,
      layoutMode: editor.layoutMode,
      playAllSequential: editor.playAllSequential,
      sequentialVideos: editor.sequentialVideos,
    });
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.message);
      toast.error(res.message);
      return;
    }
    if (res.failedSlots.length > 0) {
      // §7 fix: the legacy editor console.warn'd these and closed as if saved.
      const names = res.failedSlots.map((f) => `slot ${f.position} (${f.name})`).join(", ");
      const msg = `Layout saved, but position/rotation settings failed for ${names}. Save again to retry.`;
      setSaveError(msg);
      toast.error(msg);
      onSaved?.();
      return; // keep the panel open so the user can retry
    }
    toast.success("Layout saved");
    onSaved?.();
    onClose?.();
  };

  if (data.loading) return <LoadingSkeleton />;
  if (data.error) return <ErrorState message={data.error} onRetry={data.reload} />;

  const busy = saving || applying;

  return (
    <div className="le-root">
      <div className="le-context">
        <span className="le-context-label">Device ID</span>
        <span className="mono le-context-id">{mobileId}</span>
        <CopyButton value={mobileId} small />
        {gname && gname !== "_none" ? (
          // TODO: point at /groups/{gname} once the group detail route ships.
          <Link className="le-link" to={`/groups?q=${encodeURIComponent(gname)}`}>
            Group: {gname}
          </Link>
        ) : null}
      </div>

      <div className="le-grid">
        <div className="le-main">
          <h4 className="le-section-title">Layout</h4>
          <ModePicker value={editor.layoutMode} onChange={editor.changeMode} disabled={busy} />

          {editor.layoutMode === "single" && (
            <SequentialPanel
              enabled={editor.playAllSequential}
              onToggle={editor.toggleSequential}
              videos={data.videos}
              sequence={editor.sequentialVideos}
              onChange={editor.setSequentialVideos}
            />
          )}

          <h4 className="le-section-title">Preview — drag content in or click a slot</h4>
          <SlotGrid
            layoutMode={editor.layoutMode}
            slots={editor.slots}
            resolution={data.resolution}
            resolutionKnown={data.resolutionKnown}
            selectedSlot={editor.selectedSlot}
            onSelectSlot={(i) => editor.setSelectedSlot((cur) => (cur === i ? null : i))}
            onDropContent={editor.handleDrop}
            onRemoveSlot={editor.removeFromSlot}
          />

          {saveError ? (
            <p className="le-save-error" role="alert">
              {saveError}
            </p>
          ) : null}
        </div>

        <SlotEditor
          tab={editor.contentTab}
          onTabChange={editor.setContentTab}
          videos={data.videos}
          ads={data.ads}
          adsError={data.adsError}
          onRetryAds={data.reload}
          slots={editor.slots}
          gname={gname}
          onPickVideo={(v) => editor.handlePick("video", v)}
          onPickAd={(a) => editor.handlePick("ad", a)}
          onDragStartVideo={(v) => editor.setDragItem({ type: "video", item: v })}
          onDragStartAd={(a) => editor.setDragItem({ type: "ad", item: a })}
          onSetRotation={editor.setRotation}
        />
      </div>

      <div className="le-footer">
        <ApplyToGroup
          mobileId={mobileId}
          gname={gname}
          groupDevices={data.groupDevices}
          groupError={data.groupError}
          onRetryGroup={data.reload}
          layout={{
            slots: editor.slots,
            layoutMode: editor.layoutMode,
            playAllSequential: editor.playAllSequential,
            sequentialVideos: editor.sequentialVideos,
          }}
          targetVideos={data.videos}
          disabled={busy}
          onBusyChange={setApplying}
          onApplied={(allOk) => {
            onSaved?.();
            if (allOk) onClose?.();
          }}
        />
        <div className="le-footer-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={applying}>
            Save layout
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="le-root" aria-busy="true">
      <Skeleton width={260} height={16} />
      <div className="le-grid">
        <div className="le-main">
          <Skeleton height={72} />
          <Skeleton height={300} />
        </div>
        <div className="le-side">
          <Skeleton height={36} />
          <Skeleton height={160} />
          <Skeleton height={160} />
        </div>
      </div>
    </div>
  );
}
