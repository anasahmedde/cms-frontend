// Groups list: create (checked result), search, per-group counts, row → detail.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layers, Plus, Film, Image as ImageIcon, MonitorPlay } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Table from "../ui/Table";
import SearchInput from "../ui/SearchInput";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import Modal from "../ui/Modal";
import { Field, Input } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { apiGet, apiPost } from "../lib/api";
import { useGroups } from "../content/groups/useGroupAttachments";

const COUNTS_CAP = 30;

export default function Groups() {
  const toast = useToast();
  const { groups, loading, error, reload } = useGroups();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({});

  // Lazy per-group counts (legacy showed them only after expanding a row).
  useEffect(() => {
    let alive = true;
    const targets = groups.slice(0, COUNTS_CAP);
    targets.forEach(async (g) => {
      const res = await apiGet(`/group/${encodeURIComponent(g.gname)}/attachments`);
      if (alive && res.ok) {
        setCounts((prev) => ({
          ...prev,
          [g.gname]: {
            videos: res.data?.video_count ?? res.data?.videos?.length ?? 0,
            images: res.data?.advertisement_count ?? res.data?.advertisements?.length ?? 0,
            screens: res.data?.device_count ?? res.data?.devices?.length ?? 0,
          },
        }));
      }
    });
    return () => {
      alive = false;
    };
  }, [groups]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter((g) => g.gname.toLowerCase().includes(needle));
  }, [groups, q]);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setCreateError("");
    const res = await apiPost("/insert_group", { gname: name });
    setBusy(false);
    if (!res.ok) {
      setCreateError(res.message);
      return;
    }
    toast.success(`Group "${name}" created — assign a playlist and add screens next`);
    setCreating(false);
    setNewName("");
    reload();
  };

  const countCell = (g, key, Icon) => {
    const c = counts[g.gname];
    return c ? (
      <Badge tone="neutral">
        <Icon size={11} aria-hidden="true" /> {c[key]}
      </Badge>
    ) : (
      <span className="u-faint">…</span>
    );
  };

  return (
    <div>
      <PageHeader
        title="Groups"
        subtitle="Screens in a group share one playlist"
        actions={<Button icon={Plus} onClick={() => { setCreating(true); setCreateError(""); }}>New group</Button>}
      />
      <div style={{ maxWidth: 320, marginBottom: 14 }}>
        <SearchInput value={q} onChange={setQ} placeholder="Search groups…" />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <Table
          columns={[
            {
              key: "gname",
              label: "Group",
              render: (g) => <Link to={`/groups/${encodeURIComponent(g.gname)}`}>{g.gname}</Link>,
            },
            { key: "videos", label: "Videos", render: (g) => countCell(g, "videos", Film) },
            { key: "images", label: "Images", render: (g) => countCell(g, "images", ImageIcon) },
            { key: "screens", label: "Screens", render: (g) => countCell(g, "screens", MonitorPlay) },
            { key: "id", label: "ID", mono: true, width: 70 },
          ]}
          rows={filtered}
          rowKey={(g) => g.gname}
          loading={loading}
          empty={
            <EmptyState
              icon={Layers}
              title={q ? "No groups match your search" : "No groups yet"}
              hint={q ? "Try a different name." : "Create a group, give it a playlist, then add screens."}
              action={!q && <Button icon={Plus} onClick={() => setCreating(true)}>New group</Button>}
            />
          }
        />
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New group"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>Cancel</Button>
            <Button onClick={create} loading={busy} disabled={!newName.trim()}>Create group</Button>
          </>
        }
      >
        <Field label="Group name" required hint='e.g. "Lobby Screens" or "North Region"' htmlFor="grp-new-name">
          <Input
            id="grp-new-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
        </Field>
        {createError && (
          <div role="alert" style={{ padding: 10, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 8 }}>
            {createError}
          </div>
        )}
      </Modal>
    </div>
  );
}
