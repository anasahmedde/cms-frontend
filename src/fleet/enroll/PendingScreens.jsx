// Pending screens: bulk-imported rows that have no Device ID yet, plus the
// on-site claim flow (installer reads the Device ID off the screen and binds
// it here). Reused by the /screens/pending page and the Bulk import modal.
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Hourglass } from "lucide-react";
import { apiGet, apiPost } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import Table from "../../ui/Table";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import CopyButton from "../../ui/CopyButton";
import ErrorState from "../../ui/ErrorState";
import EmptyState from "../../ui/EmptyState";
import { Field, Input } from "../../ui/Field";
import { useToast } from "../../ui/Toast";

// Shared fetch so the Screens page header badge counts the same list.
export async function fetchPendingScreens() {
  const res = await apiGet("/bulk-devices/pending");
  if (!res.ok) return { ok: false, message: res.message, items: [] };
  return { ok: true, items: res.data?.items || [] };
}

const DEVICE_ID_RE = /^[A-Za-z0-9._:-]{1,64}$/;

function ClaimModal({ item, onClose, onClaimed }) {
  const [mobileId, setMobileId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const claim = async () => {
    const mid = mobileId.trim();
    if (!mid) return setError("Enter the Device ID shown on the screen.");
    if (!DEVICE_ID_RE.test(mid)) return setError("That does not look like a Device ID (letters, digits, . _ : - only).");
    setBusy(true);
    setError("");
    const res = await apiPost("/bulk-devices/claim", { device_id: item.id, mobile_id: mid });
    setBusy(false);
    if (!res.ok) return setError(res.message); // 409 detail shown verbatim
    onClaimed(item, mid);
  };

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={`Claim "${item.device_name || "(unnamed)"}"`}
      size="sm"
      closeOnOverlay={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={claim} loading={busy} disabled={!mobileId.trim()}>Claim screen</Button>
        </>
      }
    >
      <p className="u-muted" style={{ marginTop: 0 }}>
        Activation code <span className="mono">{item.code}</span>
        {item.shop_name ? <> · {item.shop_name}</> : null}
      </p>
      <Field
        label="Device ID"
        required
        htmlFor="claim-device-id"
        error={error}
        hint="The installer reads it off the screen — the player shows the Device ID with a Copy button until the screen is enrolled."
      >
        <Input
          id="claim-device-id"
          className="mono"
          autoFocus
          value={mobileId}
          onChange={(e) => { setMobileId(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter" && mobileId.trim() && !busy) claim(); }}
          placeholder="e.g. c5c64c89008c530e"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
    </Modal>
  );
}

export default function PendingScreens({ onChanged }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(null); // pending row being claimed

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetchPendingScreens();
    if (!res.ok) setError(res.message || "Could not load pending screens");
    else setItems(res.items);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClaimed = (item, mobileId) => {
    setClaiming(null);
    toast.success(`Claimed "${item.device_name || "(unnamed)"}" → ${mobileId}. It will come online shortly.`);
    load();
    onChanged?.();
  };

  const columns = [
    {
      key: "device_name",
      label: "Screen",
      render: (d) => d.device_name || <span className="u-faint">(unnamed)</span>,
    },
    {
      key: "code",
      label: "Activation code",
      render: (d) => (
        <span className="u-flex u-nowrap">
          <span className="mono" style={{ fontSize: 12 }}>{d.code}</span>
          <CopyButton value={d.code} small />
        </span>
      ),
    },
    {
      key: "shop_name",
      label: "Location",
      render: (d) =>
        d.shop_name ? (
          // TODO: point at /locations/{shop_name} once the detail route ships (next wave).
          <Link to={`/locations?q=${encodeURIComponent(d.shop_name)}`}>{d.shop_name}</Link>
        ) : ("—"),
    },
    {
      key: "group_name",
      label: "Group",
      render: (d) =>
        d.group_name ? (
          // TODO: point at /groups/{gname} once the detail route ships (next wave).
          <Link to={`/groups?q=${encodeURIComponent(d.group_name)}`}>{d.group_name}</Link>
        ) : (<Badge tone="warn">Ungrouped</Badge>),
    },
    { key: "created_at", label: "Created", render: (d) => formatDateTime(d.created_at) },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (d) => (
        <Button size="sm" variant="secondary" onClick={() => setClaiming(d)}>Claim</Button>
      ),
    },
  ];

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <>
      <Table
        columns={columns}
        rows={items}
        rowKey="id"
        loading={loading}
        empty={
          <EmptyState
            icon={Hourglass}
            title="No pending screens"
            hint="Screens imported without a Device ID appear here until an installer claims them on site."
          />
        }
      />
      {claiming && (
        <ClaimModal item={claiming} onClose={() => setClaiming(null)} onClaimed={handleClaimed} />
      )}
    </>
  );
}
