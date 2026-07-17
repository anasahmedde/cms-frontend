// Delete-location confirm with the 409 → force flow: a first DELETE that hits
// linked content re-opens the confirm showing the backend's linked counts, and
// only then retries with force=true. The legacy page never even checked the
// result of its window.confirm delete.
import { useEffect, useState } from "react";
import ConfirmModal from "../../ui/ConfirmModal";
import { useToast } from "../../ui/Toast";
import { deleteLocation } from "./lib";

export default function DeleteLocationModal({ shop, onClose, onDeleted }) {
  const toast = useToast();
  const [linked, setLinked] = useState(null); // 409 detail.linked counts
  const [busy, setBusy] = useState(false);

  // Reset the escalated state whenever a new target is picked.
  useEffect(() => {
    setLinked(null);
  }, [shop]);

  if (!shop) return null;
  const name = shop.shop_name;

  const confirm = async () => {
    setBusy(true);
    const res = await deleteLocation(name, !!linked);
    setBusy(false);
    if (res.ok) {
      const unlinked = res.data?.unlinked
        ? Object.values(res.data.unlinked).reduce((a, b) => a + Number(b || 0), 0)
        : 0;
      toast.success(
        `Location "${name}" deleted${unlinked ? ` (${unlinked} content links removed)` : ""}`
      );
      onDeleted(shop);
      onClose();
      return;
    }
    if (res.status === 409 && res.detail && typeof res.detail === "object" && res.detail.linked) {
      setLinked(res.detail.linked);
      return;
    }
    toast.error(res.message || "Could not delete the location");
  };

  return (
    <ConfirmModal
      open
      danger
      loading={busy}
      title={linked ? "Location still has linked content" : "Delete location"}
      message={
        linked
          ? `"${name}" is referenced by existing content links. Deleting it also removes those links.`
          : `Delete location "${name}"? Screens assigned to it are not deleted, but they lose this location label.`
      }
      linked={linked || undefined}
      confirmLabel={linked ? "Unlink and delete location" : "Delete location"}
      onClose={() => {
        if (!busy) onClose();
      }}
      onConfirm={confirm}
    />
  );
}
