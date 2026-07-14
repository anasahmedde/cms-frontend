// Move an existing screen to this location. Screens keep their group (and
// its playlist) — only the physical location changes.
import { useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import { Field, Select } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import { apiGet, apiPost, normalizeList } from "../../lib/api";

export default function AssignScreensModal({ shopName, open, onClose, onAssigned }) {
  const toast = useToast();
  const [devices, setDevices] = useState([]);
  const [here, setHere] = useState([]);
  const [mobileId, setMobileId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setMobileId("");
    Promise.all([
      apiGet("/devices", { params: { limit: 500, offset: 0 } }),
      apiGet(`/shop/${encodeURIComponent(shopName)}/devices`),
    ]).then(([d, h]) => {
      if (d.ok) setDevices(normalizeList(d.data, "items").items);
      else setError(d.message);
      if (h.ok) {
        const rows = h.data?.devices || h.data?.items || h.data || [];
        setHere((Array.isArray(rows) ? rows : []).map((r) => r.mobile_id));
      }
    });
  }, [open, shopName]);

  const candidates = useMemo(
    () => devices.filter((d) => !here.includes(d.mobile_id)),
    [devices, here]
  );
  const selected = candidates.find((d) => d.mobile_id === mobileId);

  const assign = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    // A grouped screen moves location via the relink endpoint (keeps its
    // playlist); an ungrouped screen updates through the create/update upsert.
    const res = selected.group_name
      ? await apiPost("/link/device-to-group", {
          mobile_id: selected.mobile_id,
          gname: selected.group_name,
          shop_name: shopName,
        })
      : await apiPost("/device/create", {
          mobile_id: selected.mobile_id,
          device_name: selected.device_name || selected.mobile_id,
          shop_name: shopName,
        });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    toast.success(`"${selected.device_name || selected.mobile_id}" is now at ${shopName}`);
    onAssigned();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Move a screen to ${shopName}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={assign} loading={busy} disabled={!selected}>Move screen here</Button>
        </>
      }
    >
      <Field
        label="Screen"
        hint="It keeps its group and playlist — only the location changes"
        htmlFor="loc-assign-screen"
      >
        <Select
          id="loc-assign-screen"
          value={mobileId}
          onChange={(e) => setMobileId(e.target.value)}
          placeholder={candidates.length ? "Select a screen…" : "Every screen is already here"}
          options={candidates.map((d) => ({
            value: d.mobile_id,
            label: `${d.device_name || d.mobile_id}${d.group_name ? ` · ${d.group_name}` : " · Ungrouped"}`,
          }))}
        />
      </Field>
      {error && (
        <div role="alert" style={{ padding: 10, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 8 }}>
          {error}
        </div>
      )}
    </Modal>
  );
}
