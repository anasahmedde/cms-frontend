// The group's playlist, split by real media type so operators pick the right
// thing in the right place:
//   - Videos (rotation)        — the /videos stack, non-image content_type
//   - Images (rotation)        — the /videos stack, image content_type
//   - Layout images (grid)     — the separate /advertisements stack
// The two rotation panels are a VIEW over ONE ordered backend list (/videos):
// on save they recombine, preserving the original play order and appending new
// items, so no item is dropped and playback order is retained.
//
// Data-loss protections kept from the previous version:
//  - a failed load BLOCKS saving (never full-replace-wipe from stale state),
//  - clearing to empty saves only behind an explicit confirm,
//  - the approval workflow is preserved: additions by non-approver roles become
//    a /content-changes request; removals always apply directly.
import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Film, Image as ImageIcon, LayoutGrid, ClipboardList } from "lucide-react";
import Button from "../../ui/Button";
import Badge from "../../ui/Badge";
import Card from "../../ui/Card";
import ErrorState from "../../ui/ErrorState";
import ConfirmModal from "../../ui/ConfirmModal";
import { SkeletonText } from "../../ui/Skeleton";
import { Field, Textarea } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import { apiGet, apiPost } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { MediaPicker } from "../media/MediaPicker";
import { contentTypeOf } from "../media/lib";
import { NO_GROUP_LABEL, NO_GROUP_VALUE } from "./useGroupAttachments";

const AUTO_APPROVE_ROLES = new Set(["admin", "manager", "company_admin", "content_manager"]);

// Classify a /videos-stack item as a rotation image vs a rotation video.
function isRotationImage(item) {
  return contentTypeOf({ kind: "video", ...item }) === "image";
}

function useGroupPlaylist(gname) {
  const [state, setState] = useState({ rotVideos: null, rotImages: null, ads: null, rotOrder: [] });
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setState({ rotVideos: null, rotImages: null, ads: null, rotOrder: [] });
    setError("");
    const enc = encodeURIComponent(gname);
    const [v, a] = await Promise.all([
      apiGet(`/group/${enc}/videos`),
      apiGet(`/group/${enc}/advertisements`),
    ]);
    if (!v.ok || !a.ok) {
      setError((!v.ok ? v.message : a.message) || "Could not load the current playlist");
      return;
    }
    // video_items carries content_type; fall back to names-only (all video) for
    // an older backend that hasn't shipped the field yet.
    const items = v.data?.video_items
      || (v.data?.video_names || []).map((n) => ({ name: n, content_type: "video" }));
    setState({
      rotVideos: items.filter((it) => !isRotationImage(it)).map((it) => it.name),
      rotImages: items.filter((it) => isRotationImage(it)).map((it) => it.name),
      ads: a.data?.ad_names || [],
      rotOrder: items.map((it) => it.name),
    });
  }, [gname]);
  useEffect(() => { load(); }, [load]);
  return { ...state, error, load };
}

// onRemove/picker may be null (viewer read-only): chips render without the X
// and the add-picker row disappears.
function ChipPanel({ icon: Icon, title, hint, names, onRemove, picker }) {
  return (
    <Card title={<span className="u-flex"><Icon size={16} aria-hidden="true" /> {title} ({names.length})</span>}>
      {hint && <p className="u-muted" style={{ margin: "0 0 8px", fontSize: 12 }}>{hint}</p>}
      <div className="u-flex" style={{ flexWrap: "wrap", minHeight: 34, marginBottom: 10 }}>
        {names.length === 0 ? (
          <span className="u-faint">{onRemove ? "Nothing selected — add below." : "Nothing assigned."}</span>
        ) : (
          names.map((n) => (
            <Badge key={n} tone="neutral">
              {n}
              {onRemove && (
                <button
                  type="button"
                  aria-label={`Remove ${n}`}
                  onClick={() => onRemove(n)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", padding: 0, marginLeft: 4, display: "inline-flex" }}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </Badge>
          ))
        )}
      </div>
      {picker}
    </Card>
  );
}

export default function PlaylistEditor({ gname, onSaved }) {
  const toast = useToast();
  const { user, isPlatform, hasPermission } = useAuth();
  // Viewers see the playlist read-only; editors keep the approval-aware save.
  const canAssign = hasPermission("manage_links");
  const { rotVideos: origVideos, rotImages: origImages, ads: origAds, rotOrder: origRotOrder, error: loadError, load } = useGroupPlaylist(gname);
  const [videos, setVideos] = useState([]);        // rotation videos
  const [rotImages, setRotImages] = useState([]);  // rotation images (same stack)
  const [layoutImages, setLayoutImages] = useState([]); // /advertisements (grid)
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [pendingInfo, setPendingInfo] = useState("");

  useEffect(() => {
    if (origVideos) setVideos(origVideos);
    if (origImages) setRotImages(origImages);
    if (origAds) setLayoutImages(origAds);
  }, [origVideos, origImages, origAds]);

  useEffect(() => {
    apiGet("/company/approval-settings").then((res) => {
      if (res.ok) setApprovalRequired(!!res.data?.require_content_approval);
    });
  }, []);

  // Recombine the two rotation panels back into ONE ordered list: keep the
  // original play order for surviving items, append newly-added ones.
  const buildRotation = useCallback(() => {
    const set = new Set([...videos, ...rotImages]);
    const kept = origRotOrder.filter((n) => set.has(n));
    const added = [...videos, ...rotImages].filter((n) => !origRotOrder.includes(n));
    return [...kept, ...added];
  }, [videos, rotImages, origRotOrder]);

  const delta = useMemo(() => {
    if (!origVideos || !origImages || !origAds) return null;
    const rotationNow = [...videos, ...rotImages];
    const addedRot = rotationNow.filter((n) => !origRotOrder.includes(n));
    const removedRot = origRotOrder.filter((n) => !rotationNow.includes(n));
    const addedAd = layoutImages.filter((n) => !origAds.includes(n));
    const removedAd = origAds.filter((n) => !layoutImages.includes(n));
    return {
      addedRot, removedRot, addedAd, removedAd,
      added: addedRot.length + addedAd.length,
      removed: removedRot.length + removedAd.length,
      any: addedRot.length + addedAd.length + removedRot.length + removedAd.length > 0,
    };
  }, [videos, rotImages, layoutImages, origVideos, origImages, origAds, origRotOrder]);

  const needsApproval =
    approvalRequired && !isPlatform && !AUTO_APPROVE_ROLES.has(user?.role) && delta?.added > 0;

  const saveDirect = async (rotationNames, adNames) => {
    const enc = encodeURIComponent(gname);
    // Save sequentially (rotation first) so one request failing can't leave the
    // two stacks half-committed — the ad stack is rewritten only after the
    // rotation save has succeeded.
    const v = await apiPost(`/group/${enc}/videos`, { video_names: rotationNames });
    if (!v.ok) { toast.error(v.message || "Save failed"); return false; }
    const a = await apiPost(`/group/${enc}/advertisements`, { ad_names: adNames });
    if (!a.ok) { toast.error(a.message || "Save failed"); return false; }
    return true;
  };

  const submit = async () => {
    if (!delta?.any || saving) return;
    const rotationNow = [...videos, ...rotImages];
    if (rotationNow.length === 0 && layoutImages.length === 0 && !confirmEmpty) {
      setConfirmEmpty(true);
      return;
    }
    setConfirmEmpty(false);
    setSaving(true);

    if (needsApproval) {
      // Removals apply immediately (never need approval); additions go to review.
      if (delta.removed > 0) {
        const set = new Set(rotationNow);
        const keptRotation = origRotOrder.filter((n) => set.has(n));
        const keptAds = origAds.filter((n) => layoutImages.includes(n));
        const ok = await saveDirect(keptRotation, keptAds);
        if (!ok) {
          setSaving(false);
          return;
        }
      }
      const res = await apiPost("/content-changes", {
        request_type: "link_content",
        target_type: "group",
        target_id: 0,
        change_data: { gname, video_names: delta.addedRot, ad_names: delta.addedAd },
        request_note: note || undefined,
        expires_in_hours: 72,
      });
      setSaving(false);
      if (!res.ok) {
        if (res.status === 409) {
          setPendingInfo("Already under review — a request for this group is still pending approval.");
        } else {
          toast.error(res.message);
        }
        return;
      }
      setPendingInfo("Submitted for review — an approver will see it in Approvals.");
      setNote("");
      toast.success("Change request submitted for approval");
      await load();
      onSaved?.();
      return;
    }

    const ok = await saveDirect(buildRotation(), layoutImages);
    setSaving(false);
    if (!ok) return;
    toast.success(
      `Playlist saved (+${delta.added} −${delta.removed}) — screens in this group re-sync now`
    );
    await load();
    onSaved?.();
  };

  const title = gname === NO_GROUP_VALUE ? NO_GROUP_LABEL : gname;

  if (loadError) {
    return (
      <ErrorState
        message={`${loadError} — editing is blocked so the current playlist can't be overwritten blindly.`}
        onRetry={load}
      />
    );
  }
  if (origVideos === null || origImages === null || origAds === null) return <SkeletonText lines={6} />;

  const inRotation = [...videos, ...rotImages];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <ChipPanel
        icon={Film}
        title="Videos"
        hint="Play in the rotation loop on every screen in this group."
        names={videos}
        onRemove={canAssign ? (n) => setVideos(videos.filter((x) => x !== n)) : null}
        picker={canAssign ? <MediaPicker kind="video" typeFilter="video" exclude={inRotation} onAdd={(n) => setVideos([...videos, n])} /> : null}
      />
      <ChipPanel
        icon={ImageIcon}
        title="Images"
        hint="Still images shown in the same rotation loop (each for its display duration)."
        names={rotImages}
        onRemove={canAssign ? (n) => setRotImages(rotImages.filter((x) => x !== n)) : null}
        picker={canAssign ? <MediaPicker kind="video" typeFilter="image" exclude={inRotation} onAdd={(n) => setRotImages([...rotImages, n])} /> : null}
      />
      <ChipPanel
        icon={LayoutGrid}
        title="Layout images (grid slots)"
        hint="Images placed in fixed grid/split-screen slots — separate from the rotation above."
        names={layoutImages}
        onRemove={canAssign ? (n) => setLayoutImages(layoutImages.filter((x) => x !== n)) : null}
        picker={canAssign ? <MediaPicker kind="image" exclude={layoutImages} onAdd={(n) => setLayoutImages([...layoutImages, n])} /> : null}
      />

      {needsApproval && (
        <Card>
          <div className="u-flex" style={{ marginBottom: 8 }}>
            <ClipboardList size={16} aria-hidden="true" />
            <strong>Approval required</strong>
          </div>
          <p className="u-muted" style={{ margin: "0 0 8px" }}>
            Adding {delta.added} new item{delta.added === 1 ? "" : "s"} needs a manager or admin to
            approve before it goes live. Removals apply immediately.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setShowNote(!showNote)}>
            {showNote ? "Hide note" : "Add a note"}
          </Button>
          {showNote && (
            <Field label="Note for the approver" htmlFor="playlist-note">
              <Textarea
                id="playlist-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional: explain why you're making this change…"
                rows={3}
              />
            </Field>
          )}
        </Card>
      )}

      {pendingInfo && <Badge tone="warn">{pendingInfo}</Badge>}

      <div className="u-flex">
        {canAssign && (
          <Button onClick={submit} loading={saving} disabled={!delta?.any}>
            {needsApproval ? "Submit for approval" : "Save playlist"}
          </Button>
        )}
        {canAssign && delta?.any && (
          <Badge tone="info">
            +{delta.added} −{delta.removed} vs current
          </Badge>
        )}
        <span className="u-faint">
          {canAssign ? `Playing on every screen in ${title}` : `Playing on every screen in ${title} — your role can view but not change it`}
        </span>
      </div>

      <ConfirmModal
        open={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        onConfirm={submit}
        title="Remove all content?"
        message={`This removes all ${(origRotOrder?.length || 0) + (origAds?.length || 0)} items from every screen in ${title}. The screens will show nothing until new content is assigned.`}
        danger
        confirmLabel="Remove everything"
        loading={saving}
      />
    </div>
  );
}
