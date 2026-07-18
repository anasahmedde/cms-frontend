// Auth context — the ONE owner of session state. Storage contract:
//   digix_token (+ legacy "token" until old pages die) / digix_user (payload
//   WITHOUT the token) / digix_session_id / digix_tenant (company slug) /
//   digix_impersonating (company slug while a platform user impersonates).
// digix_theme is deliberately never touched here.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiGet, apiPost, getToken, TOKEN_KEY, LEGACY_TOKEN_KEY } from "./api";

const USER_KEY = "digix_user";
const SESSION_KEY = "digix_session_id";
const TENANT_KEY = "digix_tenant";
const IMPERSONATE_KEY = "digix_impersonating";

// Legacy client-side role map — fallback when the server sends no permissions.
export const ROLE_PERMISSIONS = {
  admin: ["view_dashboard", "manage_devices", "manage_groups", "manage_shops", "upload_videos", "manage_videos", "manage_links", "manage_users", "view_reports", "export_data"],
  manager: ["view_dashboard", "manage_devices", "manage_groups", "manage_shops", "upload_videos", "manage_videos", "manage_links", "view_reports", "export_data"],
  editor: ["view_dashboard", "upload_videos", "manage_videos", "manage_links", "view_reports"],
  viewer: ["view_dashboard", "view_reports"],
};

// Mirror of the backend's _CONTENT_EDIT_PERMS: any of these makes the user a
// template-content editor (editor role and up); none = the viewer role,
// which is read-only everywhere.
export const CONTENT_EDIT_PERMS = [
  "manage_company_settings", "manage_devices", "manage_shops",
  "upload_videos", "manage_videos", "manage_links",
];

function clearAuthStorage() {
  [TOKEN_KEY, LEGACY_TOKEN_KEY, USER_KEY, SESSION_KEY, TENANT_KEY, IMPERSONATE_KEY]
    .forEach((k) => localStorage.removeItem(k));
}

function readStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* corrupt value — fall through */
  }
  clearAuthStorage(); // corrupt digix_user = logged out
  return null;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(() => !!(readStoredUser() && getToken()));
  const [sessionExpired, setSessionExpired] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState(null);
  const [impersonating, setImpersonating] = useState(() => localStorage.getItem(IMPERSONATE_KEY));

  // Two consecutive auth failures are required before declaring the session
  // dead — a single 401 can be a replica race or a mid-deploy blip.
  const authFailStreakRef = React.useRef(0);

  const refreshMe = useCallback(async () => {
    const res = await apiGet("/auth/me");
    if (res.ok) {
      authFailStreakRef.current = 0;
      setUser((prev) => {
        const merged = { ...prev, ...res.data };
        // Keep the login-time permission snapshot if /auth/me lacks one.
        if (!Array.isArray(res.data?.permissions) || res.data.permissions.length === 0) {
          merged.permissions = prev?.permissions || [];
        }
        try { localStorage.setItem(USER_KEY, JSON.stringify(merged)); } catch { /* quota */ }
        return merged;
      });
    } else if (res.status === 401 || res.status === 403) {
      authFailStreakRef.current += 1;
      if (authFailStreakRef.current >= 2) {
        setSessionExpired(true); // storage kept — the modal's "Log in again" calls logout()
      }
    }
    return res;
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await apiPost("/auth/login", { username, password });
    if (!res.ok) return { ok: false, message: res.message };
    const { token, ...payload } = res.data || {};
    localStorage.setItem(TOKEN_KEY, token || "");
    localStorage.setItem(LEGACY_TOKEN_KEY, token || "");
    localStorage.setItem(USER_KEY, JSON.stringify(payload));
    if (payload.session_id != null) localStorage.setItem(SESSION_KEY, String(payload.session_id));
    // Old format kept: an object {id, slug, name} — TopBar and any legacy reader parse it.
    if (payload.company) localStorage.setItem(TENANT_KEY, JSON.stringify(payload.company));
    localStorage.removeItem(IMPERSONATE_KEY);
    setImpersonating(null);
    setUser(payload);
    setSessionExpired(false);
    setBlockedMessage(null);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    apiPost("/auth/logout"); // fire-and-forget; helpers never throw
    clearAuthStorage(); // keeps digix_theme
    setUser(null);
    setImpersonating(null);
    setSessionExpired(false);
    setBlockedMessage(null);
  }, []);

  const impersonate = useCallback(async (slug, name) => {
    const res = await apiPost("/platform/impersonate", { company_slug: slug });
    if (!res.ok) return { ok: false, message: res.message };
    localStorage.setItem(IMPERSONATE_KEY, slug);
    localStorage.setItem(TENANT_KEY, JSON.stringify({ slug, name: name || slug }));
    setImpersonating(slug);
    await refreshMe();
    return { ok: true };
  }, [refreshMe]);

  const stopImpersonate = useCallback(async () => {
    const res = await apiPost("/platform/stop-impersonate");
    if (!res.ok) return { ok: false, message: res.message };
    localStorage.removeItem(IMPERSONATE_KEY);
    localStorage.removeItem(TENANT_KEY);
    setImpersonating(null);
    await refreshMe();
    return { ok: true };
  }, [refreshMe]);

  const hasPermission = useCallback((perm) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    const serverPerms = Array.isArray(user.permissions) ? user.permissions : [];
    if (user.user_type === "platform" && serverPerms.includes("company.full_access")) return true;
    const effective = serverPerms.length > 0 ? serverPerms : ROLE_PERMISSIONS[user.role] || [];
    return effective.includes(perm);
  }, [user]);

  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);

  // Validate the stored session once at boot. A failed first check retries
  // immediately (second strike) so a genuinely dead token still surfaces the
  // session-expired modal right away rather than a minute later.
  useEffect(() => {
    if (!loading) return;
    let cancelled = false;
    (async () => {
      const res = await refreshMe();
      if (!cancelled && !res.ok && (res.status === 401 || res.status === 403)) {
        await refreshMe();
      }
    })().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session validity poll while logged in.
  const loggedIn = !!user;
  useEffect(() => {
    if (!loggedIn) return undefined;
    const id = setInterval(() => { refreshMe(); }, 60000);
    return () => clearInterval(id);
  }, [loggedIn, refreshMe]);

  // Cross-cutting auth events raised by the shared api client.
  useEffect(() => {
    const onExpired = () => setSessionExpired(true);
    const onBlocked = (e) => setBlockedMessage(e.detail || "Your company account is currently unavailable.");
    window.addEventListener("digix:session-expired", onExpired);
    window.addEventListener("digix:company-blocked", onBlocked);
    return () => {
      window.removeEventListener("digix:session-expired", onExpired);
      window.removeEventListener("digix:company-blocked", onBlocked);
    };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    sessionExpired,
    blockedMessage,
    login,
    logout,
    impersonate,
    stopImpersonate,
    hasPermission,
    isPlatform: user?.user_type === "platform",
    isImpersonating: !!impersonating,
    refreshMe,
    clearSessionExpired,
  }), [user, loading, sessionExpired, blockedMessage, impersonating, login, logout,
       impersonate, stopImpersonate, hasPermission, refreshMe, clearSessionExpired]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
