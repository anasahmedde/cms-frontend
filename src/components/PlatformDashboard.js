// src/components/PlatformDashboard.js
// Platform-level analytics dashboard for super admin
// Shows company overview, device stats, user counts, notifications, announcements
import React, { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;

function authHeaders() {
  const token = localStorage.getItem("digix_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// ─── Notification Bell Component ───
function NotificationBell({ expiredCompanies = [], expiringCompanies = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const expiredCount = expiredCompanies.length;
  const expiringCount = expiringCompanies.length;
  const totalAlerts = expiredCount + expiringCount;
  const hasUrgent = expiredCount > 0;

  return (
    <div style={{ position: "relative" }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 44, height: 44, borderRadius: 10, 
          border: totalAlerts > 0 ? "2px solid " + (hasUrgent ? "#dc2626" : "#f59e0b") : "1px solid #e5e7eb",
          background: totalAlerts > 0 ? (hasUrgent ? "#fef2f2" : "#fffbeb") : "#f8fafc", 
          cursor: "pointer", 
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, position: "relative",
          animation: hasUrgent ? "bellShake 0.5s ease-in-out infinite" : "none"
        }}
      >
        🔔
        {/* Badge */}
        {totalAlerts > 0 && (
          <span style={{
            position: "absolute", top: -6, right: -6,
            background: hasUrgent ? "#dc2626" : "#f59e0b",
            color: "#fff", fontSize: 11, fontWeight: 700,
            minWidth: 22, height: 22, borderRadius: 11,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #fff",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            animation: hasUrgent ? "pulse 2s ease-in-out infinite" : "none"
          }}>
            {totalAlerts}
          </span>
        )}
      </button>
      
      {/* Dropdown */}
      {isOpen && (
        <>
          <div 
            style={{ position: "fixed", inset: 0, zIndex: 999 }} 
            onClick={() => setIsOpen(false)} 
          />
          <div style={{
            position: "absolute", top: 52, right: 0, width: 380,
            background: "#fff", borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            border: "1px solid #e5e7eb", zIndex: 1000, overflow: "hidden"
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>🔔 Notifications</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {totalAlerts > 0 ? `${totalAlerts} alert${totalAlerts !== 1 ? "s" : ""} requiring attention` : "No alerts"}
              </div>
            </div>
            
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {totalAlerts === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                  <div>All systems operational</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>No companies expired or expiring soon</div>
                </div>
              ) : (
                <>
                  {/* Expired Companies */}
                  {expiredCount > 0 && (
                    <div>
                      <div style={{ padding: "12px 20px", background: "#fef2f2", borderBottom: "1px solid #fecaca", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>🚨</span>
                        <span style={{ fontWeight: 700, color: "#dc2626", fontSize: 13 }}>EXPIRED ({expiredCount})</span>
                      </div>
                      {expiredCompanies.map((c, i) => (
                        <div key={i} style={{ padding: "12px 20px", borderBottom: "1px solid #fee2e2", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
                          <div>
                            <div style={{ fontWeight: 600, color: "#1f2937", fontSize: 13 }}>{c.company_name}</div>
                            <div style={{ fontSize: 11, color: "#dc2626" }}>Expired {c.days_since_expiration || 0} days ago</div>
                          </div>
                          <span style={{ fontSize: 10, color: "#fff", background: "#dc2626", padding: "3px 8px", borderRadius: 4, fontWeight: 700 }}>BLOCKED</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Expiring Soon */}
                  {expiringCount > 0 && (
                    <div>
                      <div style={{ padding: "12px 20px", background: "#fffbeb", borderBottom: "1px solid #fcd34d", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>⏰</span>
                        <span style={{ fontWeight: 700, color: "#92400e", fontSize: 13 }}>EXPIRING SOON ({expiringCount})</span>
                      </div>
                      {expiringCompanies.slice(0, 5).map((c, i) => (
                        <div key={i} style={{ padding: "12px 20px", borderBottom: "1px solid #fef3c7", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
                          <div>
                            <div style={{ fontWeight: 600, color: "#1f2937", fontSize: 13 }}>{c.company_name}</div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>
                              {c.status === "grace_period" ? "In grace period" : `Expires ${c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "soon"}`}
                            </div>
                          </div>
                          <span style={{ 
                            padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: (c.days_until_expiration || 0) <= 7 ? "#dc2626" : "#f59e0b",
                            color: "#fff"
                          }}>
                            {c.days_until_expiration || 0}d
                          </span>
                        </div>
                      ))}
                      {expiringCount > 5 && (
                        <div style={{ padding: "10px 20px", textAlign: "center", fontSize: 12, color: "#64748b", background: "#fffbeb" }}>
                          +{expiringCount - 5} more...
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
      
      <style>{`
        @keyframes bellShake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(15deg); }
          75% { transform: rotate(-15deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}

// ─── Sliding Announcement Banner ───
function SlidingBanner({ text, type = "info", onClose }) {
  if (!text) return null;
  
  const colors = {
    error: { bg: "linear-gradient(90deg, #dc2626, #b91c1c)", text: "#fff" },
    warning: { bg: "linear-gradient(90deg, #f59e0b, #d97706)", text: "#0a1628" },
    info: { bg: "linear-gradient(90deg, #3b82f6, #1d4ed8)", text: "#fff" },
  };
  const c = colors[type] || colors.info;
  
  return (
    <div style={{ 
      background: c.bg, 
      padding: "12px 20px",
      borderRadius: 10,
      overflow: "hidden",
      position: "relative",
      display: "flex",
      alignItems: "center"
    }}>
      <div style={{
        flex: 1,
        overflow: "hidden"
      }}>
        <div style={{
          display: "inline-block",
          animation: "slideText 25s linear infinite",
          whiteSpace: "nowrap",
          color: c.text,
          fontWeight: 600,
          fontSize: 14,
          paddingLeft: "100%"
        }}>
          {text} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {text}
        </div>
      </div>
      {onClose && (
        <button onClick={onClose} style={{ 
          background: "rgba(255,255,255,0.2)", 
          border: "none", 
          color: c.text, 
          padding: "4px 10px", 
          borderRadius: 6, 
          cursor: "pointer",
          marginLeft: 12,
          fontSize: 12,
          fontWeight: 600
        }}>
          ✕
        </button>
      )}
      <style>{`
        @keyframes slideText {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ─── Metric Card ───
function MetricCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "20px",
      border: "1px solid #e8ecf1", position: "relative", overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: color, borderRadius: "0 4px 4px 0" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Company Status List Card ───
function CompanyStatusCard({ companies = [] }) {
  // Sort: expired first, then by days until expiration, then by last activity
  const sortedCompanies = [...companies].sort((a, b) => {
    // Expired companies first
    if (a.expiration_status === "expired" && b.expiration_status !== "expired") return -1;
    if (b.expiration_status === "expired" && a.expiration_status !== "expired") return 1;
    // Then grace period
    if (a.expiration_status === "grace_period" && b.expiration_status !== "grace_period") return -1;
    if (b.expiration_status === "grace_period" && a.expiration_status !== "grace_period") return 1;
    // Then by days until expiration (ascending)
    const aDays = a.days_until_expiration ?? 9999;
    const bDays = b.days_until_expiration ?? 9999;
    return aDays - bDays;
  });

  const getStatusBadge = (company) => {
    const status = company.expiration_status || "active";
    if (status === "expired") {
      return { bg: "#dc2626", text: "#fff", label: "EXPIRED" };
    }
    if (status === "grace_period") {
      return { bg: "#f59e0b", text: "#fff", label: "GRACE" };
    }
    if (status === "suspended") {
      return { bg: "#6b7280", text: "#fff", label: "SUSPENDED" };
    }
    if (company.days_until_expiration !== null && company.days_until_expiration <= 7) {
      return { bg: "#fef2f2", text: "#dc2626", label: `${company.days_until_expiration}d left` };
    }
    if (company.days_until_expiration !== null && company.days_until_expiration <= 30) {
      return { bg: "#fffbeb", text: "#b45309", label: `${company.days_until_expiration}d left` };
    }
    return { bg: "#dcfce7", text: "#166534", label: "ACTIVE" };
  };

  const formatLastActivity = (company) => {
    const lastActive = company.last_activity || company.created_at;
    if (!lastActive) return "No activity";
    
    const now = new Date();
    const then = new Date(lastActive);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 5) return "Active now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf1", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>📋 Company Status</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{companies.length} total companies</div>
        </div>
      </div>
      
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "10px 20px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
        <div>Company</div>
        <div style={{ textAlign: "center" }}>Status</div>
        <div style={{ textAlign: "center" }}>Expires</div>
        <div style={{ textAlign: "center" }}>Devices</div>
        <div style={{ textAlign: "center" }}>Last Activity</div>
      </div>
      
      {/* Rows */}
      <div style={{ maxHeight: 350, overflowY: "auto" }}>
        {sortedCompanies.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No companies found</div>
        ) : (
          sortedCompanies.map((company, i) => {
            const badge = getStatusBadge(company);
            return (
              <div key={company.id || i} style={{ 
                display: "grid", 
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", 
                padding: "12px 20px", 
                borderBottom: "1px solid #f1f5f9",
                alignItems: "center",
                background: company.expiration_status === "expired" ? "#fef2f2" : 
                           company.expiration_status === "grace_period" ? "#fffbeb" : "#fff"
              }}>
                {/* Company Name */}
                <div>
                  <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 13 }}>{company.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{company.slug}</div>
                </div>
                
                {/* Status Badge */}
                <div style={{ textAlign: "center" }}>
                  <span style={{ 
                    padding: "4px 10px", 
                    borderRadius: 6, 
                    fontSize: 10, 
                    fontWeight: 700,
                    background: badge.bg,
                    color: badge.text
                  }}>
                    {badge.label}
                  </span>
                </div>
                
                {/* Expiration Date */}
                <div style={{ textAlign: "center", fontSize: 12, color: "#64748b" }}>
                  {company.expires_at ? new Date(company.expires_at).toLocaleDateString() : "∞ Never"}
                </div>
                
                {/* Devices */}
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>{company.device_count || 0}</span>
                  {company.devices_online > 0 && (
                    <span style={{ fontSize: 10, color: "#16a34a", marginLeft: 4 }}>({company.devices_online} on)</span>
                  )}
                </div>
                
                {/* Last Activity */}
                <div style={{ textAlign: "center", fontSize: 12, color: "#64748b" }}>
                  {formatLastActivity(company)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Announcement Manager Modal ───
function AnnouncementModal({ isOpen, onClose, currentAnnouncement, onSave }) {
  const [text, setText] = useState(currentAnnouncement?.text || "");
  const [type, setType] = useState(currentAnnouncement?.type || "info");
  
  useEffect(() => {
    setText(currentAnnouncement?.text || "");
    setType(currentAnnouncement?.type || "info");
  }, [currentAnnouncement, isOpen]);
  
  if (!isOpen) return null;
  
  const handleSave = () => {
    onSave({ text: text.trim(), type });
    onClose();
  };
  
  const handleClear = () => {
    onSave({ text: "", type: "info" });
    onClose();
  };
  
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000 }} onClick={onClose} />
      <div style={{ 
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: "#fff", borderRadius: 16, padding: 24, width: 500, maxWidth: "90vw",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)", zIndex: 1001
      }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          📢 Publish Announcement
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#374151" }}>
            Announcement Text
          </label>
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your announcement message... (e.g., Scheduled maintenance on Sunday 2AM-4AM)"
            style={{ 
              width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", 
              fontSize: 14, minHeight: 80, resize: "vertical", boxSizing: "border-box"
            }}
          />
        </div>
        
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#374151" }}>
            Banner Type
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { value: "info", label: "ℹ️ Info", color: "#3b82f6" },
              { value: "warning", label: "⚠️ Warning", color: "#f59e0b" },
              { value: "error", label: "🚨 Critical", color: "#dc2626" },
            ].map(t => (
              <button 
                key={t.value}
                onClick={() => setType(t.value)}
                style={{ 
                  flex: 1, padding: "10px 16px", borderRadius: 8, 
                  border: type === t.value ? `2px solid ${t.color}` : "1px solid #e5e7eb",
                  background: type === t.value ? `${t.color}15` : "#fff",
                  cursor: "pointer", fontWeight: 600, fontSize: 13,
                  color: type === t.value ? t.color : "#64748b"
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Preview */}
        {text && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#374151" }}>
              Preview
            </label>
            <SlidingBanner text={text} type={type} />
          </div>
        )}
        
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {currentAnnouncement?.text && (
            <button onClick={handleClear} style={{ 
              padding: "10px 20px", background: "#fee2e2", color: "#dc2626", 
              border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" 
            }}>
              Clear Announcement
            </button>
          )}
          <button onClick={onClose} style={{ 
            padding: "10px 20px", background: "#f1f5f9", color: "#64748b", 
            border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" 
          }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!text.trim()} style={{ 
            padding: "10px 20px", background: text.trim() ? "#3b82f6" : "#e5e7eb", 
            color: text.trim() ? "#fff" : "#9ca3af", 
            border: "none", borderRadius: 8, fontWeight: 600, cursor: text.trim() ? "pointer" : "not-allowed" 
          }}>
            Publish
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function PlatformDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [announcement, setAnnouncement] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("digix_announcement")) || { text: "", type: "info" };
    } catch { return { text: "", type: "info" }; }
  });
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

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

  const handleSaveAnnouncement = (ann) => {
    setAnnouncement(ann);
    localStorage.setItem("digix_announcement", JSON.stringify(ann));
  };

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
  const expiredCompanies = data.expired_companies_list || [];
  const expiringCompanies = data.expiring_companies || [];
  const expiredCount = data.expired_companies || 0;
  const activeCompanies = data.active_companies || 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      
      {/* ─── Custom Announcement Banner (Super Admin Published) ─── */}
      {announcement.text && (
        <SlidingBanner 
          text={announcement.text} 
          type={announcement.type} 
          onClose={() => handleSaveAnnouncement({ text: "", type: "info" })}
        />
      )}
      
      {/* ─── Expired Companies Alert Banner ─── */}
      {expiredCount > 0 && (
        <div style={{ 
          background: "linear-gradient(90deg, #dc2626, #b91c1c)", 
          padding: "14px 20px",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#fff"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>🚨</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {expiredCount} Company{expiredCount > 1 ? "ies" : ""} Expired!
              </div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Users blocked, devices showing enrollment screen. Take action now!
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {expiredCompanies.slice(0, 3).map((c, i) => (
              <span key={i} style={{ 
                background: "rgba(255,255,255,0.2)", 
                padding: "4px 10px", 
                borderRadius: 6, 
                fontSize: 12, 
                fontWeight: 600 
              }}>
                {c.company_name}
              </span>
            ))}
            {expiredCount > 3 && (
              <span style={{ 
                background: "rgba(255,255,255,0.2)", 
                padding: "4px 10px", 
                borderRadius: 6, 
                fontSize: 12, 
                fontWeight: 600 
              }}>
                +{expiredCount - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── Header with Notification Bell ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
            Platform Overview
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
            Real-time analytics across all companies
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Publish Announcement Button */}
          <button 
            onClick={() => setShowAnnouncementModal(true)}
            style={{
              padding: "10px 16px", background: "#f8fafc", border: "1px solid #e5e7eb",
              borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#64748b",
              display: "flex", alignItems: "center", gap: 6
            }}
          >
            📢 Announce
          </button>
          
          {/* Notification Bell */}
          <NotificationBell 
            expiredCompanies={expiredCompanies} 
            expiringCompanies={expiringCompanies} 
          />
          
          {/* Refresh Button */}
          <button onClick={load} disabled={loading} style={{
            padding: "10px 16px", background: loading ? "#e5e7eb" : "#f8fafc", border: "1px solid #e5e7eb",
            borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 500, color: "#64748b",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none" }}>↻</span>
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* ─── Top Metric Cards ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <MetricCard icon="🏢" label="Total Companies" value={data.total_companies} sub={`${activeCompanies} active`} color="#3b82f6" />
        <MetricCard icon="📱" label="Total Devices" value={data.total_devices} sub={`${data.online_devices} online`} color="#8b5cf6" />
        <MetricCard icon="👤" label="Users" value={data.total_users} color="#06b6d4" />
        <MetricCard icon="🎬" label="Videos" value={data.total_videos} color="#f59e0b" />
        <MetricCard icon="🖼️" label="Ads" value={data.total_advertisements} color="#ec4899" />
        {expiredCount > 0 && (
          <MetricCard icon="🚨" label="Expired" value={expiredCount} sub="Needs attention!" color="#dc2626" />
        )}
      </div>

      {/* ─── Company Status List ─── */}
      <CompanyStatusCard companies={companies} />

      {/* ─── Announcement Modal ─── */}
      <AnnouncementModal 
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        currentAnnouncement={announcement}
        onSave={handleSaveAnnouncement}
      />
      
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
