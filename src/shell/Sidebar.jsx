// Brand-dark sidebar: permission-gated nav, live approvals badge, theme
// toggle, change-password, user block, logout.
import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, MonitorPlay, Layers, MapPin, Film, Link2, LayoutTemplate, CheckCircle2,
  BarChart3, UsersRound, Settings, Globe, Building2,
  Megaphone, Activity, ScrollText, Sun, Moon, KeyRound, LogOut,
} from "lucide-react";
import Badge from "../ui/Badge";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { wsClient } from "../lib/ws";
import { apiGet } from "../lib/api";
import "./shell.css";

const COMPANY_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/screens", label: "Screens", icon: MonitorPlay, perm: "manage_devices" },
  { to: "/groups", label: "Groups", icon: Layers, perm: "manage_groups" },
  { to: "/locations", label: "Locations", icon: MapPin, perm: "manage_shops" },
  { to: "/media", label: "Media", icon: Film, anyPerm: ["manage_videos", "upload_videos"] },
  { to: "/assign", label: "Assign content", icon: Link2, perm: "manage_links" },
  { to: "/template-content", label: "Template content", icon: LayoutTemplate, anyPerm: ["manage_company_settings", "manage_shops", "manage_devices"] },
  { to: "/approvals", label: "Approvals", icon: CheckCircle2, approvals: true },
  { to: "/reports", label: "Reports", icon: BarChart3, perm: "view_reports" },
  { to: "/team", label: "Team", icon: UsersRound, perm: "manage_users" },
  { to: "/settings", label: "Settings", icon: Settings },
];

const PLATFORM_NAV = [
  { to: "/platform", label: "Overview", icon: Globe, end: true },
  { to: "/platform/companies", label: "Companies", icon: Building2 },
  { to: "/platform/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/platform/announcements", label: "Announcements", icon: Megaphone },
  { to: "/platform/activity", label: "Activity", icon: Activity },
  { to: "/platform/audit", label: "Audit log", icon: ScrollText },
];

// Same gate as the legacy shell (App.js:462).
const APPROVER_ROLES = ["admin", "manager", "company_admin", "content_manager"];

function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0].toUpperCase()).join("") || "?";
}

export default function Sidebar({ open, onNavigate, onChangePassword }) {
  const { user, hasPermission, isPlatform, isImpersonating, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const [pending, setPending] = useState(0);

  const showCompany = !isPlatform || isImpersonating;
  const showPlatform = isPlatform && !isImpersonating;
  const canApprove = APPROVER_ROLES.includes(user?.role) || isPlatform;

  useEffect(() => {
    if (!showCompany || !canApprove) return undefined;
    let alive = true;
    apiGet("/content-changes", { params: { status: "pending", limit: 1 } }).then((res) => {
      if (alive && res.ok) setPending(Number(res.data?.pending_count) || 0);
    });
    const off = wsClient.on("pending_approvals", (d) => {
      setPending(Number(d?.pending_count) || 0);
    });
    return () => {
      alive = false;
      off();
    };
  }, [showCompany, canApprove]);

  const visible = (item) => {
    if (item.approvals) return canApprove;
    if (item.anyPerm) return item.anyPerm.some((p) => hasPermission(p));
    if (item.perm) return hasPermission(item.perm);
    return true;
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const renderItem = (item) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) => "ui-sidebar-link" + (isActive ? " is-active" : "")}
      >
        <Icon size={18} aria-hidden="true" />
        <span className="ui-sidebar-link-label">{item.label}</span>
        {item.approvals && pending > 0 ? <Badge tone="danger">{pending}</Badge> : null}
      </NavLink>
    );
  };

  return (
    <aside className={"ui-sidebar" + (open ? " is-open" : "")}>
      <div className="ui-sidebar-brand">
        <div className="ui-sidebar-wordmark">DIGIX</div>
        <div className="ui-sidebar-subtitle">Digital Signage</div>
      </div>
      <nav className="ui-sidebar-nav" aria-label="Main navigation">
        {showCompany && COMPANY_NAV.filter(visible).map(renderItem)}
        {showPlatform && PLATFORM_NAV.map(renderItem)}
      </nav>
      <div className="ui-sidebar-bottom">
        <button type="button" className="ui-sidebar-btn" onClick={toggle}>
          {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          <span>{isDark ? "Light mode" : "Dark mode"}</span>
        </button>
        <button type="button" className="ui-sidebar-btn" onClick={onChangePassword}>
          <KeyRound size={18} aria-hidden="true" />
          <span>Change password</span>
        </button>
        <div className="ui-sidebar-user">
          <span className="ui-sidebar-avatar" aria-hidden="true">
            {initialsOf(user?.full_name || user?.username)}
          </span>
          <span className="ui-sidebar-user-meta">
            <span className="ui-sidebar-user-name">{user?.full_name || user?.username}</span>
            <span className="ui-sidebar-user-role">{user?.role}</span>
          </span>
        </div>
        <button type="button" className="ui-sidebar-btn" onClick={handleLogout}>
          <LogOut size={18} aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
