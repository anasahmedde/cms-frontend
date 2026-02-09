// src/components/PlatformDashboard.js
// Platform-level analytics dashboard for super admin
// Shows company overview, device stats, user counts, charts
import React, { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;

function authHeaders() {
  const token = localStorage.getItem("digix_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// ─── Mini Bar Chart (pure CSS) ───
function MiniBar({ value, max, color = "#3b82f6", height = 8 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ width: "100%", height, background: "#f1f5f9", borderRadius: height / 2, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: height / 2, transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }} />
    </div>
  );
}

// ─── Donut Chart (SVG) ───
function DonutChart({ segments, size = 140, strokeWidth = 18, centerLabel, centerValue }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let offset = 0;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        {segments.map((seg, i) => {
          const pct = total > 0 ? seg.value / total : 0;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const rot = (offset / total) * 360;
          offset += seg.value;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
              stroke={seg.color} strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={circumference / 4}
              transform={`rotate(${rot} ${size / 2} ${size / 2})`}
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
          );
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{centerValue}</div>
        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 2 }}>{centerLabel}</div>
      </div>
    </div>
  );
}

// ─── Horizontal Stacked Bar ───
function StackedBar({ segments, height = 28, showLabels = true }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <div>
      <div style={{ display: "flex", borderRadius: height / 2, overflow: "hidden", height, background: "#f1f5f9" }}>
        {segments.map((seg, i) => {
          const pct = total > 0 ? (seg.value / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div key={i} title={`${seg.label}: ${seg.value}`}
              style={{ width: `${pct}%`, height: "100%", background: seg.color, transition: "width 0.8s ease", minWidth: pct > 0 ? 4 : 0 }} />
          );
        })}
      </div>
      {showLabels && (
        <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
          {segments.map((seg, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: seg.color }} />
              <span>{seg.label}: <strong style={{ color: "#0f172a" }}>{seg.value}</strong></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Status Pill ───
function StatusPill({ status }) {
  const colors = {
    active: { bg: "#dcfce7", text: "#15803d", dot: "#22c55e" },
    suspended: { bg: "#fee2e2", text: "#dc2626", dot: "#ef4444" },
    trial: { bg: "#fef3c7", text: "#d97706", dot: "#f59e0b" },
    cancelled: { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
  };
  const c = colors[status] || colors.cancelled;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: c.bg, fontSize: 11, fontWeight: 600, color: c.text }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot }} />
      {status}
    </span>
  );
}

// ─── Metric Card ───
function MetricCard({ icon, label, value, sub, color, trend }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "22px 20px",
      border: "1px solid #e8ecf1", position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column", gap: 12,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: color, borderRadius: "0 4px 4px 0" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
          {icon}
        </div>
        {trend !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 600, color: trend >= 0 ? "#16a34a" : "#dc2626", background: trend >= 0 ? "#f0fdf4" : "#fef2f2", padding: "2px 8px", borderRadius: 8 }}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Company Row ───
function CompanyRow({ company, maxDevices, onNavigate }) {
  const onlineRate = company.device_count > 0 ? Math.round((company.devices_online / company.device_count) * 100) : 0;

  return (
    <tr style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.background = "#fafbfd"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <td style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${company.status === "active" ? "#3b82f6" : "#94a3b8"} 0%, ${company.status === "active" ? "#1d4ed8" : "#64748b"} 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0,
          }}>
            {(company.name || "?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{company.name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{company.slug}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: "14px 16px" }}><StatusPill status={company.status} /></td>
      <td style={{ padding: "14px 16px", textAlign: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>{company.device_count}</span>
          <div style={{ display: "flex", gap: 6, fontSize: 11 }}>
            <span style={{ color: "#16a34a" }}>● {company.devices_online}</span>
            <span style={{ color: "#94a3b8" }}>● {company.devices_offline}</span>
          </div>
          <MiniBar value={company.device_count} max={maxDevices} color="#3b82f6" />
        </div>
      </td>
      <td style={{ padding: "14px 16px", textAlign: "center" }}>
        <span style={{ fontWeight: 600, color: "#0f172a" }}>{company.user_count}</span>
      </td>
      <td style={{ padding: "14px 16px", textAlign: "center" }}>
        <span style={{ fontWeight: 600, color: "#0f172a" }}>{company.video_count}</span>
      </td>
      <td style={{ padding: "14px 16px", textAlign: "center" }}>
        <span style={{ fontWeight: 600, color: "#0f172a" }}>{company.ad_count}</span>
      </td>
      <td style={{ padding: "14px 16px", textAlign: "center" }}>
        <span style={{ fontWeight: 600, color: "#0f172a" }}>{company.group_count}</span>
      </td>
      <td style={{ padding: "14px 16px", textAlign: "center" }}>
        {company.device_count > 0 ? (
          <span style={{
            padding: "3px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: onlineRate >= 75 ? "#dcfce7" : onlineRate >= 40 ? "#fef3c7" : "#fee2e2",
            color: onlineRate >= 75 ? "#15803d" : onlineRate >= 40 ? "#d97706" : "#dc2626",
          }}>
            {onlineRate}%
          </span>
        ) : (
          <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
        )}
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function PlatformDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [companyFilter, setCompanyFilter] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/platform/dashboard`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setData(d);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading && !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>⚡</div>
          <div style={{ color: "#64748b", fontSize: 14 }}>Loading platform analytics...</div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <div style={{ color: "#dc2626", fontWeight: 600, marginBottom: 8 }}>Failed to load dashboard</div>
        <div style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>{error}</div>
        <button onClick={load} style={{ padding: "8px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const companies = data.companies || [];
  const filteredCompanies = companyFilter
    ? companies.filter(c => c.name.toLowerCase().includes(companyFilter.toLowerCase()) || c.slug.toLowerCase().includes(companyFilter.toLowerCase()))
    : companies;

  const maxDevicesInCompany = Math.max(...companies.map(c => c.device_count), 1);

  // Calculate aggregates
  const activeCompanies = companies.filter(c => c.status === "active").length;
  const companiesWithOnlineDevices = companies.filter(c => c.devices_online > 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ─── Header ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
            Platform Overview
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
            Real-time analytics across all companies
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{
          padding: "8px 16px", background: loading ? "#e5e7eb" : "#f8fafc", border: "1px solid #e5e7eb",
          borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 500, color: "#64748b",
          display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
        }}>
          <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none" }}>↻</span>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* ─── Top Metric Cards ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <MetricCard icon="🏢" label="Total Companies" value={data.total_companies} sub={`${activeCompanies} active`} color="#3b82f6" />
        <MetricCard icon="📱" label="Total Devices" value={data.total_devices} sub={`${data.online_devices} online · ${data.offline_devices} offline`} color="#8b5cf6" />
        <MetricCard icon="👤" label="Company Users" value={data.total_users} sub={`Across ${activeCompanies} companies`} color="#06b6d4" />
        <MetricCard icon="🎬" label="Videos" value={data.total_videos} color="#f59e0b" />
        <MetricCard icon="🖼️" label="Advertisements" value={data.total_advertisements} color="#ec4899" />
        <MetricCard icon="📦" label="Est. Storage" value={`${data.total_storage_used_mb >= 1024 ? (data.total_storage_used_mb / 1024).toFixed(1) + " GB" : data.total_storage_used_mb + " MB"}`} sub={`${data.total_videos + data.total_advertisements} files`} color="#10b981" />
      </div>

      {/* ─── Charts Row ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
        {/* Device Status Donut */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e8ecf1", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>Device Status</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DonutChart
              size={150} strokeWidth={20}
              centerValue={data.total_devices}
              centerLabel="Devices"
              segments={[
                { value: data.online_devices, color: "#22c55e" },
                { value: data.offline_devices, color: "#e2e8f0" },
              ]}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 16, fontSize: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
              Online: <strong>{data.online_devices}</strong>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#e2e8f0" }} />
              Offline: <strong>{data.offline_devices}</strong>
            </span>
          </div>
        </div>

        {/* Company Status Donut */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e8ecf1", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>Company Status</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DonutChart
              size={150} strokeWidth={20}
              centerValue={data.total_companies}
              centerLabel="Companies"
              segments={[
                { value: data.active_companies, color: "#3b82f6" },
                { value: data.trial_companies, color: "#f59e0b" },
                { value: data.suspended_companies, color: "#ef4444" },
              ]}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 16, fontSize: 12, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6" }} />
              Active: <strong>{data.active_companies}</strong>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
              Trial: <strong>{data.trial_companies}</strong>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
              Suspended: <strong>{data.suspended_companies}</strong>
            </span>
          </div>
        </div>

        {/* Content Distribution */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e8ecf1", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>Content Distribution</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                <span>Videos</span><strong style={{ color: "#0f172a" }}>{data.total_videos}</strong>
              </div>
              <MiniBar value={data.total_videos} max={Math.max(data.total_videos, data.total_advertisements, data.total_groups, data.total_shops, 1)} color="#f59e0b" height={10} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                <span>Advertisements</span><strong style={{ color: "#0f172a" }}>{data.total_advertisements}</strong>
              </div>
              <MiniBar value={data.total_advertisements} max={Math.max(data.total_videos, data.total_advertisements, data.total_groups, data.total_shops, 1)} color="#ec4899" height={10} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                <span>Groups</span><strong style={{ color: "#0f172a" }}>{data.total_groups}</strong>
              </div>
              <MiniBar value={data.total_groups} max={Math.max(data.total_videos, data.total_advertisements, data.total_groups, data.total_shops, 1)} color="#8b5cf6" height={10} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                <span>Shops</span><strong style={{ color: "#0f172a" }}>{data.total_shops}</strong>
              </div>
              <MiniBar value={data.total_shops} max={Math.max(data.total_videos, data.total_advertisements, data.total_groups, data.total_shops, 1)} color="#06b6d4" height={10} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Device Distribution Bar ─── */}
      {data.total_devices > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e8ecf1", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Devices by Company</div>
          <StackedBar segments={
            companies
              .filter(c => c.device_count > 0)
              .map((c, i) => {
                const colors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444", "#84cc16"];
                return { label: c.name, value: c.device_count, color: colors[i % colors.length] };
              })
          } height={32} />
        </div>
      )}

      {/* ─── Company Table ─── */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf1", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Companies</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{companies.length} total · {companiesWithOnlineDevices} with active devices</div>
          </div>
          <input
            type="text" placeholder="Search companies..."
            value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
            style={{
              padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13,
              width: 220, outline: "none", color: "#0f172a", background: "#f8fafc",
            }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Company</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Devices</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Users</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Videos</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ads</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Groups</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Health</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
                  {companyFilter ? "No companies match your search" : "No companies found"}
                </td></tr>
              ) : (
                filteredCompanies.map(c => (
                  <CompanyRow key={c.id} company={c} maxDevices={maxDevicesInCompany} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
