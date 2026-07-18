// KPI tiles: fleet health (each clicks through to a pre-filtered Screens
// list) plus entity totals. Counts are over ACTIVE screens — inactive ones
// are hidden from the fleet table and called out separately in the filters.
import { useNavigate } from "react-router-dom";
import { Wifi, WifiOff, RefreshCw, Unlink } from "lucide-react";
import StatCard from "../../ui/StatCard";
import { deviceStatus } from "../lib";
import "./dashboard.css";

export default function FleetKpis({
  devices, // active screens (already filtered)
  loadingDevices,
}) {
  const navigate = useNavigate();

  const online = devices.filter((d) => deviceStatus(d) === "online").length;
  const offline = devices.length - online;
  const syncing = devices.filter((d) => d.content_status === "syncing").length;
  const ungrouped = devices.filter((d) => d.ungrouped).length;

  return (
    <>
      <div className="fleet-kpis">
        <StatCard
          icon={Wifi}
          label="Online"
          value={online}
          hint="screens live now"
          tone="success"
          loading={loadingDevices}
          onClick={() => navigate("/screens?status=online")}
        />
        <StatCard
          icon={WifiOff}
          label="Offline"
          value={offline}
          hint="screens unreachable"
          tone="danger"
          loading={loadingDevices}
          onClick={() => navigate("/screens?status=offline")}
        />
        <StatCard
          icon={RefreshCw}
          label="Syncing"
          value={syncing}
          hint="downloading media"
          tone="info"
          loading={loadingDevices}
          onClick={() => navigate("/screens?status=syncing")}
        />
        <StatCard
          icon={Unlink}
          label="Ungrouped"
          value={ungrouped}
          hint="not in any group"
          tone="warn"
          loading={loadingDevices}
          onClick={() => navigate("/screens?group=ungrouped")}
        />
      </div>
    </>
  );
}
