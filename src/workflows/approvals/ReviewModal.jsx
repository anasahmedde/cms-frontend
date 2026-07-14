// Review / detail modal for a content-change request, with media previews.
import { useEffect, useState } from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import Badge from "../../ui/Badge";
import Spinner from "../../ui/Spinner";
import KeyValue from "../../ui/KeyValue";
import { Field, Textarea } from "../../ui/Field";
import { apiPost } from "../../lib/api";
import { formatDateTime } from "../../lib/format";

export const REQUEST_TYPE_LABELS = {
  video_assign: "Assign videos",
  video_unassign: "Unassign videos",
  video_remove: "Remove videos",
  group_change: "Change group",
  content_update: "Update content",
  device_settings: "Screen settings",
  advertisement_change: "Image change",
  link_content: "Assign content to group",
};

export const TARGET_TYPE_LABELS = { device: "Screen", group: "Group", shop: "Location" };

export const STATUS_TONES = {
  pending: "warn",
  approved: "success",
  rejected: "danger",
  executed: "success",
  failed: "danger",
  expired: "neutral",
  cancelled: "neutral",
};

const PREVIEWABLE = new Set(["link_content", "video_assign", "video_remove"]);

function MediaPreviews({ request }) {
  const [previews, setPreviews] = useState(null);
  const [error, setError] = useState("");

  const change = request.change_data || {};
  const videoNames = change.video_names || [];
  const adNames = change.ad_names || [];

  useEffect(() => {
    if (!PREVIEWABLE.has(request.request_type) || (videoNames.length === 0 && adNames.length === 0)) {
      setPreviews({ videos: [], advertisements: [] });
      return;
    }
    apiPost("/content-changes/media-preview", { video_names: videoNames, ad_names: adNames }).then(
      (res) => {
        if (res.ok) setPreviews(res.data || { videos: [], advertisements: [] });
        else setError(res.message);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id]);

  if (!PREVIEWABLE.has(request.request_type)) {
    return <KeyValue columns={1} items={Object.entries(change).map(([k, v]) => ({ label: k.replace(/_/g, " "), value: typeof v === "string" ? v : JSON.stringify(v) }))} />;
  }
  if (error) return <span className="u-danger">Preview unavailable — {error}</span>;
  if (!previews) return <span className="u-flex"><Spinner size={14} /> Loading previews…</span>;

  const cell = (m, isVideo) => (
    <figure key={m.name} style={{ margin: 0, width: 148 }}>
      {m.url ? (
        isVideo ? (
          <video src={m.url} controls muted style={{ width: 148, height: 84, objectFit: "cover", borderRadius: 6, background: "#000" }} />
        ) : (
          <img src={m.url} alt={m.name} style={{ width: 148, height: 84, objectFit: "cover", borderRadius: 6 }} />
        )
      ) : (
        <div style={{ width: 148, height: 84, borderRadius: 6, background: "var(--elevated)", display: "grid", placeItems: "center" }} className="u-faint">
          Preview unavailable
        </div>
      )}
      <figcaption className="u-faint" style={{ wordBreak: "break-all" }}>{m.name}</figcaption>
    </figure>
  );

  const vids = previews.videos || [];
  const ads = previews.advertisements || [];
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {change.gname && <Badge tone="info">Group: {change.gname}</Badge>}
      {vids.length > 0 && (
        <div>
          <div className="u-muted" style={{ marginBottom: 6 }}>
            {request.request_type === "video_remove" ? "Videos to remove" : "Videos to assign"} ({vids.length})
          </div>
          <div className="u-flex" style={{ flexWrap: "wrap" }}>{vids.map((m) => cell(m, true))}</div>
        </div>
      )}
      {ads.length > 0 && (
        <div>
          <div className="u-muted" style={{ marginBottom: 6 }}>Images to assign ({ads.length})</div>
          <div className="u-flex" style={{ flexWrap: "wrap" }}>{ads.map((m) => cell(m, false))}</div>
        </div>
      )}
      {vids.length === 0 && ads.length === 0 && <span className="u-muted">No videos or images in this request.</span>}
    </div>
  );
}

export default function ReviewModal({ request, onClose, onDecided }) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(null); // 'approve' | 'reject'
  const [error, setError] = useState("");

  useEffect(() => {
    setNote("");
    setError("");
    setSubmitting(null);
  }, [request?.id]);

  if (!request) return null;
  const pending = request.status === "pending";

  const decide = async (action) => {
    setSubmitting(action);
    setError("");
    const res = await apiPost(`/content-changes/${request.id}/review`, { action, review_note: note || undefined });
    setSubmitting(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    onDecided(action);
  };

  return (
    <Modal
      open={!!request}
      onClose={onClose}
      title={pending ? "Review request" : "Request details"}
      size="md"
      footer={
        pending ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={!!submitting}>Cancel</Button>
            <Button variant="danger" onClick={() => decide("reject")} loading={submitting === "reject"} disabled={submitting === "approve"}>Reject</Button>
            <Button onClick={() => decide("approve")} loading={submitting === "approve"} disabled={submitting === "reject"}>Approve</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>Close</Button>
        )
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <KeyValue
          columns={2}
          items={[
            { label: "Type", value: REQUEST_TYPE_LABELS[request.request_type] || request.request_type },
            { label: "Target", value: `${TARGET_TYPE_LABELS[request.target_type] || request.target_type}${request.target_name ? ` · ${request.target_name}` : ""}` },
            { label: "Requested by", value: `${request.requester_name || request.requested_by || "—"}${request.requester_role ? ` (${request.requester_role})` : ""}` },
            { label: "Requested at", value: formatDateTime(request.created_at) },
          ]}
        />
        {request.request_note && (
          <div>
            <div className="u-faint">Requester note</div>
            <p style={{ margin: "4px 0 0" }}>{request.request_note}</p>
          </div>
        )}
        <div>
          <div className="u-faint" style={{ marginBottom: 6 }}>Requested changes</div>
          <MediaPreviews request={request} />
        </div>
        {request.execution_error && (
          <div role="alert" style={{ padding: 10, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 8 }}>
            Execution failed after approval: {request.execution_error}
          </div>
        )}
        {pending ? (
          <Field label="Review note (optional)" htmlFor="review-note">
            <Textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note about your decision…" />
          </Field>
        ) : (
          <div>
            <Badge tone={STATUS_TONES[request.status] || "neutral"}>{request.status}</Badge>{" "}
            <span className="u-muted">
              by <strong>{request.reviewer_name || "—"}</strong>
              {request.reviewed_at ? ` on ${formatDateTime(request.reviewed_at)}` : ""}
            </span>
            <p className="u-muted" style={{ margin: "6px 0 0" }}>
              {request.review_note || "No review note provided."}
            </p>
          </div>
        )}
        {error && (
          <div role="alert" style={{ padding: 10, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 8 }}>{error}</div>
        )}
      </div>
    </Modal>
  );
}
