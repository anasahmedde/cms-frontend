// Screens list — server-paginated fleet table (rebuilt legacy Device.js list
// half). Search + ?status/?group/?q URL filters, Active/Inactive tabs, live
// WS status patching, Add-screen wizard, bulk import, pending-claim entry,
// delete with 409 linked-counts force flow. Config/edit lives on the detail page.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MonitorPlay, Plus, RefreshCw, Trash2, Upload, Hourglass, X } from "lucide-react";
import { apiGet, apiDelete, normalizeList } from "../lib/api";
import { timeAgo } from "../lib/format";
import { wsClient } from "../lib/ws";
import { contentStatusBadge, deviceStatus } from "../fleet/lib";
import AddScreenWizard from "../fleet/enroll/AddScreenWizard";
import BulkImport from "../fleet/enroll/BulkImport";
import { fetchPendingScreens } from "../fleet/enroll/PendingScreens";
import PageHeader from "../ui/PageHeader";
import Table from "../ui/Table";
import Tabs from "../ui/Tabs";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import StatusDot from "../ui/StatusDot";
import CopyButton from "../ui/CopyButton";
import SearchInput from "../ui/SearchInput";
import Pagination from "../ui/Pagination";
import ConfirmModal from "../ui/ConfirmModal";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import { Select } from "../ui/Field";
import { useToast } from "../ui/Toast";

const PAGE_SIZES = [10, 20, 50, 100];
const stop = (e) => e.stopPropagation();

// Entity chips are links (THE linkage fix). TODO: point group/location chips
// at /groups/{gname} and /locations/{id} once those detail routes ship (next wave).
function ChipLink({ to, children }) {
  return (
    <Link to={to} onClick={stop} onKeyDown={stop} className="ui-badge ui-badge--info" style={{ textDecoration: "none" }}>
      {children}
    </Link>
  );
}

function ResolutionCell({ d }) {
  const reported = d.reported_resolution;
  if (d.resolution) {
    return (
      <span className="u-flex u-nowrap">
        <span className="mono" style={{ fontSize: 12 }}>{d.resolution}</span>
        {reported && reported !== d.resolution && <Badge tone="warn">reports {reported}</Badge>}
      </span>
    );
  }
  if (reported) {
    return (
      <span className="u-flex u-nowrap">
        <span className="mono" style={{ fontSize: 12 }}>{reported}</span>
        <Badge tone="info">auto</Badge>
      </span>
    );
  }
  return <span className="u-faint">Auto</span>;
}

function buildColumns(onDelete) {
  return [
    {
      key: "device_name", label: "Screen",
      render: (d) => (
        <Link to={`/screens/${encodeURIComponent(d.mobile_id)}`} onClick={stop} onKeyDown={stop} style={{ fontWeight: 600 }}>
          {d.device_name || <span className="u-faint" style={{ fontStyle: "italic" }}>No name yet</span>}
        </Link>
      ),
    },
    {
      key: "mobile_id", label: "Device ID",
      render: (d) => (
        <span className="u-flex u-nowrap" onClick={stop} onKeyDown={stop}>
          <span className="mono" style={{ fontSize: 12 }}>{d.mobile_id}</span>
          <CopyButton value={d.mobile_id} small />
        </span>
      ),
    },
    {
      key: "status", label: "Status",
      render: (d) => {
        const st = deviceStatus(d);
        return (
          <div className="u-nowrap">
            <StatusDot status={st} label={st === "online" ? "Online" : "Offline"} />
            <div className="u-faint">
              {timeAgo(d.last_online_at || d.last_seen_at || d.updated_at)}
              {d.temperature != null && ` · ${Number(d.temperature).toFixed(1)}°C`}
            </div>
          </div>
        );
      },
    },
    { key: "resolution", label: "Resolution", render: (d) => <ResolutionCell d={d} /> },
    {
      key: "app_version", label: "Version",
      render: (d) => (d.app_version ? <Badge tone="neutral">{d.app_version}</Badge> : "—"),
    },
    {
      key: "shop_name", label: "Location",
      render: (d) => (d.shop_name ? <ChipLink to={`/locations?q=${encodeURIComponent(d.shop_name)}`}>{d.shop_name}</ChipLink> : "—"),
    },
    {
      key: "group_name", label: "Group",
      render: (d) =>
        d.group_name
          ? <ChipLink to={`/groups?q=${encodeURIComponent(d.group_name)}`}>{d.group_name}</ChipLink>
          : <Badge tone="warn">Ungrouped</Badge>,
    },
    {
      key: "content", label: "Content",
      render: (d) => {
        const b = contentStatusBadge(d);
        const n = Number(d.video_count || 0);
        return (
          <span className="u-flex u-nowrap">
            <Badge tone={b.tone}>{b.label}</Badge>
            {n > 0 && <span className="u-faint">{n} video{n === 1 ? "" : "s"}</span>}
          </span>
        );
      },
    },
    {
      key: "actions", label: "", align: "right",
      render: (d) => (
        <span onClick={stop} onKeyDown={stop}>
          <IconButton
            label={`Delete screen ${d.device_name || d.mobile_id}`}
            icon={Trash2}
            variant="danger"
            size="sm"
            onClick={() => onDelete(d)}
          />
        </span>
      ),
    },
  ];
}

export default function Screens() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const statusFilter = searchParams.get("status") || "";
  const groupFilter = searchParams.get("group") || "";

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [tab, setTab] = useState("active");
  const [pendingCount, setPendingCount] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [del, setDel] = useState(null); // { row, linked }
  const [delBusy, setDelBusy] = useState(false);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = { limit: pageSize, offset: (page - 1) * pageSize };
    if (q) params.q = q;
    const res = await apiGet("/devices", { params });
    if (!res.ok) { setError(res.message); setLoading(false); return; }
    const norm = normalizeList(res.data, "items");
    const pages = Math.max(1, Math.ceil(norm.total / pageSize));
    if (page > pages && norm.total > 0) { setPage(pages); return; } // out-of-range after deletions
    setItems(norm.items);
    setTotal(norm.total);
    setLoading(false);
  }, [page, pageSize, q]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q]); // new search (typed or deep-linked) restarts at page 1

  const loadPending = useCallback(async () => {
    const res = await fetchPendingScreens();
    setPendingCount(res.ok ? res.items.length : null); // null = count unknown
  }, []);
  useEffect(() => { loadPending(); }, [loadPending]);

  // Live status patching from the fleet WebSocket.
  useEffect(() => {
    const patch = (mid, fields) =>
      setItems((list) => list.map((d) => (d.mobile_id === mid ? { ...d, ...fields } : d)));
    const offs = [
      wsClient.on("device_online", (m) => m?.mobile_id && patch(m.mobile_id, { is_online: true, last_online_at: new Date().toISOString() })),
      wsClient.on("device_offline", (m) => m?.mobile_id && patch(m.mobile_id, { is_online: false })),
      wsClient.on("device_temperature", (m) => m?.mobile_id && patch(m.mobile_id, { temperature: m.temperature })),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const activeCount = items.filter((d) => d.is_active !== false).length;
  const visible = useMemo(
    () =>
      items
        .filter((d) => (tab === "active" ? d.is_active !== false : d.is_active === false))
        .filter((d) => !statusFilter || deviceStatus(d) === statusFilter)
        .filter((d) => !groupFilter || (groupFilter === "Ungrouped" ? !d.group_name : d.group_name === groupFilter)),
    [items, tab, statusFilter, groupFilter]
  );
  const hasFilters = !!(q || statusFilter || groupFilter);

  const confirmDelete = async () => {
    const { row, linked } = del;
    setDelBusy(true);
    const res = await apiDelete(`/device/${encodeURIComponent(row.mobile_id)}${linked ? "?force=true" : ""}`);
    setDelBusy(false);
    if (res.ok) {
      const unlinked = res.data?.unlinked
        ? Object.values(res.data.unlinked).reduce((a, b) => a + Number(b || 0), 0) : 0;
      toast.success(`Screen "${row.device_name || row.mobile_id}" deleted${unlinked ? ` (${unlinked} linked records removed)` : ""}`);
      setDel(null);
      load();
      return;
    }
    if (res.status === 409 && res.detail && typeof res.detail === "object") {
      // Modern shape {linked:{...}}; legacy shape {recent_links, linked_count} mapped to one count.
      const linkedCounts = res.detail.linked
        || (res.detail.recent_links ? { content_links: res.detail.linked_count || res.detail.recent_links.length } : null);
      if (linkedCounts) { setDel({ row, linked: linkedCounts }); return; }
    }
    toast.error(res.message || "Could not delete the screen");
  };

  const columns = useMemo(() => buildColumns((row) => setDel({ row, linked: null })), []);
  const delName = del?.row ? del.row.device_name || del.row.mobile_id : "";

  return (
    <div>
      <PageHeader
        title="Screens"
        subtitle={loading && total === 0 ? "Loading your fleet…" : `${total} screen${total === 1 ? "" : "s"} enrolled`}
        actions={
          <>
            {(pendingCount === null || pendingCount > 0) && (
              <Button variant="secondary" icon={Hourglass} onClick={() => navigate("/screens/pending")}>
                {pendingCount === null ? "Pending screens" : `${pendingCount} pending`}
              </Button>
            )}
            <Button variant="secondary" icon={RefreshCw} onClick={load} disabled={loading}>Refresh</Button>
            <Button variant="secondary" icon={Upload} onClick={() => setBulkOpen(true)}>Bulk import</Button>
            <Button icon={Plus} onClick={() => setWizardOpen(true)}>Add screen</Button>
          </>
        }
      />

      <div className="u-flex" style={{ flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: "1 1 260px", maxWidth: 400 }}>
          <SearchInput
            value={q}
            onChange={(next) => { setParam("q", next); setPage(1); }}
            placeholder="Search by name or Device ID"
          />
        </div>
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setParam("status", e.target.value)}
          style={{ width: 150 }}
          options={[{ value: "online", label: "Online" }, { value: "offline", label: "Offline" }]}
          placeholder="All statuses"
        />
        {groupFilter && (
          <Badge tone="accent">
            <span className="u-flex">
              Group: {groupFilter}
              <button type="button" aria-label={`Clear group filter ${groupFilter}`} onClick={() => setParam("group", "")}
                style={{ border: "none", background: "none", color: "inherit", cursor: "pointer", display: "flex", padding: 0 }}>
                <X size={12} />
              </button>
            </span>
          </Badge>
        )}
      </div>

      <Tabs
        tabs={[
          { key: "active", label: "Active", badge: loading ? undefined : activeCount },
          { key: "inactive", label: "Inactive", badge: loading ? undefined : items.length - activeCount },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <Table
            columns={columns}
            rows={visible}
            rowKey="mobile_id"
            loading={loading}
            stickyHeader
            onRowClick={(d) => navigate(`/screens/${encodeURIComponent(d.mobile_id)}`)}
            empty={
              total === 0 && !hasFilters ? (
                <EmptyState
                  icon={MonitorPlay}
                  title="No screens yet"
                  hint="Enroll your first screen — paste the Device ID shown on the player."
                  action={<Button icon={Plus} onClick={() => setWizardOpen(true)}>Add screen</Button>}
                />
              ) : (
                <EmptyState
                  icon={MonitorPlay}
                  title={tab === "active" ? "No active screens match" : "No inactive screens match"}
                  hint={hasFilters ? "Try clearing the search or filters." : "Screens you deactivate appear on the Inactive tab."}
                  action={hasFilters ? <Button variant="secondary" onClick={() => { setSearchParams({}, { replace: true }); setPage(1); }}>Clear filters</Button> : undefined}
                />
              )
            }
          />
          <div className="u-between" style={{ marginTop: 12, flexWrap: "wrap", gap: 10 }}>
            <span className="u-flex u-muted">
              <label htmlFor="screens-page-size">Rows:</label>
              <Select
                id="screens-page-size"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                style={{ width: 84 }}
                options={PAGE_SIZES.map((n) => ({ value: n, label: String(n) }))}
              />
            </span>
            <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
          </div>
        </>
      )}

      <AddScreenWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCreated={() => { load(); loadPending(); }} />
      {bulkOpen && (
        <BulkImport open onClose={() => setBulkOpen(false)} onImported={() => { load(); loadPending(); }} />
      )}
      <ConfirmModal
        open={!!del}
        danger
        loading={delBusy}
        title={del?.linked ? "Screen still has linked content" : "Delete screen"}
        message={
          del?.linked
            ? `"${delName}" is linked to existing content. Deleting it will also remove those links.`
            : `Delete screen "${delName}"? The player returns to its enrollment screen and its assignments are removed.`
        }
        linked={del?.linked || undefined}
        confirmLabel={del?.linked ? "Delete screen and links" : "Delete screen"}
        onClose={() => { if (!delBusy) setDel(null); }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
