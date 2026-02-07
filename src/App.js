// src/App.js - DIGIX Dashboard with Sidebar Layout & Role-Based Access Control
import React, { useEffect, useState, createContext, useContext, useCallback } from "react";
import Device from "./components/Device";
import Group from "./components/Group";
import Shop from "./components/Shop";
import Video from "./components/Video";
import Advertisement from "./components/Advertisement";
import RecentLinks from "./components/RecentLinks";
import GroupLinkedVideo from "./components/GroupLinkedVideo";
import Reports from "./components/Reports";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;

// Role-based permissions mapping
const ROLE_PERMISSIONS = {
  admin: ["view_dashboard", "manage_devices", "manage_groups", "manage_shops", "upload_videos", "manage_videos", "manage_links", "manage_users", "view_reports", "export_data"],
  manager: ["view_dashboard", "manage_devices", "manage_groups", "manage_shops", "upload_videos", "manage_videos", "manage_links", "view_reports", "export_data"],
  editor: ["view_dashboard", "upload_videos", "manage_videos", "manage_links", "view_reports"],
  viewer: ["view_dashboard", "view_reports"],
};

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Theme Context for Dark/Light mode
const ThemeContext = createContext({ isDark: false, toggle: () => {}, theme: {} });
export const useTheme = () => useContext(ThemeContext);

// DIGIX Brand Colors - Deep blue primary with amber/orange accent
const BRAND = {
  primary: "#0a1628",      // Deep navy blue (from logo background)
  primaryLight: "#1e3a5f", // Lighter navy
  accent: "#f59e0b",       // Amber/Orange accent
  accentHover: "#d97706",  // Darker amber for hover
  accentLight: "#fbbf24",  // Lighter amber
  gradient: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)", // Orange gradient
  gradientBlue: "linear-gradient(135deg, #0a1628 0%, #1e3a5f 100%)", // Blue gradient
};

// Theme colors - comprehensive dark mode support
const themes = {
  light: {
    bg: "#f0f4f8",
    card: "#fff",
    cardAlt: "#f9fafb",
    sidebar: BRAND.primary,
    sidebarHover: "rgba(245, 158, 11, 0.15)",
    sidebarActive: "rgba(245, 158, 11, 0.25)",
    text: "#1e293b",
    textSecondary: "#64748b",
    border: "#e5e7eb",
    headerBg: "#fff",
    inputBg: "#fff",
    inputBorder: "#e5e7eb",
    tableBg: "#fff",
    tableRowHover: "#f9fafb",
    tableHeader: "#f9fafb",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#3b82f6",
    accent: BRAND.accent,
    accentHover: BRAND.accentHover,
  },
  dark: {
    bg: "#0f172a",
    card: "#1e293b",
    cardAlt: "#334155",
    sidebar: BRAND.primary,
    sidebarHover: "rgba(245, 158, 11, 0.15)",
    sidebarActive: "rgba(245, 158, 11, 0.25)",
    text: "#f1f5f9",
    textSecondary: "#94a3b8",
    border: "#475569",
    headerBg: "#1e293b",
    inputBg: "#334155",
    inputBorder: "#475569",
    tableBg: "#1e293b",
    tableRowHover: "#334155",
    tableHeader: "#334155",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#3b82f6",
    accent: BRAND.accent,
    accentHover: BRAND.accentHover,
  }
};

/* ======================== Modal ======================== */
function Modal({ open, title, onClose, children, size = "lg" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  const sizes = { sm: "480px", md: "640px", lg: "900px", xl: "1100px" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: `min(95vw, ${sizes[size]})`, maxHeight: "90vh", background: "#fff", borderRadius: 16, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", background: BRAND.primary, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 18, cursor: "pointer", transition: "background 0.2s" }} onMouseOver={(e) => e.target.style.background = BRAND.accent} onMouseOut={(e) => e.target.style.background = "rgba(255,255,255,0.1)"}>✕</button>
        </div>
        <div style={{ padding: 20, overflow: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

/* ======================== Login ======================== */
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");
      localStorage.setItem("digix_token", data.token);
      localStorage.setItem("digix_user", JSON.stringify(data));
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.gradientBlue }}>
      <div style={{ width: 420, background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 25px 80px rgba(0,0,0,0.5)" }}>
        {/* Logo Header Section with Dark Background */}
        <div style={{ background: BRAND.primary, padding: "40px 40px 32px", textAlign: "center" }}>
          <img src="/digix-logo.png" alt="DIGIX" style={{ height: 50, marginBottom: 12, filter: "drop-shadow(0 4px 20px rgba(245,158,11,0.4))" }} />
          <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Digital Signage Management</p>
        </div>
        
        {/* Form Section */}
        <div style={{ padding: "32px 40px 40px" }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151", fontSize: 14 }}>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" style={{ width: "100%", padding: "14px 16px", borderRadius: 10, border: "2px solid #e5e7eb", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }} onFocus={(e) => e.target.style.borderColor = BRAND.accent} onBlur={(e) => e.target.style.borderColor = "#e5e7eb"} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151", fontSize: 14 }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" style={{ width: "100%", padding: "14px 16px", borderRadius: 10, border: "2px solid #e5e7eb", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }} onFocus={(e) => e.target.style.borderColor = BRAND.accent} onBlur={(e) => e.target.style.borderColor = "#e5e7eb"} />
            </div>
            {error && <div style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 14, marginBottom: 20 }}>⚠️ {error}</div>}
            <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "#94a3b8" : BRAND.gradient, border: "none", borderRadius: 10, color: "#fff", fontSize: 16, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 4px 20px rgba(245,158,11,0.4)", transition: "all 0.2s" }}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <div style={{ marginTop: 24, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
            © 2025 DIGIX. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================== User Management ======================== */
function UserManagement({ onUserDeactivated }) {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [form, setForm] = useState({ username: "", password: "", email: "", full_name: "", role: "viewer" });
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem("digix_token");
      const res = await fetch(`${API_BASE}/users`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        onUserDeactivated && onUserDeactivated();
        return;
      }
      const data = await res.json();
      setUsers(data.items || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const token = localStorage.getItem("digix_token");
      const res = await fetch(`${API_BASE}/users`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Failed"); }
      setShowCreate(false);
      setForm({ username: "", password: "", email: "", full_name: "", role: "viewer" });
      loadUsers();
    } catch (err) { setError(err.message); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const token = localStorage.getItem("digix_token");
      const res = await fetch(`${API_BASE}/users/${editUser.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ email: form.email, full_name: form.full_name, role: form.role, is_active: form.is_active }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Failed"); }
      setEditUser(null);
      loadUsers();
    } catch (err) { setError(err.message); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    try {
      const token = localStorage.getItem("digix_token");
      const res = await fetch(`${API_BASE}/users/${resetPasswordUser.id}/reset-password?new_password=${encodeURIComponent(newPassword)}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Failed"); }
      setResetPasswordUser(null);
      setNewPassword("");
      alert("Password reset successfully!");
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user? They will be immediately logged out.")) return;
    try {
      const token = localStorage.getItem("digix_token");
      await fetch(`${API_BASE}/users/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      loadUsers();
    } catch (err) { alert(err.message); }
  };

  if (!hasPermission("manage_users")) {
    return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>You don't have permission to manage users.</div>;
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ margin: 0 }}>Users ({users.length})</h3>
        <button onClick={() => setShowCreate(true)} style={{ padding: "10px 20px", background: BRAND.gradient, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, boxShadow: "0 2px 8px rgba(245,158,11,0.3)" }}>+ Add User</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: "#f8fafc" }}>
          <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Username</th>
          <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Name</th>
          <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Role</th>
          <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Status</th>
          <th style={{ padding: 12, textAlign: "right", borderBottom: "2px solid #e5e7eb" }}>Actions</th>
        </tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}><strong>{u.username}</strong><br/><span style={{ color: "#64748b", fontSize: 12 }}>{u.email}</span></td>
              <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>{u.full_name || "—"}</td>
              <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}><span style={{ padding: "4px 10px", borderRadius: 20, background: u.role === "admin" ? "#fef3c7" : u.role === "manager" ? "#dbeafe" : u.role === "editor" ? "#d1fae5" : "#f3f4f6", color: u.role === "admin" ? "#92400e" : u.role === "manager" ? "#1e40af" : u.role === "editor" ? "#065f46" : "#374151", fontSize: 12, fontWeight: 600 }}>{u.role}</span></td>
              <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}><span style={{ padding: "4px 10px", borderRadius: 20, background: u.is_active ? "#dcfce7" : "#fee2e2", color: u.is_active ? "#166534" : "#dc2626", fontSize: 12, fontWeight: 600 }}>{u.is_active ? "Active" : "Inactive"}</span></td>
              <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>
                <button onClick={() => { setEditUser(u); setForm({ email: u.email || "", full_name: u.full_name || "", role: u.role, is_active: u.is_active }); setError(""); }} style={{ padding: "6px 12px", background: "#f1f5f9", border: "none", borderRadius: 6, cursor: "pointer", marginRight: 8 }}>Edit</button>
                <button onClick={() => { setResetPasswordUser(u); setNewPassword(""); setError(""); }} style={{ padding: "6px 12px", background: "#fef3c7", color: "#92400e", border: "none", borderRadius: 6, cursor: "pointer", marginRight: 8 }}>🔑 Reset</button>
                {u.username !== "admin" && <button onClick={() => handleDelete(u.id)} style={{ padding: "6px 12px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, cursor: "pointer" }}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={showCreate} title="Create User" onClose={() => setShowCreate(false)} size="sm">
        <form onSubmit={handleCreate}>
          <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Username *</label><input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} /></div>
          <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Password *</label><input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} /></div>
          <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} /></div>
          <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Full Name</label><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} /></div>
          <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Role</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }}><option value="viewer">Viewer (View only)</option><option value="editor">Editor (Upload/Manage videos)</option><option value="manager">Manager (Full access except users)</option><option value="admin">Admin (Full access)</option></select></div>
          {error && <div style={{ padding: 10, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 16 }}>{error}</div>}
          <button type="submit" style={{ width: "100%", padding: 12, background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Create User</button>
        </form>
      </Modal>
      <Modal open={!!editUser} title="Edit User" onClose={() => setEditUser(null)} size="sm">
        <form onSubmit={handleUpdate}>
          <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} /></div>
          <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Full Name</label><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} /></div>
          <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Role</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="manager">Manager</option><option value="admin">Admin</option></select></div>
          <div style={{ marginBottom: 16 }}><label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /><span>Active (Unchecking will immediately log out the user)</span></label></div>
          {error && <div style={{ padding: 10, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 16 }}>{error}</div>}
          <button type="submit" style={{ width: "100%", padding: 12, background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Save Changes</button>
        </form>
      </Modal>
      <Modal open={!!resetPasswordUser} title={`Reset Password - ${resetPasswordUser?.username}`} onClose={() => setResetPasswordUser(null)} size="sm">
        <form onSubmit={handleResetPassword}>
          <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>New Password *</label><input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password (min 6 chars)" style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} /></div>
          {error && <div style={{ padding: 10, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 16 }}>{error}</div>}
          <button type="submit" style={{ width: "100%", padding: 12, background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Reset Password</button>
        </form>
      </Modal>
    </div>
  );
}

/* ======================== Change Own Password ======================== */
function ChangePasswordModal({ open, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword.length < 6) { setError("New password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    try {
      const token = localStorage.getItem("digix_token");
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Failed"); }
      setSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => onClose(), 1500);
    } catch (err) { setError(err.message); }
  };

  if (!open) return null;

  return (
    <Modal open={open} title="🔐 Change Password" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Current Password *</label><input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} /></div>
        <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>New Password *</label><input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} /></div>
        <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Confirm New Password *</label><input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} /></div>
        {error && <div style={{ padding: 10, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 16 }}>{error}</div>}
        {success && <div style={{ padding: 10, background: "#dcfce7", color: "#166534", borderRadius: 8, marginBottom: 16 }}>{success}</div>}
        <button type="submit" style={{ width: "100%", padding: 12, background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Change Password</button>
      </form>
    </Modal>
  );
}

/* ======================== Sidebar ======================== */
function Sidebar({ currentPage, setCurrentPage, user, onLogout, onChangePassword, hasPermission, isDark, toggleTheme }) {
  const menuItems = [];
  
  // Always show dashboard
  menuItems.push({ id: "dashboard", icon: "📊", label: "Dashboard" });
  
  // Show based on permissions
  if (hasPermission("manage_devices")) {
    menuItems.push({ id: "devices", icon: "📱", label: "Devices" });
  }
  if (hasPermission("manage_videos") || hasPermission("upload_videos")) {
    menuItems.push({ id: "videos", icon: "🎬", label: "Videos" });
  }
  if (hasPermission("manage_videos") || hasPermission("upload_videos")) {
    menuItems.push({ id: "advertisements", icon: "🖼️", label: "Advertisements" });
  }
  if (hasPermission("manage_groups")) {
    menuItems.push({ id: "groups", icon: "👥", label: "Groups" });
  }
  if (hasPermission("manage_shops")) {
    menuItems.push({ id: "shops", icon: "🏪", label: "Shops" });
  }
  if (hasPermission("manage_links")) {
    menuItems.push({ id: "links", icon: "🔗", label: "Link Content" });
  }
  if (hasPermission("view_reports")) {
    menuItems.push({ id: "reports", icon: "📈", label: "Reports" });
  }
  if (hasPermission("manage_users")) {
    menuItems.push({ id: "users", icon: "👤", label: "Users" });
  }

  const sidebarBg = BRAND.primary;

  return (
    <div style={{ width: 260, background: sidebarBg, minHeight: "100vh", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0 }}>
      <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(245,158,11,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/digix-logo.png" alt="DIGIX" style={{ height: 32, filter: "brightness(0) invert(1)" }} />
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 8 }}>Digital Signage Platform</div>
      </div>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(245,158,11,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>{(user?.full_name || user?.username || "U")[0].toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.full_name || user?.username}</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, textTransform: "capitalize" }}>{user?.role}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={onChangePassword} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", border: "none", borderRadius: 8, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: 11, fontWeight: 500 }}><span>🔐</span> Password</button>
          <button onClick={toggleTheme} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 12px", border: "none", borderRadius: 8, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: 14 }} title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}>
            {isDark ? "☀️" : "🌙"}
          </button>
        </div>
      </div>
      <nav style={{ flex: 1, padding: "16px 12px" }}>
        {menuItems.map((item) => (
          <button key={item.id} onClick={() => setCurrentPage(item.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", marginBottom: 4, border: "none", borderRadius: 10, background: currentPage === item.id ? "rgba(245,158,11,0.2)" : "transparent", color: currentPage === item.id ? "#f59e0b" : "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 14, fontWeight: currentPage === item.id ? 600 : 500, textAlign: "left", transition: "all 0.2s", borderLeft: currentPage === item.id ? "3px solid #f59e0b" : "3px solid transparent" }}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(245,158,11,0.2)" }}>
        <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", border: "none", borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#fca5a5", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }}><span>🚪</span> Logout</button>
      </div>
    </div>
  );
}

/* ======================== Dashboard ======================== */
function Dashboard({ user, onLogout }) {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [openModal, setOpenModal] = useState(null);
  const [linksRefresh, setLinksRefresh] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("digix_theme") === "dark");

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const newVal = !prev;
      localStorage.setItem("digix_theme", newVal ? "dark" : "light");
      return newVal;
    });
  }, []);

  const theme = isDark ? themes.dark : themes.light;

  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);

  // Calculate permissions based on role
  const hasPermission = useCallback((perm) => {
    const perms = ROLE_PERMISSIONS[user?.role] || [];
    return user?.role === "admin" || perms.includes(perm);
  }, [user?.role]);

  // Session validation - check every 30 seconds
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = localStorage.getItem("digix_token");
        if (!token) { onLogout(); return; }
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401 || res.status === 403) {
          alert("Your session has expired or your account has been deactivated.");
          onLogout();
        }
      } catch (err) { console.error("Session check failed:", err); }
    };
    const interval = setInterval(checkSession, 30000);
    return () => clearInterval(interval);
  }, [onLogout]);

  return (
    <AuthContext.Provider value={{ user, hasPermission }}>
      <ThemeContext.Provider value={{ isDark, toggle: toggleTheme, theme }}>
      <div style={{ display: "flex", minHeight: "100vh", background: theme.bg }}>
        <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} user={user} onLogout={onLogout} onChangePassword={() => setShowChangePassword(true)} hasPermission={hasPermission} isDark={isDark} toggleTheme={toggleTheme} />
        <div style={{ flex: 1, marginLeft: 260 }}>
          <header style={{ background: theme.headerBg, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}`, position: "sticky", top: 0, zIndex: 100 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: theme.text }}>
              {currentPage === "dashboard" ? "Dashboard" : currentPage === "devices" ? "Devices" : currentPage === "videos" ? "Videos" : currentPage === "advertisements" ? "Advertisements" : currentPage === "groups" ? "Groups" : currentPage === "shops" ? "Shops" : currentPage === "links" ? "Link Content" : currentPage === "reports" ? "Reports" : currentPage === "users" ? "User Management" : "Dashboard"}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{currentTime.toLocaleTimeString()}</div><div style={{ fontSize: 12, color: theme.textSecondary }}>{currentTime.toLocaleDateString()}</div></div>
            </div>
          </header>
          <main style={{ padding: 24 }}>
            {currentPage === "dashboard" && (
              <div>
                {/* Quick Action Cards - Only show based on permissions */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
                  {hasPermission("manage_devices") && (
                    <button onClick={() => setOpenModal("device")} style={{ padding: 20, background: theme.card, border: "none", borderRadius: 12, cursor: "pointer", textAlign: "left", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📱</div><div style={{ fontWeight: 600, color: theme.text }}>Manage Devices</div><div style={{ fontSize: 12, color: theme.textSecondary }}>Add or edit devices</div></button>
                  )}
                  {hasPermission("upload_videos") && (
                    <button onClick={() => setOpenModal("video")} style={{ padding: 20, background: theme.card, border: "none", borderRadius: 12, cursor: "pointer", textAlign: "left", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}><div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div><div style={{ fontWeight: 600, color: theme.text }}>Upload Videos</div><div style={{ fontSize: 12, color: theme.textSecondary }}>Add new content</div></button>
                  )}
                  {hasPermission("manage_links") && (
                    <button onClick={() => setOpenModal("group-video")} style={{ padding: 20, background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)", border: "none", borderRadius: 12, cursor: "pointer", textAlign: "left", color: "#fff", boxShadow: "0 4px 15px rgba(30,58,95,0.3)" }}><div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div><div style={{ fontWeight: 600 }}>Link Content</div><div style={{ fontSize: 12, opacity: 0.8 }}>Assign videos & images to groups</div></button>
                  )}
                  {hasPermission("view_reports") && (
                    <button onClick={() => setCurrentPage("reports")} style={{ padding: 20, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", border: "none", borderRadius: 12, cursor: "pointer", textAlign: "left", color: "#fff", boxShadow: "0 4px 15px rgba(16,185,129,0.3)" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📈</div><div style={{ fontWeight: 600 }}>View Reports</div><div style={{ fontSize: 12, opacity: 0.8 }}>Analytics & exports</div></button>
                  )}
                </div>
                <div style={{ background: theme.card, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden" }}><RecentLinks refreshKey={linksRefresh} isDark={isDark} /></div>
              </div>
            )}
            {currentPage === "devices" && hasPermission("manage_devices") && <div style={{ background: theme.card, borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}><Device onChanged={() => setLinksRefresh((x) => x + 1)} /></div>}
            {currentPage === "devices" && !hasPermission("manage_devices") && <div style={{ padding: 40, textAlign: "center", color: theme.textSecondary }}>You don't have permission to manage devices.</div>}
            {currentPage === "videos" && (hasPermission("manage_videos") || hasPermission("upload_videos")) && <div style={{ background: theme.card, borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}><Video /></div>}
            {currentPage === "videos" && !hasPermission("manage_videos") && !hasPermission("upload_videos") && <div style={{ padding: 40, textAlign: "center", color: theme.textSecondary }}>You don't have permission to manage videos.</div>}
            {currentPage === "advertisements" && (hasPermission("manage_videos") || hasPermission("upload_videos")) && <div style={{ background: theme.card, borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}><Advertisement /></div>}
            {currentPage === "advertisements" && !hasPermission("manage_videos") && !hasPermission("upload_videos") && <div style={{ padding: 40, textAlign: "center", color: theme.textSecondary }}>You don't have permission to manage advertisements.</div>}
            {currentPage === "groups" && hasPermission("manage_groups") && <div style={{ background: theme.card, borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}><Group /></div>}
            {currentPage === "groups" && !hasPermission("manage_groups") && <div style={{ padding: 40, textAlign: "center", color: theme.textSecondary }}>You don't have permission to manage groups.</div>}
            {currentPage === "shops" && hasPermission("manage_shops") && <div style={{ background: theme.card, borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}><Shop /></div>}
            {currentPage === "shops" && !hasPermission("manage_shops") && <div style={{ padding: 40, textAlign: "center", color: theme.textSecondary }}>You don't have permission to manage shops.</div>}
            {currentPage === "links" && hasPermission("manage_links") && <div style={{ background: theme.card, borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}><GroupLinkedVideo onDone={() => setLinksRefresh((x) => x + 1)} /></div>}
            {currentPage === "links" && !hasPermission("manage_links") && <div style={{ padding: 40, textAlign: "center", color: theme.textSecondary }}>You don't have permission to manage links.</div>}
            {currentPage === "reports" && hasPermission("view_reports") && <Reports />}
            {currentPage === "reports" && !hasPermission("view_reports") && <div style={{ padding: 40, textAlign: "center", color: theme.textSecondary }}>You don't have permission to view reports.</div>}
            {currentPage === "users" && hasPermission("manage_users") && <div style={{ background: theme.card, borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}><UserManagement onUserDeactivated={onLogout} /></div>}
            {currentPage === "users" && !hasPermission("manage_users") && <div style={{ padding: 40, textAlign: "center", color: theme.textSecondary }}>You don't have permission to manage users.</div>}
          </main>
        </div>
        {hasPermission("manage_devices") && <Modal open={openModal === "device"} title="📱 Device Management" onClose={() => setOpenModal(null)}><Device onChanged={() => setLinksRefresh((x) => x + 1)} /></Modal>}
        {hasPermission("upload_videos") && <Modal open={openModal === "video"} title="🎬 Videos" onClose={() => setOpenModal(null)} size="xl"><Video /></Modal>}
        {hasPermission("manage_links") && <Modal open={openModal === "group-video"} title="🔗 Link Content" onClose={() => setOpenModal(null)}><GroupLinkedVideo onDone={() => setLinksRefresh((x) => x + 1)} /></Modal>}
        <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
      </div>
      <style>{`
        * { box-sizing: border-box; }
        body { 
          margin: 0; 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: ${theme.bg};
          color: ${theme.text};
        }
        button:hover { opacity: 0.9; }
        input, select, textarea {
          background: ${theme.inputBg} !important;
          color: ${theme.text} !important;
          border-color: ${theme.inputBorder} !important;
        }
        input::placeholder { color: ${theme.textSecondary} !important; }
        table { color: ${theme.text}; }
        th { background: ${theme.tableHeader} !important; color: ${theme.text} !important; }
        td { border-color: ${theme.border} !important; }
        tr:hover { background: ${theme.tableRowHover} !important; }
        .modal-content { background: ${theme.card} !important; color: ${theme.text} !important; }
      `}</style>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}

/* ======================== App ======================== */
export default function App() {
  const [user, setUser] = useState(() => { const saved = localStorage.getItem("digix_user"); return saved ? JSON.parse(saved) : null; });

  const handleLogout = useCallback(() => {
    const token = localStorage.getItem("digix_token");
    if (token) fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    localStorage.removeItem("digix_token");
    localStorage.removeItem("digix_user");
    setUser(null);
  }, []);

  if (!user) return <LoginPage onLogin={setUser} />;
  return <Dashboard user={user} onLogout={handleLogout} />;
}
