// src/components/PlatformAdmin.js
// Platform-level admin panel for managing companies (tenants)
// FIXED: Device count display, Expiration column, Background task info
import React, { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;

function authHeaders() {
  const token = localStorage.getItem("digix_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// ─── Stat Card ───
function StatCard({ label, value, sub, color = "#3b82f6", icon }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "20px 24px",
      border: "1px solid #e5e7eb", position: "relative", overflow: "hidden",
      minWidth: 0,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: color,
      }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#0a1628", lineHeight: 1.1 }}>{value ?? 0}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4, fontWeight: 500 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
        </div>
        {icon && <div style={{ fontSize: 28, opacity: 0.15 }}>{icon}</div>}
      </div>
    </div>
  );
}

// ─── Status Badge - shows combined status including expiration ───
function StatusBadge({ status, expirationStatus }) {
  // Use expiration_status if it indicates the company is blocked
  const effectiveStatus = 
    expirationStatus === 'expired' ? 'expired' :
    expirationStatus === 'suspended' ? 'suspended' :
    expirationStatus === 'grace_period' ? 'grace_period' :
    status;
    
  const colors = { 
    active: "#16a34a", 
    suspended: "#dc2626", 
    trial: "#f59e0b", 
    cancelled: "#6b7280",
    expired: "#dc2626",
    grace_period: "#f59e0b"
  };
  const c = colors[effectiveStatus] || "#6b7280";
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 11,
      fontWeight: 600, background: `${c}20`, color: c, textTransform: "uppercase",
    }}>
      {effectiveStatus?.replace(/_/g, ' ') || 'active'}
    </span>
  );
}

// ─── Expiration Badge with Color Coding ───
function ExpirationBadge({ expiresAt, daysUntil, status }) {
  // Not set
  if (!expiresAt) {
    return (
      <span style={{ 
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "4px 10px", borderRadius: 8, fontSize: 11,
        fontWeight: 500, background: "#f3f4f6", color: "#6b7280"
      }}>
        ∞ Not Set
      </span>
    );
  }
  
  // Expired or suspended
  if (status === 'expired' || status === 'suspended') {
    return (
      <span style={{ 
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "4px 10px", borderRadius: 8, fontSize: 11,
        fontWeight: 600, background: "#fef2f2", color: "#dc2626",
        border: "1px solid #fecaca"
      }}>
        ⚠️ {status === 'suspended' ? 'Suspended' : 'Expired'}
      </span>
    );
  }
  
  // Grace period
  if (status === 'grace_period') {
    return (
      <span style={{ 
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "4px 10px", borderRadius: 8, fontSize: 11,
        fontWeight: 600, background: "#fef3c7", color: "#b45309",
        border: "1px solid #fcd34d"
      }}>
        ⏳ Grace Period
      </span>
    );
  }
  
  // Active with expiration - color code by days remaining
  const days = daysUntil ?? 999;
  let color, bg, border, icon;
  
  if (days <= 7) {
    color = "#dc2626"; bg = "#fef2f2"; border = "#fecaca"; icon = "🔴";
  } else if (days <= 30) {
    color = "#b45309"; bg = "#fef3c7"; border = "#fcd34d"; icon = "🟡";
  } else {
    color = "#16a34a"; bg = "#dcfce7"; border = "#86efac"; icon = "🟢";
  }
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ 
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "4px 10px", borderRadius: 8, fontSize: 11,
        fontWeight: 600, background: bg, color: color,
        border: `1px solid ${border}`
      }}>
        {icon} {days}d left
      </span>
      <span style={{ fontSize: 10, color: "#9ca3af" }}>
        {new Date(expiresAt).toLocaleDateString()}
      </span>
    </div>
  );
}

// ─── Device Count with Online Bar ───
function DeviceDisplay({ total, online, offline }) {
  const deviceCount = total || 0;
  const onlineCount = online || 0;
  const offlineCount = offline || 0;
  
  if (deviceCount === 0) {
    return <span style={{ fontSize: 12, color: "#9ca3af" }}>No devices</span>;
  }
  
  const pct = deviceCount > 0 ? Math.round((onlineCount / deviceCount) * 100) : 0;
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: "#16a34a", transition: "width 0.3s" }} />
        </div>
      </div>
      <span style={{ fontSize: 11, color: "#6b7280" }}>
        <span style={{ color: "#16a34a", fontWeight: 600 }}>{onlineCount}</span>
        <span style={{ color: "#9ca3af" }}> / {deviceCount}</span>
        {offlineCount > 0 && <span style={{ color: "#dc2626", marginLeft: 4 }}>({offlineCount} offline)</span>}
      </span>
    </div>
  );
}

export default function PlatformAdmin({ onImpersonate }) {
  const [tab, setTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createResult, setCreateResult] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [expiredCount, setExpiredCount] = useState(0);
  const [expiringSoonCount, setExpiringSoonCount] = useState(0);
  const [expiredCompanies, setExpiredCompanies] = useState([]);
  const [expiringCompanies, setExpiringCompanies] = useState([]);
  const [expiringDays, setExpiringDays] = useState(30);
  
  // Set Expiration Modal state
  const [showSetExpiration, setShowSetExpiration] = useState(null);
  const [expirationDate, setExpirationDate] = useState("");
  const [gracePeriod, setGracePeriod] = useState(7);
  const [settingExpiration, setSettingExpiration] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/platform/dashboard`, { headers: authHeaders() });
      if (res.ok) setDashboard(await res.json());
    } catch (err) { console.error("Dashboard fetch error", err); }
  }, []);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`${API_BASE}/platform/companies?${params}`, { headers: authHeaders() });
      const data = await res.json();
      setCompanies(data.items || []);
    } catch (err) { setError("Failed to load companies"); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  const fetchExpirationData = useCallback(async () => {
    try {
      // Fetch expired companies
      const expiredRes = await fetch(`${API_BASE}/platform/companies/expiration?status=expired`, { headers: authHeaders() });
      if (expiredRes.ok) {
        const data = await expiredRes.json();
        setExpiredCompanies(data);
        setExpiredCount(data.length);
      }
      
      // Fetch expiring soon companies
      const expiringRes = await fetch(`${API_BASE}/platform/companies/expiring-soon?days=${expiringDays}`, { headers: authHeaders() });
      if (expiringRes.ok) {
        const data = await expiringRes.json();
        setExpiringCompanies(data);
        setExpiringSoonCount(data.length);
      }
    } catch (err) { console.error("Failed to fetch expiration data", err); }
  }, [expiringDays]);

  useEffect(() => { 
    fetchDashboard(); 
    fetchCompanies(); 
    fetchExpirationData();
  }, [fetchDashboard, fetchCompanies, fetchExpirationData]);

  const fetchStats = async (slug) => {
    try {
      const res = await fetch(`${API_BASE}/platform/companies/${slug}/stats`, { headers: authHeaders() });
      setStats(await res.json());
    } catch { setStats(null); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setCreateResult(null);
    const form = new FormData(e.target);
    
    const body = {
      slug: form.get("slug"), 
      name: form.get("name"), 
      email: form.get("email") || null,
      phone: form.get("phone") || null, 
      max_devices: parseInt(form.get("max_devices") || "50"),
      max_users: parseInt(form.get("max_users") || "10"),
      max_storage_mb: parseInt(form.get("max_storage_mb") || "5120"),
      admin_username: form.get("admin_username"), 
      admin_email: form.get("admin_email") || null,
      admin_full_name: form.get("admin_full_name") || null,
    };
    
    try {
      const res = await fetch(`${API_BASE}/platform/companies`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create company");
      
      // If expiration date was set, apply it
      const expiresAt = form.get("expires_at");
      const gracePeriodDays = parseInt(form.get("grace_period_days") || "7");
      if (expiresAt && data.company?.id) {
        await fetch(`${API_BASE}/platform/company/${data.company.id}/expiration`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            expires_at: new Date(expiresAt).toISOString(),
            grace_period_days: gracePeriodDays,
            notes: "Set during company creation"
          })
        });
      }
      
      setCreateResult(data);
      setSuccess(`Company "${data.company.name}" created successfully!`);
      fetchCompanies(); fetchDashboard(); fetchExpirationData();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (slug, name) => {
    const confirmText = prompt(`⚠️ DELETE "${name}"?\n\nType the slug "${slug}" to confirm:`);
    if (confirmText !== slug) {
      if (confirmText !== null) alert("Slug did not match.");
      return;
    }
    setDeleting(slug);
    try {
      const res = await fetch(`${API_BASE}/platform/companies/${slug}`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to delete");
      }
      setSuccess(`Company "${name}" deleted.`);
      setSelectedCompany(null);
      fetchCompanies(); fetchDashboard(); fetchExpirationData();
    } catch (err) { setError(err.message); }
    finally { setDeleting(null); }
  };

  const handleSuspend = async (companyId, name) => {
    const reason = prompt(`Reason for suspending "${name}":`);
    if (!reason) return;
    try {
      const res = await fetch(`${API_BASE}/platform/company/${companyId}/suspend`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        setSuccess(`"${name}" suspended.`);
        fetchCompanies(); fetchExpirationData();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to suspend");
      }
    } catch (err) { setError("Failed to suspend"); }
  };

  const handleReactivate = async (companyId, name, extendDays = 30) => {
    try {
      const res = await fetch(`${API_BASE}/platform/company/${companyId}/reactivate?extend_days=${extendDays}`, {
        method: "POST", headers: authHeaders()
      });
      if (res.ok) {
        setSuccess(`"${name}" reactivated for ${extendDays} days.`);
        fetchCompanies(); fetchExpirationData();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to reactivate");
      }
    } catch (err) { setError("Failed to reactivate"); }
  };

  const handleSetExpiration = async () => {
    if (!showSetExpiration) return;
    setSettingExpiration(true);
    setError("");
    try {
      if (!expirationDate) {
        // Remove expiration
        const res = await fetch(`${API_BASE}/platform/company/${showSetExpiration.id}/expiration`, {
          method: "DELETE", headers: authHeaders()
        });
        if (res.ok) {
          setSuccess(`Expiration removed for ${showSetExpiration.name}`);
        } else {
          const data = await res.json();
          throw new Error(data.detail || "Failed to remove expiration");
        }
      } else {
        // Set expiration
        const res = await fetch(`${API_BASE}/platform/company/${showSetExpiration.id}/expiration`, {
          method: "PUT", headers: authHeaders(),
          body: JSON.stringify({
            expires_at: new Date(expirationDate).toISOString(),
            grace_period_days: gracePeriod,
            notes: "Set from dashboard"
          })
        });
        if (res.ok) {
          const data = await res.json();
          setSuccess(`Expiration set for ${showSetExpiration.name}: ${data.expiration_status}`);
        } else {
          const data = await res.json();
          throw new Error(data.detail || "Failed to set expiration");
        }
      }
      
      setShowSetExpiration(null);
      fetchCompanies();
      fetchExpirationData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSettingExpiration(false);
    }
  };

  const handleExtend = async (companyId, name, days) => {
    try {
      const res = await fetch(`${API_BASE}/platform/company/${companyId}/extend`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ extend_days: days, notes: "Extended from dashboard" })
      });
      if (res.ok) {
        setSuccess(`Extended "${name}" by ${days} days`);
        fetchCompanies(); fetchExpirationData();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to extend");
      }
    } catch (err) { setError("Failed to extend"); }
  };

  const tabStyle = (active) => ({
    padding: "10px 20px", background: active ? "#fff" : "transparent",
    border: "none", borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
    cursor: "pointer", fontWeight: active ? 600 : 500,
    color: active ? "#3b82f6" : "#6b7280", fontSize: 14, position: "relative"
  });

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, boxSizing: "border-box" };

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "#f3f4f6" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#0a1628" }}>Platform Admin</h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>Manage companies and subscriptions</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateResult(null); setError(""); }}
          style={{
            padding: "12px 24px", background: "#f59e0b", color: "#0a1628", border: "none",
            borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14
          }}
        >
          + Onboard Company
        </button>
      </div>

      {/* Messages */}
      {success && (
        <div style={{ padding: 12, background: "#dcfce7", borderRadius: 8, marginBottom: 16, color: "#166534", display: "flex", justifyContent: "space-between" }}>
          {success}
          <button onClick={() => setSuccess("")} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}
      {error && (
        <div style={{ padding: 12, background: "#fef2f2", borderRadius: 8, marginBottom: 16, color: "#dc2626", display: "flex", justifyContent: "space-between" }}>
          {error}
          <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb", marginBottom: 24, background: "#fff", borderRadius: "8px 8px 0 0" }}>
        <button style={tabStyle(tab === "dashboard")} onClick={() => setTab("dashboard")}>📊 Dashboard</button>
        <button style={tabStyle(tab === "companies")} onClick={() => setTab("companies")}>🏢 Companies</button>
        <button style={tabStyle(tab === "expired")} onClick={() => setTab("expired")}>
          ⚠️ Expired {expiredCount > 0 && <span style={{ marginLeft: 6, background: "#dc2626", color: "#fff", padding: "2px 6px", borderRadius: 10, fontSize: 11 }}>{expiredCount}</span>}
        </button>
        <button style={tabStyle(tab === "expiring")} onClick={() => setTab("expiring")}>
          ⏰ Expiring Soon {expiringSoonCount > 0 && <span style={{ marginLeft: 6, background: "#f59e0b", color: "#fff", padding: "2px 6px", borderRadius: 10, fontSize: 11 }}>{expiringSoonCount}</span>}
        </button>
      </div>

      {/* Dashboard Tab - Enhanced with notifications and expiring companies */}
      {tab === "dashboard" && dashboard && (
        <>
          {/* Alert Banners */}
          {expiredCount > 0 && (
            <div style={{ 
              background: "linear-gradient(90deg, #dc2626, #b91c1c)", 
              padding: "16px 20px", 
              borderRadius: 12, 
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#fff"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>🚨</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{expiredCount} Company{expiredCount > 1 ? "ies" : ""} Expired!</div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>Users cannot login and devices are showing enrollment screen</div>
                </div>
              </div>
              <button onClick={() => setTab("expired")} style={{ 
                padding: "10px 20px", 
                background: "#fff", 
                color: "#dc2626", 
                border: "none", 
                borderRadius: 8, 
                fontWeight: 700, 
                cursor: "pointer" 
              }}>
                View & Reactivate →
              </button>
            </div>
          )}
          
          {expiringSoonCount > 0 && (
            <div style={{ 
              background: "linear-gradient(90deg, #f59e0b, #d97706)", 
              padding: "16px 20px", 
              borderRadius: 12, 
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#0a1628"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>⏰</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{expiringSoonCount} Company{expiringSoonCount > 1 ? "ies" : ""} Expiring Soon</div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>Contact these companies to renew their subscriptions</div>
                </div>
              </div>
              <button onClick={() => setTab("expiring")} style={{ 
                padding: "10px 20px", 
                background: "#0a1628", 
                color: "#f59e0b", 
                border: "none", 
                borderRadius: 8, 
                fontWeight: 700, 
                cursor: "pointer" 
              }}>
                View Details →
              </button>
            </div>
          )}

          {/* Stats Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
            <StatCard label="Total Companies" value={dashboard.total_companies} color="#3b82f6" icon="🏢" />
            <StatCard label="Active" value={dashboard.active_companies} color="#16a34a" icon="✅" />
            <StatCard label="Total Devices" value={dashboard.total_devices} color="#8b5cf6" icon="📱" />
            <StatCard label="Online" value={dashboard.online_devices} sub={`${dashboard.offline_devices || 0} offline`} color="#10b981" icon="🟢" />
            <StatCard label="Users" value={dashboard.total_users} color="#f59e0b" icon="👥" />
            <StatCard label="Expired" value={expiredCount} color="#dc2626" icon="⚠️" />
          </div>

          {/* Subscription Overview Section */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            {/* Expiring Soon List */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ 
                padding: "16px 20px", 
                borderBottom: "1px solid #e5e7eb", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                background: "#fffbeb"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>⏰</span>
                  <span style={{ fontWeight: 700, color: "#92400e" }}>Expiring Soon</span>
                </div>
                <span style={{ 
                  background: "#f59e0b", 
                  color: "#fff", 
                  padding: "4px 10px", 
                  borderRadius: 12, 
                  fontSize: 12, 
                  fontWeight: 700 
                }}>
                  {expiringSoonCount}
                </span>
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {expiringCompanies.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                    <div>No companies expiring in the next {expiringDays} days</div>
                  </div>
                ) : (
                  expiringCompanies.slice(0, 5).map((c, idx) => (
                    <div key={c.company_id || idx} style={{ 
                      padding: "12px 20px", 
                      borderBottom: "1px solid #f3f4f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "#1f2937" }}>{c.company_name}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{c.device_count || 0} devices · {c.user_count || 0} users</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ 
                          fontSize: 13, 
                          fontWeight: 700, 
                          color: c.days_until_expiration <= 7 ? "#dc2626" : "#f59e0b" 
                        }}>
                          {c.days_until_expiration}d left
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "N/A"}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {expiringCompanies.length > 5 && (
                  <div style={{ padding: "12px 20px", textAlign: "center" }}>
                    <button onClick={() => setTab("expiring")} style={{ 
                      color: "#f59e0b", 
                      background: "none", 
                      border: "none", 
                      cursor: "pointer", 
                      fontWeight: 600,
                      fontSize: 13
                    }}>
                      View all {expiringCompanies.length} →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Expired List */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ 
                padding: "16px 20px", 
                borderBottom: "1px solid #e5e7eb", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                background: "#fef2f2"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🚨</span>
                  <span style={{ fontWeight: 700, color: "#991b1b" }}>Expired Companies</span>
                </div>
                <span style={{ 
                  background: "#dc2626", 
                  color: "#fff", 
                  padding: "4px 10px", 
                  borderRadius: 12, 
                  fontSize: 12, 
                  fontWeight: 700 
                }}>
                  {expiredCount}
                </span>
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {expiredCompanies.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                    <div>No expired companies</div>
                  </div>
                ) : (
                  expiredCompanies.slice(0, 5).map((c, idx) => (
                    <div key={c.company_id || idx} style={{ 
                      padding: "12px 20px", 
                      borderBottom: "1px solid #f3f4f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "#1f2937" }}>{c.company_name}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{c.device_count || 0} devices · {c.user_count || 0} users</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#dc2626" }}>
                            Expired {c.days_since_expiration || 0}d ago
                          </div>
                        </div>
                        <button 
                          onClick={() => handleReactivate(c.company_id, c.company_name, 30)}
                          style={{ 
                            padding: "6px 12px", 
                            background: "#16a34a", 
                            color: "#fff", 
                            border: "none", 
                            borderRadius: 6, 
                            fontSize: 11, 
                            fontWeight: 600,
                            cursor: "pointer" 
                          }}
                        >
                          +30d
                        </button>
                      </div>
                    </div>
                  ))
                )}
                {expiredCompanies.length > 5 && (
                  <div style={{ padding: "12px 20px", textAlign: "center" }}>
                    <button onClick={() => setTab("expired")} style={{ 
                      color: "#dc2626", 
                      background: "none", 
                      border: "none", 
                      cursor: "pointer", 
                      fontWeight: 600,
                      fontSize: 13
                    }}>
                      View all {expiredCompanies.length} →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Companies Tab */}
      {tab === "companies" && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", gap: 12 }}>
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, padding: 10, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14 }} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="trial">Trial</option>
            </select>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Company</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Status</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Expiration</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Devices</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Users</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Created</th>
                  <th style={{ padding: 12, textAlign: "right", fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.length > 0 ? companies.map((c) => (
                  <tr key={c.slug} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600, cursor: "pointer" }} onClick={() => { setSelectedCompany(c); fetchStats(c.slug); }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{c.slug}</div>
                    </td>
                    <td style={{ padding: 12 }}><StatusBadge status={c.status} expirationStatus={c.expiration_status} /></td>
                    <td style={{ padding: 12 }}>
                      <ExpirationBadge expiresAt={c.expires_at} daysUntil={c.days_until_expiration} status={c.expiration_status} />
                    </td>
                    <td style={{ padding: 12 }}>
                      <DeviceDisplay total={c.device_count} online={c.devices_online} offline={c.devices_offline} />
                    </td>
                    <td style={{ padding: 12 }}>{c.user_count || 0}</td>
                    <td style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: 12, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {onImpersonate && (
                          <button onClick={() => onImpersonate(c.slug)}
                            style={{ padding: "4px 8px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
                            Enter
                          </button>
                        )}
                        <button 
                          onClick={() => { setShowSetExpiration(c); setExpirationDate(c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 16) : ""); setGracePeriod(c.grace_period_days || 7); }}
                          style={{ padding: "4px 8px", background: c.expires_at ? "#8b5cf6" : "#6b7280", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
                          📅
                        </button>
                        {c.expiration_status === "expired" || c.expiration_status === "suspended" ? (
                          <button onClick={() => handleReactivate(c.id, c.name)}
                            style={{ padding: "4px 8px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
                            Reactivate
                          </button>
                        ) : (
                          <button onClick={() => handleSuspend(c.id, c.name)}
                            style={{ padding: "4px 8px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No companies found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Expired Tab */}
      {tab === "expired" && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 24 }}>
          {expiredCompanies.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>No expired companies</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16, padding: 12, background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>
                <span style={{ color: "#dc2626", fontWeight: 600 }}>⚠️ {expiredCompanies.length} expired</span>
                <span style={{ color: "#7f1d1d", marginLeft: 8, fontSize: 13 }}>— Users cannot login, devices show "Not Enrolled"</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: 12, textAlign: "left" }}>Company</th>
                    <th style={{ padding: 12, textAlign: "center" }}>Devices</th>
                    <th style={{ padding: 12, textAlign: "center" }}>Users</th>
                    <th style={{ padding: 12, textAlign: "left" }}>Expired</th>
                    <th style={{ padding: 12, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expiredCompanies.map((c) => (
                    <tr key={c.company_id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 600 }}>{c.company_name}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{c.company_slug}</div>
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>{c.device_count || 0}</td>
                      <td style={{ padding: 12, textAlign: "center" }}>{c.user_count || 0}</td>
                      <td style={{ padding: 12, color: "#dc2626" }}>{c.days_since_expiration || 0} days ago</td>
                      <td style={{ padding: 12, textAlign: "right" }}>
                        <button onClick={() => handleReactivate(c.company_id, c.company_name, 30)}
                          style={{ padding: "6px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, marginRight: 8 }}>
                          Reactivate 30d
                        </button>
                        <button onClick={() => handleReactivate(c.company_id, c.company_name, 365)}
                          style={{ padding: "6px 12px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                          +1 Year
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Expiring Soon Tab */}
      {tab === "expiring" && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 24 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
            <span style={{ fontWeight: 500 }}>Show expiring in:</span>
            {[7, 14, 30, 60, 90].map(d => (
              <button key={d} onClick={() => setExpiringDays(d)}
                style={{ padding: "6px 12px", border: "1px solid #e5e7eb", borderRadius: 6, background: expiringDays === d ? "#3b82f6" : "#fff", color: expiringDays === d ? "#fff" : "#374151", cursor: "pointer", fontSize: 13 }}>
                {d}d
              </button>
            ))}
          </div>

          {expiringCompanies.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div>No companies expiring in {expiringDays} days</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: 12, textAlign: "left" }}>Company</th>
                  <th style={{ padding: 12, textAlign: "center" }}>Devices</th>
                  <th style={{ padding: 12, textAlign: "center" }}>Users</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Time Left</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Expires</th>
                  <th style={{ padding: 12, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expiringCompanies.map((c) => (
                  <tr key={c.company_id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600 }}>{c.company_name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{c.company_slug}</div>
                    </td>
                    <td style={{ padding: 12, textAlign: "center" }}>{c.device_count || 0}</td>
                    <td style={{ padding: 12, textAlign: "center" }}>{c.user_count || 0}</td>
                    <td style={{ padding: 12 }}>
                      <ExpirationBadge expiresAt={c.expires_at} daysUntil={c.days_until_expiration} status={c.expiration_status} />
                    </td>
                    <td style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</td>
                    <td style={{ padding: 12, textAlign: "right" }}>
                      <button onClick={() => handleExtend(c.company_id, c.company_name, 30)}
                        style={{ padding: "6px 12px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                        +30d
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Company Details Modal */}
      {selectedCompany && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => { setSelectedCompany(null); setStats(null); }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: 560, maxHeight: "80vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 20 }}>{selectedCompany.name}</h3>
              <StatusBadge status={selectedCompany.status} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14 }}>
              <div><strong>Slug:</strong> <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>{selectedCompany.slug}</code></div>
              <div><strong>ID:</strong> {selectedCompany.id}</div>
              <div><strong>Email:</strong> {selectedCompany.email || "—"}</div>
              <div><strong>Max Devices:</strong> {selectedCompany.max_devices}</div>
              <div><strong>Max Users:</strong> {selectedCompany.max_users}</div>
              <div><strong>Storage:</strong> {selectedCompany.max_storage_mb} MB</div>
            </div>

            {/* Expiration Info */}
            <div style={{ marginTop: 16, padding: 16, background: selectedCompany.expires_at ? "#fef3c7" : "#f3f4f6", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Expiration</div>
                  <ExpirationBadge expiresAt={selectedCompany.expires_at} daysUntil={selectedCompany.days_until_expiration} status={selectedCompany.expiration_status} />
                </div>
                <button onClick={() => { setShowSetExpiration(selectedCompany); setExpirationDate(selectedCompany.expires_at ? new Date(selectedCompany.expires_at).toISOString().slice(0, 16) : ""); setGracePeriod(selectedCompany.grace_period_days || 7); }}
                  style={{ padding: "8px 16px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  {selectedCompany.expires_at ? "Edit" : "Set Expiration"}
                </button>
              </div>
            </div>

            {stats && (
              <div style={{ marginTop: 16, padding: 16, background: "#f9fafb", borderRadius: 12 }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>Usage Statistics</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[["Devices", stats.device_count], ["Users", stats.user_count], ["Videos", stats.video_count],
                    ["Ads", stats.advertisement_count], ["Groups", stats.group_count], ["Shops", stats.shop_count]].map(([label, val]) => (
                    <div key={label} style={{ textAlign: "center", padding: 8, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#0a1628" }}>{val}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => { setSelectedCompany(null); setStats(null); }}
                style={{ flex: 1, padding: 12, background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                Close
              </button>
              <button onClick={() => handleDelete(selectedCompany.slug, selectedCompany.name)}
                disabled={deleting === selectedCompany.slug}
                style={{ padding: "12px 24px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, opacity: deleting ? 0.6 : 1 }}>
                {deleting === selectedCompany.slug ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Expiration Modal */}
      {showSetExpiration && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}
          onClick={() => setShowSetExpiration(null)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18 }}>Set Expiration: {showSetExpiration.name}</h3>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Expiration Date & Time</label>
              <input type="datetime-local" value={expirationDate} onChange={e => setExpirationDate(e.target.value)}
                style={{ ...inputStyle }} />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Leave empty to remove expiration</div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Grace Period</label>
              <input type="number" value={gracePeriod} onChange={e => setGracePeriod(parseInt(e.target.value) || 0)} min={0} max={30}
                style={{ width: 100, padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8 }} />
              <span style={{ marginLeft: 8, fontSize: 12, color: "#6b7280" }}>days after expiry</span>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Quick Set:</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[{ label: "30d", days: 30 }, { label: "90d", days: 90 }, { label: "6mo", days: 180 }, { label: "1yr", days: 365 }].map(opt => (
                  <button key={opt.days} onClick={() => { const d = new Date(); d.setDate(d.getDate() + opt.days); setExpirationDate(d.toISOString().slice(0, 16)); }}
                    style={{ padding: "6px 12px", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowSetExpiration(null)}
                style={{ flex: 1, padding: 12, background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                Cancel
              </button>
              {showSetExpiration.expires_at && (
                <button onClick={() => { setExpirationDate(""); handleSetExpiration(); }}
                  disabled={settingExpiration}
                  style={{ padding: "12px 16px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                  Remove
                </button>
              )}
              <button onClick={handleSetExpiration} disabled={settingExpiration}
                style={{ flex: 1, padding: 12, background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, opacity: settingExpiration ? 0.6 : 1 }}>
                {settingExpiration ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Company Modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowCreate(false)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: 600, maxHeight: "90vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20 }}>Onboard New Company</h3>

            {createResult ? (
              <div>
                <div style={{ padding: 16, background: "#dcfce7", borderRadius: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: "#166534", marginBottom: 8 }}>Created Successfully!</div>
                  <div style={{ fontSize: 13 }}>
                    <div><strong>Company:</strong> {createResult.company.name} ({createResult.company.slug})</div>
                    <div style={{ marginTop: 8 }}><strong>Admin:</strong> <code>{createResult.admin_user.username}</code></div>
                    <div><strong>Password:</strong> <code style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: 4 }}>{createResult.admin_user.temp_password}</code></div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "#92400e" }}>⚠️ Save this password now!</div>
                  </div>
                </div>
                <button onClick={() => { setShowCreate(false); setCreateResult(null); }}
                  style={{ width: "100%", padding: 12, background: "#0a1628", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12, borderBottom: "1px solid #e5e7eb", paddingBottom: 8 }}>Company Details</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Name *</label>
                    <input name="name" required style={inputStyle} /></div>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Slug *</label>
                    <input name="slug" required pattern="[a-z0-9][a-z0-9\-]*[a-z0-9]" style={inputStyle} /></div>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email</label>
                    <input name="email" type="email" style={inputStyle} /></div>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Phone</label>
                    <input name="phone" style={inputStyle} /></div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12, borderBottom: "1px solid #e5e7eb", paddingBottom: 8 }}>Quotas</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Max Devices</label>
                    <input name="max_devices" type="number" defaultValue={50} style={inputStyle} /></div>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Max Users</label>
                    <input name="max_users" type="number" defaultValue={10} style={inputStyle} /></div>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Storage MB</label>
                    <input name="max_storage_mb" type="number" defaultValue={5120} style={inputStyle} /></div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12, borderBottom: "1px solid #e5e7eb", paddingBottom: 8 }}>Subscription</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Expiration</label>
                    <input name="expires_at" type="datetime-local" style={inputStyle} /></div>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Grace Period</label>
                    <input name="grace_period_days" type="number" defaultValue={7} min={0} max={30} style={inputStyle} /></div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12, borderBottom: "1px solid #e5e7eb", paddingBottom: 8 }}>Admin User</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Username *</label>
                    <input name="admin_username" required style={inputStyle} /></div>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Full Name</label>
                    <input name="admin_full_name" style={inputStyle} /></div>
                  <div style={{ gridColumn: "1 / -1" }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email</label>
                    <input name="admin_email" type="email" style={inputStyle} /></div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button type="button" onClick={() => setShowCreate(false)}
                    style={{ flex: 1, padding: 12, background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                    Cancel
                  </button>
                  <button type="submit"
                    style={{ flex: 1, padding: 12, background: "#f59e0b", color: "#0a1628", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                    Create
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
