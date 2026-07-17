// Header action buttons for one screen: refresh player, mute/unmute,
// activate/deactivate, delete (with 409 linked-counts force flow).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pause, Play, RotateCw, Trash2, Volume2, VolumeX } from "lucide-react";
import { apiDelete, apiPost } from "../../lib/api";
import Button from "../../ui/Button";
import ConfirmModal from "../../ui/ConfirmModal";
import { useToast } from "../../ui/Toast";

export default function HeaderActions({ device, onPatched, onChanged }) {
  const toast = useToast();
  const navigate = useNavigate();
  const mobileId = device.mobile_id;
  const displayName = device.device_name || mobileId;
  const isActive = device.is_active !== false;

  const [refreshing, setRefreshing] = useState(false);
  const [muting, setMuting] = useState(false);
  const [activeConfirm, setActiveConfirm] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [linkedDetail, setLinkedDetail] = useState(null); // 409 payload for the force flow

  const refreshPlayer = async () => {
    setRefreshing(true);
    const res = await apiPost(`/device/${encodeURIComponent(mobileId)}/refresh`);
    setRefreshing(false);
    if (res.ok) toast.success("Restart sent — the screen restarts on its next heartbeat");
    else toast.error(res.message || "Could not send the restart signal");
  };

  const toggleMute = async () => {
    const nextMuted = !device.is_muted;
    setMuting(true);
    const res = await apiPost(`/device/${encodeURIComponent(mobileId)}/mute`, {
      is_muted: nextMuted,
    });
    setMuting(false);
    if (res.ok) {
      onPatched({ is_muted: nextMuted });
      toast.success(nextMuted ? `${displayName} muted` : `${displayName} unmuted`);
    } else {
      toast.error(res.message || "Could not change the audio state");
    }
  };

  const toggleActive = async () => {
    setTogglingActive(true);
    const res = await apiPost(`/device/${encodeURIComponent(mobileId)}/active-status`, {
      is_active: !isActive,
    });
    setTogglingActive(false);
    setActiveConfirm(false);
    if (res.ok) {
      onPatched({ is_active: !isActive });
      toast.success(!isActive ? "Screen activated" : "Screen deactivated");
      onChanged();
    } else {
      toast.error(res.message || "Could not change the screen's status");
    }
  };

  const doDelete = async (force) => {
    setDeleting(true);
    const res = await apiDelete(
      `/device/${encodeURIComponent(mobileId)}${force ? "?force=true" : ""}`
    );
    setDeleting(false);
    if (res.ok) {
      const unlinked = res.data?.unlinked
        ? Object.values(res.data.unlinked).reduce((a, b) => a + b, 0)
        : 0;
      toast.success(
        `Screen "${displayName}" deleted${unlinked ? ` (removed ${unlinked} linked records)` : ""}`
      );
      navigate("/screens");
      return;
    }
    setDeleteConfirm(false);
    if (res.status === 409 && res.detail && typeof res.detail === "object") {
      // Two backend shapes exist: {linked:{...}} and legacy {recent_links:[...]}.
      const linked =
        res.detail.linked ||
        (Array.isArray(res.detail.recent_links)
          ? { playlist_links: res.detail.recent_links.length }
          : null);
      setLinkedDetail({ message: res.detail.message, linked });
    } else {
      toast.error(res.message || "Could not delete the screen");
    }
  };

  return (
    <>
      <Button variant="secondary" icon={RotateCw} loading={refreshing} onClick={refreshPlayer}>
        Refresh player
      </Button>
      <Button
        variant="ghost"
        icon={device.is_muted ? Volume2 : VolumeX}
        loading={muting}
        onClick={toggleMute}
      >
        {device.is_muted ? "Unmute" : "Mute"}
      </Button>
      <Button variant="ghost" icon={isActive ? Pause : Play} onClick={() => setActiveConfirm(true)}>
        {isActive ? "Deactivate" : "Activate"}
      </Button>
      <Button variant="danger" icon={Trash2} onClick={() => setDeleteConfirm(true)}>
        Delete
      </Button>

      <ConfirmModal
        open={activeConfirm}
        onClose={() => setActiveConfirm(false)}
        onConfirm={toggleActive}
        loading={togglingActive}
        danger={isActive}
        title={isActive ? "Deactivate screen" : "Activate screen"}
        confirmLabel={isActive ? "Deactivate" : "Activate"}
        message={
          isActive
            ? `Deactivate "${displayName}"? The player will show a "Not Enrolled" message until you activate it again.`
            : `Activate "${displayName}"? The screen resumes playing its assigned content.`
        }
      />

      <ConfirmModal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => doDelete(false)}
        loading={deleting}
        danger
        title="Delete screen"
        confirmLabel="Delete screen"
        message={`Delete screen "${displayName}"? This removes it from your fleet and cannot be undone.`}
      />

      <ConfirmModal
        open={!!linkedDetail}
        onClose={() => setLinkedDetail(null)}
        onConfirm={() => doDelete(true)}
        loading={deleting}
        danger
        title="Screen has linked records"
        confirmLabel="Delete everything"
        message={
          linkedDetail?.message ||
          `"${displayName}" still has linked records. Deleting it removes them too.`
        }
        linked={linkedDetail?.linked || undefined}
      />
    </>
  );
}
