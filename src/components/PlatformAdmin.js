// src/components/PlatformAdmin.js
// Platform-level admin panel for managing companies (tenants)
// Features: Dashboard overview, company CRUD, delete, suspend/reactivate, impersonate
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
          <div style={{ fontSize: 28, fontWeight: 700, color: "#0a1628", lineHeight: 1.1 }}>{value}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4, fontWeight: 500 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
        </div>
        {icon && <div style={{ fontSize: 28, opacity: 0.15 }}>{icon}</div>}
      </div>
    </div>
  );
}

// ─── Status Badge ───
function StatusBadge({ status }) {
  const colors = { active: "#16a34a", suspended: "#dc2626", trial: "#f59e0b", cancelled: "#6b7280" };
  const c = colors[status] || "#6b7280";
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 11,
      fontWeight: 600, background: `${c}20`, color: c, textTransform: "uppercase",
    }}>
      {status}
    </span>
  );
}

// ─── Online/Offline Indicator ───
function OnlineBar({ online, offline, total }) {
  if (total === 0) return <span style={{ fontSize: 12, color: "#9ca3af" }}>No devices</span>;
  const pct = total > 0 ? Math.round((online / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#f3f4f6", overflow: "hidden", minWidth: 50 }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: "#16a34a", transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
        <span style={{ color: "#16a34a", fontWeight: 600 }}>{online}</span>
        {" / "}
        {total}
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

  useEffect(() => { fetchDashboard(); fetchCompanies(); }, [fetchDashboard, fetchCompanies]);

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
      slug: form.get("slug"), name: form.get("name"), email: form.get("email") || null,
      phone: form.get("phone") || null, max_devices: parseInt(form.get("max_devices") || "50"),
      max_users: parseInt(form.get("max_users") || "10"),
      max_storage_mb: parseInt(form.get("max_storage_mb") || "5120"),
      admin_username: form.get("admin_username"), admin_email: form.get("admin_email") || null,
      admin_full_name: form.get("admin_full_name") || null,
    };
    try {
      const res = await fetch(`${API_BASE}/platform/companies`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create company");
      setCreateResult(data);
      setSuccess(`Company "${data.company.name}" created successfully!`);
      fetchCompanies(); fetchDashboard();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (slug, name) => {
    const confirmText = prompt(
      `\u26a0\ufe0f PERMANENT DELETE\n\nThis will permanently delete "${name}" (${slug}) and ALL its data including:\n\u2022 All devices, videos, advertisements\n\u2022 All users and roles\n\u2022 All groups, shops, and links\n\u2022 All S3 media files\n\nType the company slug "${slug}" to confirm:`
    );
    if (confirmText !== slug) {
      if (confirmText !== null) setError("Slug did not match. Deletion cancelled.");
      return;
    }
    setDeleting(slug);
    try {
      const res = await fetch(`${API_BASE}/platform/companies/${slug}`, {
        method: "DELETE", headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to delete company");
      setSuccess(`Company "${name}" permanently deleted. ${data.s3_keys_deleted} media files cleaned up.`);
      setSelectedCompany(null); setStats(null);
      fetchCompanies(); fetchDashboard();
    } catch (err) { setError(err.message); }
    finally { setDeleting(null); }
  };

  const handleSuspend = async (slug) => {
    if (!window.confirm(`Suspend company "${slug}"? All users will be logged out.`)) return;
    try {
      const res = await fetch(`${API_BASE}/platform/companies/${slug}/suspend`, { method: "POST", headers: authHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setSuccess(`Company "${slug}" suspended`);
      fetchCompanies(); fetchDashboard();
    } catch (err) { setError(err.message); }
  };

  const handleReactivate = async (slug) => {
    try {
      const res = await fetch(`${API_BASE}/platform/companies/${slug}/reactivate`, { method: "POST", headers: authHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setSuccess(`Company "${slug}" reactivated`);
      fetchCompanies(); fetchDashboard();
    } catch (err) { setError(err.message); }
  };

  const tabStyle = (active) => ({
    padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
    border: "none", borderRadius: "8px 8px 0 0",
    background: active ? "#fff" : "transparent",
    color: active ? "#0a1628" : "#6b7280",
    borderBottom: active ? "2px solid #f59e0b" : "2px solid transparent",
    transition: "all 0.2s",
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Platform Administration</h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>Manage companies and tenants</p>
        </div>
        <button onClick={() => { setShowCreate(true); setCreateResult(null); setError(""); }}
          style={{ padding: "10px 20px", background: "#f59e0b", color: "#0a1628", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
          + New Company
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 0, borderBottom: "1px solid #e5e7eb" }}>
        <button style={tabStyle(tab === "dashboard")} onClick={() => setTab("dashboard")}>Dashboard</button>
        <button style={tabStyle(tab === "companies")} onClick={() => setTab("companies")}>Companies</button>
      </div>

      {/* Alerts */}
      {error && <div style={{ padding: 12, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginTop: 16, marginBottom: 8 }}>{error}
        <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", color: "#dc2626", cursor: "pointer" }}>✕</button></div>}
      {success && <div style={{ padding: 12, background: "#dcfce7", color: "#166534", borderRadius: 8, marginTop: 16, marginBottom: 8 }}>{success}
        <button onClick={() => setSuccess("")} style={{ float: "right", background: "none", border: "none", color: "#166534", cursor: "pointer" }}>✕</button></div>}

      {/* ═══ DASHBOARD TAB ═══ */}
      {tab === "dashboard" && (
        <div style={{ marginTop: 20 }}>
          {!dashboard ? <p style={{ color: "#9ca3af" }}>Loading dashboard...</p> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
                <StatCard label="Companies" value={dashboard.total_companies}
                  sub={`${dashboard.active_companies} active \u00b7 ${dashboard.suspended_companies} suspended`}
                  color="#3b82f6" icon="\ud83c\udfe2" />
                <StatCard label="Total Devices" value={dashboard.total_devices}
                  sub={`${dashboard.online_devices} online \u00b7 ${dashboard.offline_devices} offline`}
                  color="#16a34a" icon="\ud83d\udcf1" />
                <StatCard label="Videos" value={dashboard.total_videos} color="#8b5cf6" icon="\ud83c\udfac" />
                <StatCard label="Advertisements" value={dashboard.total_advertisements} color="#f59e0b" icon="\ud83d\udce2" />
                <StatCard label="Users" value={dashboard.total_users} color="#ec4899" icon="\ud83d\udc65" />
                <StatCard label="Groups" value={dashboard.total_groups}
                  sub={`${dashboard.total_shops} shops`} color="#06b6d4" icon="\ud83d\udcc2" />
              </div>

              {dashboard.total_devices > 0 && (
                <div style={{ background: "#fff", borderRadius: 12, padding: "16px 24px", border: "1px solid #e5e7eb", marginBottom: 28 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Fleet Device Health</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ flex: 1, height: 12, borderRadius: 6, background: "#f3f4f6", overflow: "hidden" }}>
                      <div style={{
                        width: `${Math.round((dashboard.online_devices / dashboard.total_devices) * 100)}%`,
                        height: "100%", borderRadius: 6,
                        background: "linear-gradient(90deg, #16a34a, #22c55e)",
                        transition: "width 0.5s",
                      }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#16a34a", minWidth: 60, textAlign: "right" }}>
                      {Math.round((dashboard.online_devices / dashboard.total_devices) * 100)}% online
                    </span>
                  </div>
                </div>
              )}

              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#0a1628" }}>Company Breakdown</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        {["Company", "Status", "Devices", "Videos", "Ads", "Users", "Groups", "Shops", "Actions"].map(h => (
                          <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboard.companies || []).map(c => (
                        <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{c.slug}</div>
                          </td>
                          <td style={{ padding: "12px 14px" }}><StatusBadge status={c.status} /></td>
                          <td style={{ padding: "12px 14px", minWidth: 130 }}>
                            <OnlineBar online={c.devices_online} offline={c.devices_offline} total={c.device_count} />
                          </td>
                          <td style={{ padding: "12px 14px", fontWeight: 500, textAlign: "center" }}>{c.video_count}</td>
                          <td style={{ padding: "12px 14px", fontWeight: 500, textAlign: "center" }}>{c.ad_count}</td>
                          <td style={{ padding: "12px 14px", fontWeight: 500, textAlign: "center" }}>{c.user_count}</td>
                          <td style={{ padding: "12px 14px", fontWeight: 500, textAlign: "center" }}>{c.group_count}</td>
                          <td style={{ padding: "12px 14px", fontWeight: 500, textAlign: "center" }}>{c.shop_count}</td>
                          <td style={{ padding: "12px 14px" }}>
                            <button onClick={() => { if (onImpersonate) onImpersonate(c.slug, c.name); }}
                              style={{ padding: "4px 10px", fontSize: 11, border: "1px solid #3b82f6", borderRadius: 6, background: "#eff6ff", color: "#2563eb", cursor: "pointer", fontWeight: 600 }}>
                              Enter
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(dashboard.companies || []).length === 0 && (
                        <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No companies yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ COMPANIES TAB ═══ */}
      {tab === "companies" && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <input placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14 }} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14 }}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="trial">Trial</option>
            </select>
          </div>

          {loading ? <p>Loading...</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  {["Company", "Slug", "Status", "Limits", "Created", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map(c => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{c.email || "\u2014"}</div>
                    </td>
                    <td style={{ padding: "12px", fontFamily: "monospace", fontSize: 13 }}>{c.slug}</td>
                    <td style={{ padding: "12px" }}><StatusBadge status={c.status} /></td>
                    <td style={{ padding: "12px", fontSize: 12, color: "#6b7280" }}>
                      {c.max_devices} devices \u00b7 {c.max_users} users
                    </td>
                    <td style={{ padding: "12px", fontSize: 12, color: "#6b7280" }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => { setSelectedCompany(c); fetchStats(c.slug); }}
                          style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: "pointer" }}>
                          Details
                        </button>
                        <button onClick={() => { if (onImpersonate) onImpersonate(c.slug, c.name); }}
                          style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #3b82f6", borderRadius: 6, background: "#eff6ff", color: "#2563eb", cursor: "pointer" }}>
                          Enter
                        </button>
                        {c.status === "active" ? (
                          <button onClick={() => handleSuspend(c.slug)}
                            style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #fca5a5", borderRadius: 6, background: "#fef2f2", color: "#dc2626", cursor: "pointer" }}>
                            Suspend
                          </button>
                        ) : c.status === "suspended" ? (
                          <button onClick={() => handleReactivate(c.slug)}
                            style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #86efac", borderRadius: 6, background: "#dcfce7", color: "#16a34a", cursor: "pointer" }}>
                            Reactivate
                          </button>
                        ) : null}
                        <button onClick={() => handleDelete(c.slug, c.name)}
                          disabled={deleting === c.slug}
                          style={{
                            padding: "4px 10px", fontSize: 12, border: "1px solid #dc2626", borderRadius: 6,
                            background: deleting === c.slug ? "#fca5a5" : "#fff",
                            color: "#dc2626", cursor: deleting === c.slug ? "wait" : "pointer", fontWeight: 600,
                          }}>
                          {deleting === c.slug ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No companies found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══ COMPANY DETAILS MODAL ═══ */}
      {selectedCompany && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => { setSelectedCompany(null); setStats(null); }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: 520, maxHeight: "80vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 20 }}>{selectedCompany.name}</h3>
              <StatusBadge status={selectedCompany.status} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14 }}>
              <div><strong>Slug:</strong> <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>{selectedCompany.slug}</code></div>
              <div><strong>Email:</strong> {selectedCompany.email || "\u2014"}</div>
              <div><strong>Phone:</strong> {selectedCompany.phone || "\u2014"}</div>
              <div><strong>Max Devices:</strong> {selectedCompany.max_devices}</div>
              <div><strong>Max Users:</strong> {selectedCompany.max_users}</div>
              <div><strong>Storage:</strong> {selectedCompany.max_storage_mb} MB</div>
              <div style={{ gridColumn: "1 / -1" }}><strong>Created:</strong> {new Date(selectedCompany.created_at).toLocaleString()}</div>
            </div>

            {stats && (
              <div style={{ marginTop: 20, padding: 16, background: "#f9fafb", borderRadius: 12 }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Usage Statistics</h4>
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
                style={{
                  padding: "12px 24px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8,
                  cursor: deleting === selectedCompany.slug ? "wait" : "pointer", fontWeight: 600,
                  opacity: deleting === selectedCompany.slug ? 0.6 : 1,
                }}>
                {deleting === selectedCompany.slug ? "Deleting..." : "Delete Company"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CREATE COMPANY MODAL ═══ */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowCreate(false)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: 560, maxHeight: "90vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20 }}>Onboard New Company</h3>

            {createResult ? (
              <div>
                <div style={{ padding: 16, background: "#dcfce7", borderRadius: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: "#166534", marginBottom: 8 }}>Company Created Successfully!</div>
                  <div style={{ fontSize: 13 }}>
                    <div><strong>Company:</strong> {createResult.company.name} ({createResult.company.slug})</div>
                    <div style={{ marginTop: 8 }}><strong>Admin Username:</strong> <code>{createResult.admin_user.username}</code></div>
                    <div><strong>Temporary Password:</strong> <code style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: 4 }}>{createResult.admin_user.temp_password}</code></div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "#92400e" }}>\u26a0\ufe0f Save this password now \u2014 it will not be shown again.</div>
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
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Company Name *</label>
                    <input name="name" required style={inputStyle} /></div>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Slug * <span style={{ color: "#9ca3af", fontWeight: 400 }}>(url-safe)</span></label>
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
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Storage (MB)</label>
                    <input name="max_storage_mb" type="number" defaultValue={5120} style={inputStyle} /></div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12, borderBottom: "1px solid #e5e7eb", paddingBottom: 8 }}>First Admin User</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Username *</label>
                    <input name="admin_username" required style={inputStyle} /></div>
                  <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Full Name</label>
                    <input name="admin_full_name" style={inputStyle} /></div>
                  <div style={{ gridColumn: "1 / -1" }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email</label>
                    <input name="admin_email" type="email" style={inputStyle} /></div>
                </div>

                {error && <div style={{ padding: 10, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}

                <div style={{ display: "flex", gap: 12 }}>
                  <button type="button" onClick={() => setShowCreate(false)}
                    style={{ flex: 1, padding: 12, background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
                  <button type="submit"
                    style={{ flex: 1, padding: 12, background: "#f59e0b", color: "#0a1628", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                    Create Company
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

const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, boxSizing: "border-box" };
