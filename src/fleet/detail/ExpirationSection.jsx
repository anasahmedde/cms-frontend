// Per-screen expiration — NEW UI over existing endpoints (be-entities §4.3):
// read via GET /schedules?device_id= (schedule_type=expiration), write via
// PUT /device/{id}/expiration?expires_at&action&notify_days_before, clear via
// DELETE. Save is disabled while the current value failed to load.
import { useCallback, useEffect, useId, useState } from "react";
import { apiDelete, apiGet, apiPut } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import ConfirmModal from "../../ui/ConfirmModal";
import { Field, Input, Select } from "../../ui/Field";
import Skeleton from "../../ui/Skeleton";
import ErrorState from "../../ui/ErrorState";
import { useToast } from "../../ui/Toast";

const ACTIONS = [
  { value: "deactivate", label: "Deactivate the screen" },
  { value: "delete", label: "Delete the screen" },
  { value: "notify_only", label: "Notify only" },
];

const actionLabel = (v) => ACTIONS.find((a) => a.value === v)?.label || v;

// ISO → value usable by <input type="datetime-local">
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ExpirationSection({ mobileId, deviceId }) {
  const toast = useToast();
  const ids = useId();
  const [load, setLoad] = useState({ loading: true, error: null });
  const [current, setCurrent] = useState(null); // active expiration schedule or null
  const [expiresAt, setExpiresAt] = useState("");
  const [action, setAction] = useState("deactivate");
  const [notifyDays, setNotifyDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchCurrent = useCallback(async () => {
    setLoad({ loading: true, error: null });
    const res = await apiGet("/schedules", { params: { device_id: deviceId, status: "active" } });
    if (!res.ok) {
      setLoad({ loading: false, error: res.message });
      return;
    }
    const exp = (res.data?.schedules || []).find((s) => s.schedule_type === "expiration") || null;
    setCurrent(exp);
    setExpiresAt(toLocalInput(exp?.scheduled_at));
    setAction(exp?.action || "deactivate");
    setNotifyDays(exp?.notify_days_before ?? 7);
    setLoad({ loading: false, error: null });
  }, [deviceId]);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  const save = async () => {
    if (!expiresAt) {
      toast.error("Pick an expiration date and time first");
      return;
    }
    setSaving(true);
    const res = await apiPut(`/device/${encodeURIComponent(mobileId)}/expiration`, undefined, {
      params: {
        expires_at: new Date(expiresAt).toISOString(),
        action,
        notify_days_before: Number(notifyDays) || 0,
      },
    });
    setSaving(false);
    if (res.ok) {
      toast.success(`Expiration set for ${formatDateTime(res.data?.expires_at)}`);
      fetchCurrent();
    } else {
      toast.error(res.message || "Could not set the expiration");
    }
  };

  const clear = async () => {
    setClearing(true);
    const res = await apiDelete(`/device/${encodeURIComponent(mobileId)}/expiration`);
    setClearing(false);
    setClearConfirm(false);
    if (res.ok) {
      toast.success("Expiration removed — the screen no longer expires");
      fetchCurrent();
    } else {
      toast.error(res.message || "Could not remove the expiration");
    }
  };

  return (
    <Card title="Expiration">
      {load.loading ? (
        <Skeleton height={64} />
      ) : load.error ? (
        <ErrorState
          message={`Couldn't load the current expiration — saving is disabled. ${load.error}`}
          onRetry={fetchCurrent}
        />
      ) : (
        <div style={{ display: "grid", gap: 12, maxWidth: 460 }}>
          {current ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Badge tone="warn">Expires {formatDateTime(current.scheduled_at)}</Badge>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Then: {actionLabel(current.action)}
                {current.notify_days_before != null && ` · notify ${current.notify_days_before} day(s) before`}
              </span>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              No expiration set — this screen runs indefinitely.
            </p>
          )}

          <Field label="Expires at" htmlFor={`${ids}-at`}>
            <Input
              id={`${ids}-at`}
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </Field>
          <Field label="When it expires" htmlFor={`${ids}-action`}>
            <Select
              id={`${ids}-action`}
              value={action}
              onChange={(e) => setAction(e.target.value)}
              options={ACTIONS}
            />
          </Field>
          <Field label="Notify days before" htmlFor={`${ids}-notify`} hint="0–30 days.">
            <Input
              id={`${ids}-notify`}
              type="number"
              min="0"
              max="30"
              value={notifyDays}
              onChange={(e) => setNotifyDays(e.target.value)}
              style={{ width: 120 }}
            />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={save} loading={saving} disabled={!expiresAt}>
              {current ? "Update expiration" : "Set expiration"}
            </Button>
            {current && (
              <Button variant="ghost" onClick={() => setClearConfirm(true)}>
                Remove expiration
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={clearConfirm}
        onClose={() => setClearConfirm(false)}
        onConfirm={clear}
        loading={clearing}
        title="Remove expiration"
        confirmLabel="Remove"
        message="Remove the expiration from this screen? It will keep running indefinitely and any scheduled expiration action is cancelled."
      />
    </Card>
  );
}
