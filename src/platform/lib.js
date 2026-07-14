// Shared data + vocabulary for the platform section. One dashboard fetch
// serves both Overview and Companies (the legacy pages each had their own).
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "../lib/api";

export function usePlatformDashboard(auto = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const seqRef = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++seqRef.current;
    const res = await apiGet("/platform/dashboard");
    if (seq !== seqRef.current) return;
    if (res.ok) {
      setData(res.data);
      setError("");
    } else {
      setError(res.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    if (!auto) return undefined;
    const id = setInterval(reload, 30000);
    return () => clearInterval(id);
  }, [reload, auto]);

  return { data, loading, error, reload };
}

// Effective status merging company.status with expiration_status (the legacy
// StatusBadge/StatusPill logic, unified once).
export function effectiveStatus(c) {
  const exp = c.expiration_status;
  if (exp === "expired") return { key: "expired", label: "Expired", tone: "danger" };
  if (exp === "suspended" || c.status === "suspended") return { key: "suspended", label: "Suspended", tone: "danger" };
  if (exp === "grace_period") return { key: "grace_period", label: "Grace period", tone: "warn" };
  if (c.status === "trial") return { key: "trial", label: "Trial", tone: "info" };
  if (c.status === "cancelled") return { key: "cancelled", label: "Cancelled", tone: "neutral" };
  return { key: "active", label: "Active", tone: "success" };
}

export function expirationLabel(c) {
  if (!c.expires_at) return { label: "Never expires", tone: "neutral" };
  const days = c.days_until_expiration;
  if (c.expiration_status === "expired") {
    const ago = c.days_since_expiration != null ? ` ${c.days_since_expiration}d ago` : "";
    return { label: `Expired${ago}`, tone: "danger" };
  }
  if (c.expiration_status === "grace_period") return { label: "Grace period", tone: "warn" };
  if (days != null) {
    const tone = days <= 7 ? "danger" : days <= 30 ? "warn" : "success";
    return { label: `${days}d left`, tone };
  }
  return { label: new Date(c.expires_at).toLocaleDateString(), tone: "neutral" };
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
