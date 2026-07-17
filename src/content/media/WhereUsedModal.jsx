// Where-used: the groups this item is assigned to, each linking to the group
// detail page (the cross-linking the legacy pages never had).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layers } from "lucide-react";
import Modal from "../../ui/Modal";
import Badge from "../../ui/Badge";
import ErrorState from "../../ui/ErrorState";
import EmptyState from "../../ui/EmptyState";
import { SkeletonText } from "../../ui/Skeleton";
import { apiGet } from "../../lib/api";
import { KINDS } from "./lib";

export default function WhereUsedModal({ open, item, onClose }) {
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !item) return;
    setGroups(null);
    setError("");
    apiGet(`${KINDS[item.kind].itemPath(item.name)}/groups`).then((res) => {
      if (res.ok) {
        const list = res.data?.groups || res.data?.items || res.data || [];
        setGroups(Array.isArray(list) ? list : []);
      } else {
        setError(res.message);
      }
    });
  }, [open, item]);

  if (!item) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Where "${item.name}" is used`} size="sm">
      {error ? (
        <ErrorState message={error} />
      ) : groups === null ? (
        <SkeletonText lines={3} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Not assigned to any group"
          hint="Assign it from a group's Playlist tab, or from Assign content."
        />
      ) : (
        <div className="u-flex" style={{ flexWrap: "wrap" }}>
          {groups.map((g) => {
            const gname = typeof g === "string" ? g : g.gname || g.name;
            return (
              <Link key={gname} to={`/groups/${encodeURIComponent(gname)}`} onClick={onClose}>
                <Badge tone="info">{gname}</Badge>
              </Link>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
