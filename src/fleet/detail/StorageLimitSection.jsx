// Storage limit — PUT /device/{id}/storage/limit?limit_percent (50–95).
// The API has no read endpoint for the current limit, so the UI says so
// honestly instead of pretending a default is the stored value. The write
// touches only this one column, so saving can't clobber unrelated config.
import { useId, useState } from "react";
import { apiPut } from "../../lib/api";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import { Field } from "../../ui/Field";
import { useToast } from "../../ui/Toast";

export default function StorageLimitSection({ mobileId }) {
  const toast = useToast();
  const id = useId();
  const [percent, setPercent] = useState(80); // backend default
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await apiPut(`/device/${encodeURIComponent(mobileId)}/storage/limit`, undefined, {
      params: { limit_percent: percent },
    });
    setSaving(false);
    if (res.ok) toast.success(`Storage limit set to ${res.data?.storage_limit_percent ?? percent}%`);
    else toast.error(res.message || "Could not set the storage limit");
  };

  return (
    <Card title="Storage limit">
      <div style={{ display: "grid", gap: 12, maxWidth: 460 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          Caps how much of the screen's storage media downloads may use. The API doesn't report the
          currently stored limit (backend default is 80%); saving sets it to the value below.
        </p>
        <Field label={`Limit: ${percent}% of device storage`} htmlFor={id}>
          <input
            id={id}
            type="range"
            min="50"
            max="95"
            step="1"
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
        </Field>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-faint)" }}>
          <span>50%</span>
          <span>95%</span>
        </div>
        <div>
          <Button onClick={save} loading={saving}>
            Save storage limit
          </Button>
        </div>
      </div>
    </Card>
  );
}
