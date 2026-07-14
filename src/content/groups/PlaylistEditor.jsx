// The group's playlist (videos + images). Replaces GroupLinkedVideo with the
// data-loss bugs fixed:
//  - a failed load BLOCKS saving (legacy rendered "No content linked yet" and
//    a save would full-replace-wipe the group),
//  - clearing to empty actually saves (legacy skipped the request and showed
//    fake success), behind an explicit confirm.
// The approval workflow is preserved exactly: additions by non-approver roles
// become a /content-changes request; removals always apply directly.
import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Film, Image as ImageIcon, ClipboardList } from "lucide-react";
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
import { NO_GROUP_LABEL, NO_GROUP_VALUE } from "./useGroupAttachments";

const AUTO_APPROVE_ROLES = new Set(["admin", "manager", "company_admin", "content_manager"]);

function useGroupPlaylist(gname) {
  const [videos, setVideos] = useState(null);
  const [images, setImages] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setVideos(null);
    setImages(null);
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
    setVideos(v.data?.video_names || []);
    setImages(a.data?.ad_names || []);
  }, [gname]);
  useEffect(() => {
    load();
  }, [load]);
  return { videos, images, error, load };
}

function ChipPanel({ icon: Icon, title, names, onRemove, picker }) {
  return (
    <Card title={<span className="u-flex"><Icon size={16} aria-hidden="true" /> {title} ({names.length})</span>}>
      <div className="u-flex" style={{ flexWrap: "wrap", minHeight: 34, marginBottom: 10 }}>
        {names.length === 0 ? (
          <span className="u-faint">Nothing selected — add below.</span>
        ) : (
          names.map((n) => (
            <Badge key={n} tone="neutral">
              {n}
              <button
                type="button"
                aria-label={`Remove ${n}`}
                onClick={() => onRemove(n)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", padding: 0, marginLeft: 4, display: "inline-flex" }}
              >
                <X size={12} aria-hidden="true" />
              </button>
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
  const { user, isPlatform } = useAuth();
  const { videos: origVideos, images: origImages, error: loadError, load } = useGroupPlaylist(gname);
  const [videos, setVideos] = useState([]);
  const [images, setImages] = useState([]);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [pendingInfo, setPendingInfo] = useState("");

  useEffect(() => {
    if (origVideos) setVideos(origVideos);
    if (origImages) setImages(origImages);
  }, [origVideos, origImages]);

  useEffect(() => {
    apiGet("/company/approval-settings").then((res) => {
      if (res.ok) setApprovalRequired(!!res.data?.require_content_approval);
    });
  }, []);

  const delta = useMemo(() => {
    if (!origVideos || !origImages) return null;
    const addedV = videos.filter((n) => !origVideos.includes(n));
    const removedV = origVideos.filter((n) => !videos.includes(n));
    const addedI = images.filter((n) => !origImages.includes(n));
    const removedI = origImages.filter((n) => !images.includes(n));
    return {
      addedV, removedV, addedI, removedI,
      added: addedV.length + addedI.length,
      removed: removedV.length + removedI.length,
      any: addedV.length + addedI.length + removedV.length + removedI.length > 0,
    };
  }, [videos, images, origVideos, origImages]);

  const needsApproval =
    approvalRequired && !isPlatform && !AUTO_APPROVE_ROLES.has(user?.role) && delta?.added > 0;

  const saveDirect = async (videoNames, imageNames) => {
    const enc = encodeURIComponent(gname);
    const [v, a] = await Promise.all([
      apiPost(`/group/${enc}/videos`, { video_names: videoNames }),
      apiPost(`/group/${enc}/advertisements`, { ad_names: imageNames }),
    ]);
    if (!v.ok || !a.ok) {
      toast.error((!v.ok ? v.message : a.message) || "Save failed");
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!delta?.any || saving) return;
    if (videos.length === 0 && images.length === 0 && !confirmEmpty) {
      setConfirmEmpty(true);
      return;
    }
    setConfirmEmpty(false);
    setSaving(true);

    if (needsApproval) {
      // Removals apply immediately (never need approval); additions go to review.
      if (delta.removed > 0) {
        const keptV = origVideos.filter((n) => videos.includes(n));
        const keptI = origImages.filter((n) => images.includes(n));
        const ok = await saveDirect(keptV, keptI);
        if (!ok) {
          setSaving(false);
          return;
        }
      }
      const res = await apiPost("/content-changes", {
        request_type: "link_content",
        target_type: "group",
        target_id: 0,
        change_data: { gname, video_names: delta.addedV, ad_names: delta.addedI },
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

    const ok = await saveDirect(videos, images);
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
  if (origVideos === null || origImages === null) return <SkeletonText lines={6} />;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <ChipPanel
        icon={Film}
        title="Videos"
        names={videos}
        onRemove={(n) => setVideos(videos.filter((x) => x !== n))}
        picker={<MediaPicker kind="video" exclude={videos} onAdd={(n) => setVideos([...videos, n])} />}
      />
      <ChipPanel
        icon={ImageIcon}
        title="Images"
        names={images}
        onRemove={(n) => setImages(images.filter((x) => x !== n))}
        picker={<MediaPicker kind="image" exclude={images} onAdd={(n) => setImages([...images, n])} />}
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
        <Button onClick={submit} loading={saving} disabled={!delta?.any}>
          {needsApproval ? "Submit for approval" : "Save playlist"}
        </Button>
        {delta?.any && (
          <Badge tone="info">
            +{delta.added} −{delta.removed} vs current
          </Badge>
        )}
        <span className="u-faint">Playing on every screen in {title}</span>
      </div>

      <ConfirmModal
        open={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        onConfirm={submit}
        title="Remove all content?"
        message={`This removes all ${(origVideos?.length || 0) + (origImages?.length || 0)} items from every screen in ${title}. The screens will show nothing until new content is assigned.`}
        danger
        confirmLabel="Remove everything"
        loading={saving}
      />
    </div>
  );
}
