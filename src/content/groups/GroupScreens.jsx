// The screens that belong to a group: list, add (device-to-group — the API
// also requires a Location), remove one, or unassign all.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MonitorPlay, Plus } from "lucide-react";
import Button from "../../ui/Button";
import Badge from "../../ui/Badge";
import Table from "../../ui/Table";
import Modal from "../../ui/Modal";
import ConfirmModal from "../../ui/ConfirmModal";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import { Field, Select } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import { apiGet, apiPost, normalizeList } from "../../lib/api";

export default function GroupScreens({ gname, attachments, loading, error, reload }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null); // device row
  const [unassignAll, setUnassignAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [locations, setLocations] = useState([]);
  const [pick, setPick] = useState({ mobile_id: "", shop_name: "" });
  const [addError, setAddError] = useState("");

  const members = useMemo(() => attachments?.devices || [], [attachments]);

  useEffect(() => {
    if (!adding) return;
    setAddError("");
    Promise.all([
      apiGet("/devices", { params: { limit: 500, offset: 0 } }),
      apiGet("/shops", { params: { limit: 1000, offset: 0 } }),
    ]).then(([d, s]) => {
      if (d.ok) {
        const memberIds = new Set(members.map((m) => m.mobile_id));
        setCandidates(normalizeList(d.data, "items").items.filter((x) => !memberIds.has(x.mobile_id)));
      } else setAddError(d.message);
      if (s.ok) setLocations(normalizeList(s.data, "items").items);
      else setAddError((prev) => prev || s.message);
    });
  }, [adding, members]);

  const add = async () => {
    setBusy(true);
    const res = await apiPost("/link/device-to-group", {
      mobile_id: pick.mobile_id,
      gname,
      shop_name: pick.shop_name,
    });
    setBusy(false);
    if (!res.ok) {
      setAddError(res.message);
      return;
    }
    toast.success(res.data?.message || `Screen added to ${gname} — it inherits the group playlist`);
    setAdding(false);
    setPick({ mobile_id: "", shop_name: "" });
    reload();
  };

  const remove = async () => {
    setBusy(true);
    const res = await apiPost(`/device/${encodeURIComponent(removing.mobile_id)}/unassign-from-group`);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`"${removing.device_name || removing.mobile_id}" removed — its content links were cleared`);
    setRemoving(null);
    reload();
  };

  const doUnassignAll = async () => {
    setBusy(true);
    const res = await apiPost(`/group/${encodeURIComponent(gname)}/unassign-devices`);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`${res.data?.unassigned_count ?? members.length} screens removed from ${gname}`);
    setUnassignAll(false);
    reload();
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <div className="u-between" style={{ marginBottom: 12 }}>
        <span className="u-muted">{members.length} screens inherit this group's playlist</span>
        <div className="u-flex">
          {members.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setUnassignAll(true)}>
              Unassign all
            </Button>
          )}
          <Link to={`/screens?add=1&group=${encodeURIComponent(gname)}`}>
            <Button size="sm" variant="secondary">Enroll new screen</Button>
          </Link>
          <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>
            Add screen
          </Button>
        </div>
      </div>

      <Table
        columns={[
          {
            key: "device_name",
            label: "Screen",
            render: (row) => (
              <Link to={`/screens/${encodeURIComponent(row.mobile_id)}`}>
                {row.device_name || "Unnamed screen"}
              </Link>
            ),
          },
          { key: "mobile_id", label: "Device ID", mono: true },
          {
            key: "actions",
            label: "",
            align: "right",
            render: (row) => (
              <Button variant="ghost" size="sm" onClick={() => setRemoving(row)}>
                Remove
              </Button>
            ),
          },
        ]}
        rows={members}
        rowKey={(r) => r.mobile_id}
        loading={loading}
        empty={
          <EmptyState
            icon={MonitorPlay}
            title="No screens in this group"
            hint="Add a screen so it starts playing this group's playlist."
            action={<Button icon={Plus} onClick={() => setAdding(true)}>Add screen</Button>}
          />
        }
      />

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={`Add a screen to ${gname}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
            <Button onClick={add} loading={busy} disabled={!pick.mobile_id || !pick.shop_name}>
              Add screen
            </Button>
          </>
        }
      >
        <Field label="Screen" required htmlFor="gs-screen">
          <Select
            id="gs-screen"
            value={pick.mobile_id}
            onChange={(e) => setPick({ ...pick, mobile_id: e.target.value })}
            placeholder="Select a screen…"
            options={candidates.map((c) => ({
              value: c.mobile_id,
              label: `${c.device_name || c.mobile_id}${c.group_name ? ` (now in ${c.group_name})` : ""}`,
            }))}
          />
        </Field>
        <Field label="Location" required hint="Where this screen is installed" htmlFor="gs-location">
          <Select
            id="gs-location"
            value={pick.shop_name}
            onChange={(e) => setPick({ ...pick, shop_name: e.target.value })}
            placeholder="Select a location…"
            options={locations.map((l) => ({ value: l.shop_name, label: l.shop_name }))}
          />
        </Field>
        <p className="u-faint">
          Moving a screen out of another group replaces its content with this group's playlist.
        </p>
        {addError && (
          <div role="alert" style={{ padding: 10, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 8 }}>
            {addError}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        title="Remove screen from group"
        message={`"${removing?.device_name || removing?.mobile_id}" stops playing this group's playlist and its content links are cleared.`}
        danger
        confirmLabel="Remove screen"
        loading={busy}
      />
      <ConfirmModal
        open={unassignAll}
        onClose={() => setUnassignAll(false)}
        onConfirm={doUnassignAll}
        title={`Unassign all ${members.length} screens`}
        message="Every screen leaves this group and stops playing its playlist. The group itself is kept."
        danger
        confirmLabel={`Unassign ${members.length} screens`}
        loading={busy}
      />
    </div>
  );
}
