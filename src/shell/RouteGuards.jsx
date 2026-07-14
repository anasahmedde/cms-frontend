// Route guards. Each accepts children (or renders <Outlet/> when used as a
// layout route element).
import { Navigate, Outlet, useLocation } from "react-router-dom";
import Spinner from "../ui/Spinner";
import { useAuth } from "../lib/auth";
import PermissionDenied from "../pages/PermissionDenied";
import "./shell.css";

function CenteredLoading() {
  return (
    <div className="ui-shell-loading" role="status" aria-label="Loading">
      <Spinner size={24} />
    </div>
  );
}

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <CenteredLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children ?? <Outlet />;
}

export function RequirePerm({ perm, children }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(perm)) return <PermissionDenied />;
  return children ?? <Outlet />;
}

export function RequirePlatform({ children }) {
  const { isPlatform, isImpersonating } = useAuth();
  if (!isPlatform) return <PermissionDenied />;
  // An impersonating platform user lives in the company workspace.
  if (isImpersonating) return <Navigate to="/" replace />;
  return children ?? <Outlet />;
}

export function PublicOnly({ children }) {
  const { user, loading, isPlatform, isImpersonating } = useAuth();
  if (loading) return <CenteredLoading />;
  if (user) {
    return <Navigate to={isPlatform && !isImpersonating ? "/platform" : "/"} replace />;
  }
  return children ?? <Outlet />;
}
