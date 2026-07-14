// Route table. Every page lives at a real URL (deep-linkable, refresh-safe).
// Legacy pages mount inside LegacyCard until their rebuild wave replaces them.
import React, { useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
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
import MediaLegacy from "./pages/MediaLegacy";
import Settings from "./pages/Settings";
import UserManagement from "./legacy/UserManagement";
import Group from "./components/Group";
import Shop from "./components/Shop";
import GroupLinkedVideo from "./components/GroupLinkedVideo";
import Reports from "./components/Reports";
import ContentApprovalQueue from "./components/ContentApprovalQueue";
import PlatformAdmin from "./components/PlatformAdmin";
import PlatformDashboard from "./components/PlatformDashboard";
import { NotificationBell, CompanyStatusTimer } from "./components/ExpirationNotificationBanner";
import { useToast } from "./ui/Toast";

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

function CompaniesPage() {
  const { impersonate } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const handleImpersonate = async (slug, name) => {
    const res = await impersonate(slug, name);
    if (res.ok) navigate("/");
    else toast.error(res.message || "Could not open the company workspace");
  };
  return (
    <LegacyCard>
      <PlatformAdmin onImpersonate={handleImpersonate} />
    </LegacyCard>
  );
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
          element={<ErrorBoundary><RequirePerm perm="manage_groups"><LegacyCard><Group /></LegacyCard></RequirePerm></ErrorBoundary>}
        />
        <Route
          path="/locations"
          element={<ErrorBoundary><RequirePerm perm="manage_shops"><LegacyCard><Shop /></LegacyCard></RequirePerm></ErrorBoundary>}
        />
        <Route
          path="/media"
          element={<ErrorBoundary><RequireAnyPerm perms={["manage_videos", "upload_videos"]}><MediaLegacy /></RequireAnyPerm></ErrorBoundary>}
        />
        <Route
          path="/assign"
          element={<ErrorBoundary><RequirePerm perm="manage_links"><LegacyCard><GroupLinkedVideo onDone={() => {}} /></LegacyCard></RequirePerm></ErrorBoundary>}
        />
        <Route
          path="/approvals"
          element={<ErrorBoundary><RequireApprover><ContentApprovalQueue onApprovalAction={() => {}} /></RequireApprover></ErrorBoundary>}
        />
        <Route
          path="/reports"
          element={<ErrorBoundary><RequirePerm perm="view_reports"><div className="legacy-page"><Reports /></div></RequirePerm></ErrorBoundary>}
        />
        <Route
          path="/team"
          element={<ErrorBoundary><RequirePerm perm="manage_users"><LegacyCard><UserManagement /></LegacyCard></RequirePerm></ErrorBoundary>}
        />
        <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
        <Route
          path="/platform"
          element={<ErrorBoundary><RequirePlatform><LegacyCard><PlatformDashboard /></LegacyCard></RequirePlatform></ErrorBoundary>}
        />
        <Route
          path="/platform/companies"
          element={<ErrorBoundary><RequirePlatform><CompaniesPage /></RequirePlatform></ErrorBoundary>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
