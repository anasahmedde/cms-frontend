// Company Dashboard — the fleet monitor that replaces the legacy RecentLinks
// table. Thin composition: data hooks + KPI tiles + alerts + filters + table.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MonitorPlay, Film, Link2, BarChart3, RefreshCw } from "lucide-react";
import { useAuth } from "../lib/auth";
import PageHeader from "../ui/PageHeader";
import StatCard from "../ui/StatCard";
import Button from "../ui/Button";
import { useFleetDevices, useDownloadProgress } from "../fleet/lib";
import useFleetLinks from "../fleet/dashboard/useFleetLinks";
import useDeviceLayouts from "../fleet/dashboard/useDeviceLayouts";
import FleetKpis from "../fleet/dashboard/FleetKpis";
import FleetFilters from "../fleet/dashboard/FleetFilters";
import FleetTable from "../fleet/dashboard/FleetTable";
import AlertsStrip from "../fleet/dashboard/AlertsStrip";
import "../fleet/dashboard/dashboard.css";


const REFRESH_MS = 30000;

function QuickActions() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="u-grid-cards" style={{ marginBottom: 16 }}>
      {hasPermission("manage_devices") && (
        <StatCard icon={MonitorPlay} label="Screens" value="Manage" hint="Enroll and configure screens" onClick={() => navigate("/screens")} />
      )}
      {(hasPermission("upload_videos") || hasPermission("manage_videos")) && (
        <StatCard icon={Film} label="Media" value="Library" hint="Upload videos and images" onClick={() => navigate("/media")} />
      )}
      {hasPermission("manage_links") && (
        <StatCard icon={Link2} label="Playlists" value="Assign" hint="Assign media to groups" onClick={() => navigate("/assign")} />
      )}
      {hasPermission("view_reports") && (
        <StatCard icon={BarChart3} label="Reports" value="Analytics" hint="Uptime, footfall, temperature" onClick={() => navigate("/reports")} />
      )}
    </div>
  );
}

export default function Dashboard() {
  const { devices, total, loading, error, reload } = useFleetDevices({ limit: 500 });
  const links = useFleetLinks();
  const [query, setQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const reloadLinks = links.reload;
  const reloadAll = useCallback(() => {
    reload();
    reloadLinks();
  }, [reload, reloadLinks]);

  // Auto-refresh every 30s; WS events keep status live in between.
  useEffect(() => {
    const id = setInterval(reloadAll, REFRESH_MS);
    return () => clearInterval(id);
  }, [reloadAll]);

  // Stamp "last updated" whenever a device load completes.
  const wasLoading = useRef(true);
  useEffect(() => {
    if (wasLoading.current && !loading) setLastUpdated(new Date());
    wasLoading.current = loading;
  }, [loading]);

  const activeDevices = useMemo(
    () => devices.filter((d) => d.is_active !== false),
    [devices]
  );
  const inactiveCount = devices.length - activeDevices.length;

  // Merge the per-screen link info (location, media, play counts) onto devices.
  const mergedRows = useMemo(() => {
    return activeDevices.map((d) => {
      const li = links.byMobileId[d.mobile_id];
      const gname = d.group_name || li?.gname || null;
      return {
        ...d,
        gname,
        ungrouped: !gname,
        location: li?.shop_name || null,
        links: li?.links || [],
        daily_count: li?.daily_count ?? null,
        monthly_count: li?.monthly_count ?? null,
        temperature: d.temperature ?? li?.temperature ?? null,
      };
    });
  }, [activeDevices, links.byMobileId]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return mergedRows
      .filter((r) => {
        if (!needle) return true;
        return (
          r.mobile_id.toLowerCase().includes(needle) ||
          (r.device_name || "").toLowerCase().includes(needle) ||
          (r.ungrouped ? "ungrouped" : r.gname || "").toLowerCase().includes(needle) ||
          (r.location || "").toLowerCase().includes(needle) ||
          r.links.some((l) => (l.video_name || "").toLowerCase().includes(needle))
        );
      })
      .sort((a, b) => {
        const byOnline = (b.is_online === true ? 1 : 0) - (a.is_online === true ? 1 : 0);
        if (byOnline !== 0) return byOnline;
        return (a.device_name || a.mobile_id).localeCompare(b.device_name || b.mobile_id);
      });
  }, [mergedRows, query]);

  const { progressByMobileId } = useDownloadProgress(filteredRows);

  const visibleIds = useMemo(() => filteredRows.map((r) => r.mobile_id), [filteredRows]);
  const { layouts, invalidate } = useDeviceLayouts(visibleIds);


  return (
    <div>
      <PageHeader
        title="Dashboard"
        actions={
          <span className="u-flex">
            {lastUpdated && (
              <span className="u-faint">Last updated {lastUpdated.toLocaleTimeString()}</span>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={loading || links.loading}
              onClick={reloadAll}
            >
              Refresh
            </Button>
          </span>
        }
      />

      <QuickActions />

      <AlertsStrip devices={activeDevices} />

      <FleetKpis
        devices={mergedRows}
        totalScreens={total}
        totals={links.totals}
        loadingDevices={loading && devices.length === 0}
        loadingLinks={links.loading}
      />

      {links.error && !loading && (
        <div className="fleet-alerts">
          <div className="fleet-alert fleet-alert--danger">
            <span>Couldn't load media assignments — locations and media details are missing.</span>
            <Button variant="ghost" size="sm" onClick={reloadLinks} style={{ marginLeft: "auto" }}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {error && devices.length > 0 && (
        <div className="fleet-alerts">
          <div className="fleet-alert fleet-alert--danger">
            <span>Refreshing the screen list failed — the table may be stale. ({error})</span>
            <Button variant="ghost" size="sm" onClick={reloadAll} style={{ marginLeft: "auto" }}>
              Retry
            </Button>
          </div>
        </div>
      )}

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
        <FleetFilters
          query={query}
          onChange={setQuery}
          onClear={() => setQuery("")}
          inactiveCount={inactiveCount}
          truncatedLinks={links.truncated}
          totalScreens={total}
          loadedScreens={devices.length}
        />
        <FleetTable
          rows={filteredRows}
          loading={loading}
          error={error}
          onRetry={reloadAll}
          layouts={layouts}
          invalidateLayout={invalidate}
          progressByMobileId={progressByMobileId}
          onChanged={reloadAll}
          filtersActive={!!query.trim()}
          onClearFilters={() => setQuery("")}
        />
      </div>
    </div>
  );
}
