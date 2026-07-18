// Route table. Every page lives at a real URL (deep-linkable, refresh-safe).
// Legacy pages mount inside LegacyCard until their rebuild wave replaces them.
import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { RequireAuth, RequirePerm, RequirePlatform, PublicOnly } from "./shell/RouteGuards";
import AppShell from "./shell/AppShell";
import ErrorBoundary from "./shell/ErrorBoundary";
import CompanyBanners, { useCompanyExpiration } from "./shell/CompanyBanners";
import ChangePasswordModal from "./legacy/ChangePasswordModal";
import Login from "./pages/Login";
import PermissionDenied from "./pages/PermissionDenied";
import Dashboard from "./pages/Dashboard";
import Screens from "./pages/Screens";
import PendingScreensPage from "./pages/PendingScreens";
import ScreenDetail from "./pages/ScreenDetail";
import Media from "./pages/Media";
import TemplateContent from "./pages/TemplateContent";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import AssignContent from "./pages/AssignContent";
import Locations from "./pages/Locations";
import LocationDetail from "./pages/LocationDetail";
import Settings from "./pages/Settings";
import UserManagement from "./legacy/UserManagement";
import Reports from "./pages/Reports";
import Approvals from "./pages/Approvals";
import PlatformOverview from "./pages/PlatformOverview";
import PlatformCompanies from "./pages/PlatformCompanies";
import PlatformCompanyDetail from "./pages/PlatformCompanyDetail";
import PlatformTemplates from "./pages/PlatformTemplates";
import PlatformAnnouncements from "./pages/PlatformAnnouncements";
import PlatformActivity from "./pages/PlatformActivity";
import PlatformAudit from "./pages/PlatformAudit";
import { NotificationBell, CompanyStatusTimer } from "./components/ExpirationNotificationBanner";

// Shell + banner strip + header widgets + self-service password modal.
function ShellChrome() {
  const { isPlatform } = useAuth();
  const expiration = useCompanyExpiration();
  const [showChangePassword, setShowChangePassword] = useState(false);
  return (
    <>
      <AppShell
        banners={<CompanyBanners expiration={expiration} />}
        topExtras={
          !isPlatform && expiration ? (
            <>
              <CompanyStatusTimer companyStatus={expiration} />
              <NotificationBell companyStatus={expiration} />
            </>
          ) : null
        }
        onChangePassword={() => setShowChangePassword(true)}
      />
      <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </>
  );
}

function LegacyCard({ children, padded = true }) {
  return (
    <div
      className="legacy-page"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: padded ? 20 : 0,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

// "Any of" permission gate (RequirePerm handles the single-perm case).
function RequireAnyPerm({ perms, children }) {
  const { hasPermission } = useAuth();
  return perms.some((p) => hasPermission(p)) ? children : <PermissionDenied />;
}

// Approvals visibility: same gate the old sidebar used.
function RequireApprover({ children }) {
  const { user } = useAuth();
  const canApprove =
    ["admin", "manager", "company_admin", "content_manager"].includes(user?.role) ||
    user?.user_type === "platform";
  return canApprove ? children : <PermissionDenied />;
}

function HomeRedirect() {
  const { isPlatform, isImpersonating } = useAuth();
  if (isPlatform && !isImpersonating) return <Navigate to="/platform" replace />;
  return <Dashboard />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route
        element={
          <RequireAuth>
            <ShellChrome />
          </RequireAuth>
        }
      >
        <Route index element={<ErrorBoundary><HomeRedirect /></ErrorBoundary>} />
        <Route
          path="/screens"
          element={<ErrorBoundary><RequirePerm perm="manage_devices"><Screens /></RequirePerm></ErrorBoundary>}
        />
        <Route
          path="/screens/pending"
          element={<ErrorBoundary><RequirePerm perm="manage_devices"><PendingScreensPage /></RequirePerm></ErrorBoundary>}
        />
        <Route
          path="/screens/:mobileId"
          element={<ErrorBoundary><RequirePerm perm="manage_devices"><ScreenDetail /></RequirePerm></ErrorBoundary>}
        />
        <Route
          path="/groups"
          element={<ErrorBoundary><RequirePerm perm="manage_groups"><Groups /></RequirePerm></ErrorBoundary>}
        />
        <Route
          path="/groups/:gname"
          element={<ErrorBoundary><RequirePerm perm="manage_groups"><GroupDetail /></RequirePerm></ErrorBoundary>}
        />
        <Route
          path="/locations"
          element={<ErrorBoundary><RequirePerm perm="manage_shops"><Locations /></RequirePerm></ErrorBoundary>}
        />
        <Route
          path="/locations/:shopName"
          element={<ErrorBoundary><RequirePerm perm="manage_shops"><LocationDetail /></RequirePerm></ErrorBoundary>}
        />
        <Route
          path="/media"
          element={<ErrorBoundary><RequireAnyPerm perms={["manage_videos", "upload_videos"]}><Media /></RequireAnyPerm></ErrorBoundary>}
        />
        {/* Open to every company role: viewers browse read-only, editors submit
            changes for approval — the page + backend gate the writes. */}
        <Route
          path="/template-content"
          element={<ErrorBoundary><TemplateContent /></ErrorBoundary>}
        />
        <Route
          path="/assign"
          element={<ErrorBoundary><RequirePerm perm="manage_links"><AssignContent /></RequirePerm></ErrorBoundary>}
        />
        <Route
          path="/approvals"
          element={<ErrorBoundary><RequireApprover><Approvals /></RequireApprover></ErrorBoundary>}
        />
        <Route
          path="/reports"
          element={<ErrorBoundary><RequirePerm perm="view_reports"><Reports /></RequirePerm></ErrorBoundary>}
        />
        <Route
          path="/team"
          element={<ErrorBoundary><RequirePerm perm="manage_users"><LegacyCard><UserManagement /></LegacyCard></RequirePerm></ErrorBoundary>}
        />
        <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
        <Route
          path="/platform"
          element={<ErrorBoundary><RequirePlatform><PlatformOverview /></RequirePlatform></ErrorBoundary>}
        />
        <Route
          path="/platform/companies"
          element={<ErrorBoundary><RequirePlatform><PlatformCompanies /></RequirePlatform></ErrorBoundary>}
        />
        <Route
          path="/platform/companies/:slug"
          element={<ErrorBoundary><RequirePlatform><PlatformCompanyDetail /></RequirePlatform></ErrorBoundary>}
        />
        <Route
          path="/platform/templates"
          element={<ErrorBoundary><RequirePlatform><PlatformTemplates /></RequirePlatform></ErrorBoundary>}
        />
        <Route
          path="/platform/announcements"
          element={<ErrorBoundary><RequirePlatform><PlatformAnnouncements /></RequirePlatform></ErrorBoundary>}
        />
        <Route
          path="/platform/activity"
          element={<ErrorBoundary><RequirePlatform><PlatformActivity /></RequirePlatform></ErrorBoundary>}
        />
        <Route
          path="/platform/audit"
          element={<ErrorBoundary><RequirePlatform><PlatformAudit /></RequirePlatform></ErrorBoundary>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
