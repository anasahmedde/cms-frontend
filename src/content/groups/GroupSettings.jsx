// Group settings: rename + the guarded delete flows ported from Group.js
// (simple confirm when empty; device-aware modal with "unassign only" vs
// "unassign & delete"; 409 linked-resources force confirm).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import ConfirmModal from "../../ui/ConfirmModal";
import Modal from "../../ui/Modal";
import { Field, Input } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import { apiDelete, apiPost } from "../../lib/api";
import { renameGroup } from "./useGroupAttachments";

export default function GroupSettings({ gname, attachments, reload }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [newName, setNewName] = useState(gname);
  const [renaming, setRenaming] = useState(false);
  const [deleteStep, setDeleteStep] = useState(null); // 'simple' | 'devices' | {linked}
  const [busy, setBusy] = useState(false);

  const deviceCount = attachments?.device_count ?? attachments?.devices?.length ?? 0;
  const videoCount = attachments?.video_count ?? attachments?.videos?.length ?? 0;

  const rename = async () => {
    const name = newName.trim();
    if (!name || name === gname) return;
    setRenaming(true);
    const res = await renameGroup(gname, name);
    setRenaming(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`Group renamed to "${name}"`);
    navigate(`/groups/${encodeURIComponent(name)}?tab=settings`, { replace: true });
  };

  const doDelete = async (force) => {
    setBusy(true);
    const res = await apiDelete(`/group/${encodeURIComponent(gname)}?force=${force}`);
    setBusy(false);
    if (res.ok) {
      toast.success(`Group "${gname}" deleted`);
      navigate("/groups");
      return;
    }
    if (res.status === 409 && !force) {
      setDeleteStep({ linked: res.detail?.linked || res.detail || {} });
      return;
    }
    toast.error(res.message);
    setDeleteStep(null);
  };

  const unassignOnly = async () => {
    setBusy(true);
    const res = await apiPost(`/group/${encodeURIComponent(gname)}/unassign-devices`);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`${res.data?.unassigned_count ?? deviceCount} screens unassigned — the group is kept`);
    setDeleteStep(null);
    reload();
  };

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 640 }}>
      <Card title="Rename group">
        <Field label="Group name" hint="Screens keep their membership — only the name changes" htmlFor="grp-rename">
          <Input id="grp-rename" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </Field>
        <Button onClick={rename} loading={renaming} disabled={!newName.trim() || newName.trim() === gname}>
          Rename
        </Button>
      </Card>

      <Card title="Danger zone">
        <p className="u-muted" style={{ marginTop: 0 }}>
          Deleting a group stops its playlist on every member screen.
        </p>
        <Button
          variant="danger"
          onClick={() => setDeleteStep(deviceCount > 0 ? "devices" : "simple")}
        >
          Delete group
        </Button>
      </Card>

      <ConfirmModal
        open={deleteStep === "simple"}
        onClose={() => setDeleteStep(null)}
        onConfirm={() => doDelete(false)}
        title={`Delete "${gname}"`}
        message="No screens are in this group. Its playlist assignments will be removed."
        danger
        confirmLabel="Delete group"
        loading={busy}
      />

      <Modal
        open={deleteStep === "devices"}
        onClose={() => setDeleteStep(null)}
        title="This group still has screens"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteStep(null)} disabled={busy}>Cancel</Button>
            <Button variant="secondary" onClick={unassignOnly} loading={busy}>Unassign screens only</Button>
            <Button variant="danger" onClick={() => doDelete(true)} loading={busy}>Unassign & delete group</Button>
          </>
        }
      >
        <p>
          <strong>{deviceCount}</strong> screen{deviceCount === 1 ? "" : "s"} and{" "}
          <strong>{videoCount}</strong> playlist item{videoCount === 1 ? "" : "s"} are attached to
          this group.
        </p>
        <ul className="u-muted" style={{ paddingLeft: 18, margin: "8px 0 0" }}>
          <li><strong>Unassign screens only</strong> — removes the screens but keeps the group.</li>
          <li><strong>Unassign & delete</strong> — removes the screens and deletes the group.</li>
        </ul>
      </Modal>

      <ConfirmModal
        open={!!deleteStep?.linked}
        onClose={() => setDeleteStep(null)}
        onConfirm={() => doDelete(true)}
        title={`Force delete "${gname}"`}
        message="The group still has linked resources. Deleting unlinks everything listed below."
        danger
        confirmLabel="Unlink everything and delete"
        loading={busy}
        linked={deleteStep?.linked}
      />
    </div>
  );
}
