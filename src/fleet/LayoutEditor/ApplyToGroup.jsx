// "Apply to group" — pushes this screen's layout and content to every screen
// in the group. Primary path: POST /group/{gname}/sync-to-devices (exact
// legacy payload: {source_mobile_id, layout_mode, layout_config}). If that
// endpoint fails, falls back to per-screen saves like legacy 505-516, with
// progress. The inline two-step confirm is now a real ConfirmModal.
//
// Deliberate defect fix (map fe-groups-shops issue #3): the layout_config sent
// to sync-to-devices is the SAME full config the device save uses (ad_name,
// content_type, sequential fields included) — the legacy editor rebuilt a
// videos-only config here, silently dropping image slots and the sequence
// from every other screen in the group.
import { useState } from "react";
import { Layers } from "lucide-react";
import { apiPost } from "../../lib/api";
import Button from "../../ui/Button";
import ConfirmModal from "../../ui/ConfirmModal";
import { useToast } from "../../ui/Toast";
import { buildLayoutConfig, describeApiError } from "./presets";
import { applyLayoutToGroupFallback, saveLayoutForDevice } from "./save";

export default function ApplyToGroup({
  mobileId,
  gname,
  groupDevices,
  groupError,
  onRetryGroup,
  layout,
  targetVideos,
  disabled,
  onBusyChange,
  onApplied,
}) {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(null);

  if (!gname || gname === "_none") return null;
  if (groupError) {
    return (
      <p className="le-group-error" role="alert">
        Couldn't load the group's screens — {groupError}{" "}
        <button type="button" className="le-link" onClick={onRetryGroup}>
          Retry
        </button>
      </p>
    );
  }
  // Parity with legacy: the button only exists when the group has >1 screen.
  if (!groupDevices || groupDevices.length < 2) return null;

  const finish = (busy) => {
    setApplying(busy);
    onBusyChange?.(busy);
    if (!busy) setProgress(null);
  };

  const handleConfirm = async () => {
    finish(true);

    // 1. Save this screen first (legacy did the same).
    const own = await saveLayoutForDevice({ mobileId, targetVideos, ...layout });
    if (!own.ok) {
      toast.error(own.message);
      finish(false);
      return;
    }
    if (own.failedSlots.length > 0) {
      const names = own.failedSlots.map((f) => `slot ${f.position} (${f.name})`).join(", ");
      toast.error(`Position/rotation settings failed on this screen for ${names}.`);
    }

    // 2. One-shot group sync endpoint.
    const layoutConfig = buildLayoutConfig(layout);
    const syncRes = await apiPost(`/group/${encodeURIComponent(gname)}/sync-to-devices`, {
      source_mobile_id: mobileId,
      layout_mode: layout.layoutMode,
      layout_config: JSON.stringify(layoutConfig),
    });
    if (syncRes.ok) {
      const updated = syncRes.data?.devices_updated ?? 0;
      toast.success(`Layout applied to ${updated + 1} screens in ${gname}`);
      setConfirmOpen(false);
      finish(false);
      onApplied?.(true);
      return;
    }

    // 3. Endpoint failed → per-screen fallback loop (legacy behavior), with
    //    honest progress and an error that names the damage.
    const { success, failed, slotFailures } = await applyLayoutToGroupFallback({
      groupDevices,
      layout,
      onProgress: (current, total) => setProgress({ current, total }),
    });
    if (failed > 0) {
      toast.error(
        `Applied to ${success} screens, failed on ${failed} screens — ${describeApiError(
          syncRes,
          "group sync unavailable"
        )}`
      );
    } else {
      toast.success(
        `Layout applied to ${success} screens in ${gname}` +
          (slotFailures > 0 ? ` (${slotFailures} slot settings failed)` : "")
      );
    }
    setConfirmOpen(false);
    finish(false);
    onApplied?.(failed === 0);
  };

  return (
    <>
      <Button
        variant="secondary"
        icon={Layers}
        disabled={disabled}
        onClick={() => setConfirmOpen(true)}
        title={`Apply this layout to all ${groupDevices.length} screens in ${gname}`}
      >
        Apply to group ({groupDevices.length} screens)
      </Button>
      <ConfirmModal
        open={confirmOpen}
        onClose={() => {
          if (!applying) setConfirmOpen(false);
        }}
        onConfirm={handleConfirm}
        title="Apply layout to the whole group?"
        message={`This overwrites the layout and content of every screen in ${gname} — ${groupDevices.length} screens will be updated to match this one.`}
        danger
        confirmLabel="Apply to all screens"
        loading={applying}
      >
        {applying && progress ? (
          <p className="le-apply-progress" role="status">
            Applying {progress.current}/{progress.total}…
          </p>
        ) : null}
      </ConfirmModal>
    </>
  );
}
