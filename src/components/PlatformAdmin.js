// src/components/PlatformAdmin.js
// Platform-level admin panel for managing companies (tenants)
import React, { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;

function authHeaders() {
  const token = localStorage.getItem("digix_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function PlatformAdmin({ onImpersonate }) {
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

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`${API_BASE}/platform/companies?${params}`, { headers: authHeaders() });
      const data = await res.json();
      setCompanies(data.items || []);
    } catch (err) {
      setError("Failed to load companies");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const fetchStats = async (slug) => {
    try {
      const res = await fetch(`${API_BASE}/platform/companies/${slug}/stats`, { headers: authHeaders() });
      const data = await res.json();
      setStats(data);
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
      fetchCompanies();
    } catch (err) { setError(err.message); }
  };

  const handleSuspend = async (slug) => {
    if (!window.confirm(`Suspend company "${slug}"? All users will be logged out.`)) return;
    try {
      const res = await fetch(`${API_BASE}/platform/companies/${slug}/suspend`, { method: "POST", headers: authHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setSuccess(`Company "${slug}" suspended`);
      fetchCompanies();
    } catch (err) { setError(err.message); }
  };

  const handleReactivate = async (slug) => {
    try {
      const res = await fetch(`${API_BASE}/platform/companies/${slug}/reactivate`, { method: "POST", headers: authHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setSuccess(`Company "${slug}" reactivated`);
      fetchCompanies();
    } catch (err) { setError(err.message); }
  };

  const handleImpersonate = async (slug) => {
    try {
      const res = await fetch(`${API_BASE}/platform/impersonate`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ company_slug: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setSuccess(`Now impersonating "${data.company.name}". Reload to see their data.`);
    } catch (err) { setError(err.message); }
  };

  const statusBadge = (status) => {
    const colors = { active: "#16a34a", suspended: "#dc2626", trial: "#f59e0b", cancelled: "#6b7280" };
    return (
      <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
        background: `${colors[status] || "#6b7280"}20`, color: colors[status] || "#6b7280", textTransform: "uppercase" }}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Platform Administration</h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>Manage companies and tenants</p>
        </div>
        <button onClick={() => { setShowCreate(true); setCreateResult(null); setError(""); }}
          style={{ padding: "10px 20px", background: "#f59e0b", color: "#0a1628", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
          + New Company
        </button>
      </div>

      {error && <div style={{ padding: 12, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 16 }}>{error}
        <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", color: "#dc2626", cursor: "pointer" }}>✕</button></div>}
      {success && <div style={{ padding: 12, background: "#dcfce7", color: "#166534", borderRadius: 8, marginBottom: 16 }}>{success}
        <button onClick={() => setSuccess("")} style={{ float: "right", background: "none", border: "none", color: "#166534", cursor: "pointer" }}>✕</button></div>}

      {/* Filters */}
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

      {/* Companies Table */}
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
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{c.email || "—"}</div>
                </td>
                <td style={{ padding: "12px", fontFamily: "monospace", fontSize: 13 }}>{c.slug}</td>
                <td style={{ padding: "12px" }}>{statusBadge(c.status)}</td>
                <td style={{ padding: "12px", fontSize: 12, color: "#6b7280" }}>
                  {c.max_devices} devices · {c.max_users} users
                </td>
                <td style={{ padding: "12px", fontSize: 12, color: "#6b7280" }}>
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: "12px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setSelectedCompany(c); fetchStats(c.slug); }}
                      style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: "pointer" }}>
                      Details
                    </button>
                    <button onClick={() => {
                        if (onImpersonate) { onImpersonate(c.slug, c.name); }
                        else { handleImpersonate(c.slug); }
                      }}
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

      {/* Company Details Modal */}
      {selectedCompany && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => { setSelectedCompany(null); setStats(null); }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: 500, maxHeight: "80vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20 }}>{selectedCompany.name}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><strong>Slug:</strong> {selectedCompany.slug}</div>
              <div><strong>Status:</strong> {statusBadge(selectedCompany.status)}</div>
              <div><strong>Email:</strong> {selectedCompany.email || "—"}</div>
              <div><strong>Phone:</strong> {selectedCompany.phone || "—"}</div>
              <div><strong>Max Devices:</strong> {selectedCompany.max_devices}</div>
              <div><strong>Max Users:</strong> {selectedCompany.max_users}</div>
              <div><strong>Storage:</strong> {selectedCompany.max_storage_mb} MB</div>
              <div><strong>Created:</strong> {new Date(selectedCompany.created_at).toLocaleDateString()}</div>
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
            <button onClick={() => { setSelectedCompany(null); setStats(null); }}
              style={{ marginTop: 20, width: "100%", padding: 12, background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Create Company Modal */}
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
                    <div style={{ marginTop: 8, fontSize: 12, color: "#92400e" }}>⚠️ Save this password now — it will not be shown again.</div>
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
