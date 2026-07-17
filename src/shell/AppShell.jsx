// Authenticated app frame: [sidebar | banners + top bar + routed page].
// Owns the single WebSocket connection lifecycle and page-view tracking.
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import SessionOverlays from "./SessionOverlays";
import { wsClient } from "../lib/ws";
import { getToken } from "../lib/api";
import usePageTracking from "../lib/usePageTracking";
import "./shell.css";

export default function AppShell({ banners, topExtras, onChangePassword }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  usePageTracking();

  useEffect(() => {
    const token = getToken();
    if (token) wsClient.connect(token);
    return () => wsClient.disconnect();
  }, []);

  // Off-canvas sidebar closes whenever the route changes (mobile).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="ui-shell">
      <Sidebar
        open={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
        onChangePassword={onChangePassword}
      />
      {sidebarOpen ? (
        <button
          type="button"
          className="ui-shell-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <div className="ui-shell-main">
        {banners ? <div className="ui-shell-banners">{banners}</div> : null}
        <TopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          extras={topExtras}
        />
        <main className="ui-shell-content">
          <Outlet />
        </main>
      </div>
      <SessionOverlays />
    </div>
  );
}
