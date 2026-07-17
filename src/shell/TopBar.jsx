// Top bar: mobile hamburger, company name, impersonation chip, live
// connection dot, and an ISOLATED 1s clock (only Clock re-renders on tick).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Eye } from "lucide-react";
import Button from "../ui/Button";
import StatusDot from "../ui/StatusDot";
import { useToast } from "../ui/Toast";
import { useAuth } from "../lib/auth";
import { wsClient } from "../lib/ws";
import "./shell.css";

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="ui-topbar-clock">
      <span className="ui-topbar-time">{now.toLocaleTimeString()}</span>
      <span className="ui-topbar-date">
        {now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
      </span>
    </div>
  );
}

function ConnectionStatus() {
  const [connected, setConnected] = useState(() => wsClient.isConnected());
  useEffect(() => wsClient.on("connection", () => setConnected(wsClient.isConnected())), []);
  return (
    <StatusDot
      status={connected ? "online" : "offline"}
      label={connected ? "Live" : "Offline"}
      pulse={connected}
    />
  );
}

function tenantName(user) {
  if (user?.company?.name) return user.company.name;
  try {
    const t = JSON.parse(localStorage.getItem("digix_tenant") || "null");
    return t?.name || t?.slug || "company";
  } catch {
    return "company";
  }
}

export default function TopBar({ onToggleSidebar, sidebarOpen, extras }) {
  const { user, isImpersonating, stopImpersonate } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);

  const workspaceName = isImpersonating
    ? tenantName(user)
    : user?.company?.name || "Platform";

  const handleExit = async () => {
    setExiting(true);
    const res = await stopImpersonate();
    setExiting(false);
    if (res?.ok) navigate("/platform");
    else toast.error(res?.message || "Could not exit the workspace");
  };

  return (
    <header className="ui-topbar">
      <div className="ui-topbar-left">
        <button
          type="button"
          className="ui-topbar-burger"
          aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={!!sidebarOpen}
          onClick={onToggleSidebar}
        >
          <Menu size={18} aria-hidden="true" />
        </button>
        <span className="ui-topbar-company">{workspaceName}</span>
        {isImpersonating ? (
          <span className="ui-topbar-impersonate">
            <Eye size={16} aria-hidden="true" />
            <span>
              Viewing as <strong>{workspaceName}</strong>
            </span>
            <Button variant="secondary" size="sm" loading={exiting} onClick={handleExit}>
              Exit
            </Button>
          </span>
        ) : null}
      </div>
      <div className="ui-topbar-right">
        {extras}
        <ConnectionStatus />
        <Clock />
      </div>
    </header>
  );
}
