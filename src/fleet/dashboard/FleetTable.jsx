// Fleet table: one row per active screen, expandable to its per-media link
// rows, with all row actions (preview / layout / rename / telemetry link /
// unassign / remove media) orchestrated here.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MonitorPlay, FilterX } from "lucide-react";
import Modal from "../../ui/Modal";
import ConfirmModal from "../../ui/ConfirmModal";
import ErrorState from "../../ui/ErrorState";
import EmptyState from "../../ui/EmptyState";
import Button from "../../ui/Button";
import Skeleton from "../../ui/Skeleton";
import { useToast } from "../../ui/Toast";
import { apiDelete, apiPost } from "../../lib/api";
import LayoutEditor from "../LayoutEditor";
import FleetRow from "./FleetRow";
import LinkRows from "./LinkRows";
import PreviewModal from "./PreviewModal";
import RenameModal from "./RenameModal";
import "./dashboard.css";

const HEADERS = ["", "Screen", "Group", "Location", "Layout", "Playing", "Telemetry", "Actions"];

export default function FleetTable({
  rows,
  loading,
  error,
  onRetry,
  layouts,
  invalidateLayout,
  progressByMobileId,
  onChanged,
  filtersActive,
  onClearFilters,
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [expanded, setExpanded] = useState(() => new Set());
  const [modal, setModal] = useState(null); // { type, row }
  const [busy, setBusy] = useState(false);

  const toggleExpand = (mobileId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(mobileId)) next.delete(mobileId);
      else next.add(mobileId);
      return next;
    });
  };

  const handleAction = (type, row) => {
    if (type === "telemetry") {
      navigate(`/screens/${encodeURIComponent(row.mobile_id)}?tab=telemetry`);
      return;
    }
    setModal({ type, row });
  };

  const close = () => setModal(null);

  const deleteAllLinks = async () => {
    const row = modal.row;
    setBusy(true);
    const results = await Promise.all(row.links.map((l) => apiDelete(`/link/${l.id}`)));
    setBusy(false);
    const failed = results.filter((r) => !r.ok).length;
    if (failed > 0) {
      toast.error(
        `Removed ${results.length - failed} of ${results.length} media assignments — ${failed} failed. Refresh and try again.`
      );
    } else {
      toast.success(`Removed ${results.length} media assignment${results.length === 1 ? "" : "s"} from "${row.device_name || row.mobile_id}"`);
    }
    close();
    onChanged();
  };

  const unassign = async () => {
    const row = modal.row;
    setBusy(true);
    const res = await apiPost(`/device/${encodeURIComponent(row.mobile_id)}/unassign-from-group`);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message || "Could not unassign the screen");
      return;
    }
    toast.success(res.data?.message || "Screen unassigned from its group");
    close();
    invalidateLayout(row.mobile_id); // layout was cleared server-side
    onChanged();
  };

  if (error && rows.length === 0 && !loading) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  return (
    <>
      <div className="u-scroll-x ui-table-wrap fleet-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              {HEADERS.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              Array.from({ length: 6 }, (_, i) => (
                <tr key={`sk-${i}`} aria-hidden="true">
                  {HEADERS.map((_, j) => (
                    <td key={j}>
                      <Skeleton width={j % 2 ? "55%" : "75%"} height={12} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td className="ui-table-empty" colSpan={HEADERS.length}>
                  {filtersActive ? (
                    <EmptyState
                      icon={FilterX}
                      title="No screens match your filters"
                      action={
                        <Button variant="secondary" size="sm" onClick={onClearFilters}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={MonitorPlay}
                      title="No screens yet"
                      hint="Enroll your first screen to start monitoring your fleet."
                      action={
                        <Button size="sm" onClick={() => navigate("/screens")}>
                          Add a screen
                        </Button>
                      }
                    />
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <FleetRowWithExpansion
                  key={row.mobile_id}
                  row={row}
                  layout={layouts[row.mobile_id]}
                  progress={progressByMobileId[row.mobile_id]}
                  expanded={expanded.has(row.mobile_id)}
                  onToggleExpand={toggleExpand}
                  onAction={handleAction}
                  onChanged={onChanged}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <PreviewModal open={modal?.type === "preview"} row={modal?.row} onClose={close} />

      <RenameModal
        open={modal?.type === "rename"}
        row={modal?.row}
        onClose={close}
        onSaved={() => {
          close();
          onChanged();
        }}
      />

      {modal?.type === "layout" && (
        <Modal open onClose={close} title={`Edit layout — ${modal.row.device_name || modal.row.mobile_id}`} size="xl">
          <LayoutEditor
            mobileId={modal.row.mobile_id}
            gname={modal.row.ungrouped ? null : modal.row.gname}
            onSaved={() => {
              close();
              invalidateLayout(modal.row.mobile_id);
              onChanged();
            }}
            onClose={close}
          />
        </Modal>
      )}

      <ConfirmModal
        open={modal?.type === "deleteLinks"}
        onClose={close}
        onConfirm={deleteAllLinks}
        title="Remove assigned media"
        message={`Remove all assigned media from "${modal?.row?.device_name || modal?.row?.mobile_id || ""}"? The screen will stop playing this content after its next sync.`}
        danger
        confirmLabel={`Remove ${modal?.row?.links.length || 0} assignment${modal?.row?.links.length === 1 ? "" : "s"}`}
        loading={busy}
        linked={{ media_assignments: modal?.row?.links.length || 0 }}
      />

      <ConfirmModal
        open={modal?.type === "unassign"}
        onClose={close}
        onConfirm={unassign}
        title="Unassign from group"
        message={`Remove "${modal?.row?.device_name || modal?.row?.mobile_id || ""}" from group "${modal?.row?.gname || ""}"? Its media assignments and layout are cleared, and the screen stops playing content until it is assigned to a group again.`}
        danger
        confirmLabel="Unassign screen"
        loading={busy}
        linked={{ media_assignments: modal?.row?.links.length || 0 }}
      />
    </>
  );
}

// Row + its expansion panel (kept together so the <tr> pair stays adjacent).
function FleetRowWithExpansion({ row, expanded, onChanged, ...rest }) {
  return (
    <>
      <FleetRow row={row} expanded={expanded} {...rest} />
      {expanded && (
        <tr className="fleet-expanded">
          <td colSpan={HEADERS.length}>
            <LinkRows
              mobileId={row.mobile_id}
              templateLinked={!!row.template_linked}
              onChanged={onChanged}
            />
          </td>
        </tr>
      )}
    </>
  );
}
