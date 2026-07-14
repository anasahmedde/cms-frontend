// Company dashboard (interim): quick actions are now real navigation instead
// of the old modal copies of whole pages, above the legacy fleet table
// (RecentLinks). Replaced by the rebuilt Dashboard in the fleet wave.
import React from "react";
import { useNavigate } from "react-router-dom";
import { MonitorPlay, Film, Link2, BarChart3 } from "lucide-react";
import { useAuth } from "../lib/auth";
import StatCard from "../ui/StatCard";
import RecentLinks from "../components/RecentLinks";
import { useTheme } from "../lib/theme";

export default function DashboardLegacy() {
  const { hasPermission } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  return (
    <div>
      <div className="u-grid-cards" style={{ marginBottom: 20 }}>
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
      <div className="legacy-page" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <RecentLinks refreshKey={0} isDark={isDark} />
      </div>
    </div>
  );
}
