// Screen detail — /screens/:mobileId?tab=overview|content|telemetry|settings.
// Thin composition: data hooks + header + tabs; everything else lives in
// src/fleet/detail/*.
import { useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Activity, LayoutGrid, MonitorX, Settings2, SlidersHorizontal } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useToast } from "../ui/Toast";
import Tabs from "../ui/Tabs";
import Button from "../ui/Button";
import Skeleton, { SkeletonText } from "../ui/Skeleton";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import { useScreenDevice, useScreenLinks } from "../fleet/detail/useScreenDevice";
import ScreenHeader from "../fleet/detail/ScreenHeader";
import OverviewTab from "../fleet/detail/OverviewTab";
import ContentTab from "../fleet/detail/ContentTab";
import TelemetryTab from "../fleet/detail/TelemetryTab";
import SettingsTab from "../fleet/detail/SettingsTab";
import PermissionDenied from "./PermissionDenied";

const TABS = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "content", label: "Content & Layout", icon: LayoutGrid },
  { key: "telemetry", label: "Telemetry", icon: SlidersHorizontal },
  { key: "settings", label: "Settings", icon: Settings2 },
];
const TAB_KEYS = new Set(TABS.map((t) => t.key));

export default function ScreenDetail() {
  const { mobileId } = useParams();
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab = TAB_KEYS.has(rawTab) ? rawTab : "overview";

  const { device, loading, error, notFound, reload, patch } = useScreenDevice(mobileId);
  const links = useScreenLinks(mobileId);

  // A failed background reload keeps the last good data but must still
  // surface — never silently show stale state as fresh.
  const toast = useToast();
  const deviceRef = useRef(device);
  deviceRef.current = device;
  useEffect(() => {
    if (error && deviceRef.current) toast.error(error, { retryLabel: "Retry", onRetry: reload });
  }, [error, toast, reload]);

  // Same gate the legacy Devices page lived behind (App.js manage_devices).
  if (!hasPermission("manage_devices")) return <PermissionDenied />;

  if (loading && !device) {
    return (
      <div>
        <Skeleton width={280} height={28} style={{ marginBottom: 12 }} />
        <Skeleton width={420} height={14} style={{ marginBottom: 24 }} />
        <SkeletonText lines={6} />
      </div>
    );
  }

  if (error && !device) {
    return <ErrorState message={error} onRetry={reload} />;
  }

  if (notFound) {
    return (
      <EmptyState
        icon={MonitorX}
        title="Screen not found"
        hint={`No screen with Device ID "${mobileId}" exists in this workspace.`}
        action={
          <Link to="/screens">
            <Button variant="secondary">Back to Screens</Button>
          </Link>
        }
      />
    );
  }

  if (!device) return null;

  const setTab = (key) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", key);
    setSearchParams(next);
  };

  const onChanged = () => {
    reload();
    links.reload();
  };

  return (
    <div>
      <ScreenHeader device={device} shopName={links.shopName} onPatched={patch} onChanged={onChanged} />

      <div style={{ marginBottom: 16 }}>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === "overview" && <OverviewTab device={device} shopName={links.shopName} />}
      {tab === "content" && (
        <ContentTab
          device={device}
          links={links.rows}
          linksLoading={links.loading}
          linksError={links.error}
          reloadLinks={links.reload}
          onDeviceReload={reload}
        />
      )}
      {tab === "telemetry" && <TelemetryTab device={device} />}
      {tab === "settings" && <SettingsTab device={device} onDeviceReload={reload} />}
    </div>
  );
}
