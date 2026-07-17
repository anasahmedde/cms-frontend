// Extracted from the old App.js (interim page — a full Team rebuild lands in a
// later wave). Ported to the shared API client, kit Modal/ConfirmModal/Toast;
// keeps the old inline-styled table under the .legacy-page dark-mode shim.
import React, { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../lib/api";
import { useAuth } from "../lib/auth";
import Modal from "../ui/Modal";
import ConfirmModal from "../ui/ConfirmModal";
import Button from "../ui/Button";
import { useToast } from "../ui/Toast";
import { Field, Input, Select, Checkbox } from "../ui/Field";
import ErrorState from "../ui/ErrorState";

const ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer (view only)" },
  { value: "editor", label: "Editor (upload/manage media)" },
  { value: "manager", label: "Manager (full access except team)" },
  { value: "admin", label: "Admin (full access)" },
];

export default function UserManagement() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const isPlatform = user?.user_type === "platform";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [companies, setCompanies] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [form, setForm] = useState({ username: "", password: "", email: "", full_name: "", role: "viewer", company_slug: "", is_active: true });
  const [newPassword, setNewPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoadError("");
    const res = await apiGet("/users");
    if (res.ok) {
      setUsers(res.data.items || []);
    } else {
      setLoadError(res.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
    if (isPlatform) {
      apiGet("/platform/companies?limit=200").then((res) => {
        if (res.ok) setCompanies(res.data.items || []);
      });
    }
  }, [loadUsers, isPlatform]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    const payload = {
      username: form.username,
      password: form.password,
      email: form.email || undefined,
      full_name: form.full_name || undefined,
      role: form.role,
    };
    if (isPlatform && form.company_slug) payload.company_slug = form.company_slug;
    const res = await apiPost("/users", payload);
    setSaving(false);
    if (!res.ok) return setFormError(res.message);
    setShowCreate(false);
    setForm({ username: "", password: "", email: "", full_name: "", role: "viewer", company_slug: "", is_active: true });
    toast.success(`User "${payload.username}" created`);
    loadUsers();
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    const res = await apiPut(`/users/${editUser.id}`, {
      email: form.email,
      full_name: form.full_name,
      role: form.role,
      is_active: form.is_active,
    });
    setSaving(false);
    if (!res.ok) return setFormError(res.message);
    setEditUser(null);
    toast.success("User updated — permission changes apply at their next login");
    loadUsers();
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setFormError("");
    if (newPassword.length < 6) return setFormError("Password must be at least 6 characters");
    setSaving(true);
    const res = await apiPost(`/users/${resetUser.id}/reset-password?new_password=${encodeURIComponent(newPassword)}`);
    setSaving(false);
    if (!res.ok) return setFormError(res.message);
    setResetUser(null);
    setNewPassword("");
    toast.success("Password reset");
  };

  const handleDelete = async () => {
    setSaving(true);
    const res = await apiDelete(`/users/${deleteUser.id}`);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`User "${deleteUser.username}" deleted`);
    setDeleteUser(null);
    loadUsers();
  };

  if (!hasPermission("manage_users")) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>You don't have permission to manage the team.</div>;
  }
  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading team…</div>;
  if (loadError) return <ErrorState message={loadError} onRetry={() => { setLoading(true); loadUsers(); }} />;

  const cell = { padding: 12, borderBottom: "1px solid var(--border)" };
  const pill = (bg, color, text) => (
    <span style={{ padding: "4px 10px", borderRadius: 20, background: bg, color, fontSize: 12, fontWeight: 600 }}>{text}</span>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ margin: 0 }}>Team ({users.length})</h3>
        <Button onClick={() => { setShowCreate(true); setFormError(""); }}>Add user</Button>
      </div>
      <div className="u-scroll-x">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...cell, textAlign: "left" }}>Username</th>
              <th style={{ ...cell, textAlign: "left" }}>Name</th>
              {isPlatform && <th style={{ ...cell, textAlign: "left" }}>Company</th>}
              <th style={{ ...cell, textAlign: "left" }}>Role</th>
              <th style={{ ...cell, textAlign: "left" }}>Status</th>
              <th style={{ ...cell, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={cell}><strong>{u.username}</strong><br /><span style={{ color: "var(--text-muted)", fontSize: 12 }}>{u.email}</span></td>
                <td style={cell}>{u.full_name || "—"}</td>
                {isPlatform && (
                  <td style={cell}>
                    {u.company_name
                      ? pill("var(--info-soft)", "var(--info)", u.company_name)
                      : u.user_type === "platform"
                        ? pill("var(--warn-soft)", "var(--warn)", "Platform")
                        : "—"}
                  </td>
                )}
                <td style={cell}>{pill("var(--elevated)", "var(--text)", u.role)}</td>
                <td style={cell}>{u.is_active ? pill("var(--success-soft)", "var(--success)", "Active") : pill("var(--danger-soft)", "var(--danger)", "Inactive")}</td>
                <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
                  <Button size="sm" variant="secondary" onClick={() => { setEditUser(u); setForm({ ...form, email: u.email || "", full_name: u.full_name || "", role: u.role, is_active: u.is_active }); setFormError(""); }}>Edit</Button>{" "}
                  <Button size="sm" variant="secondary" onClick={() => { setResetUser(u); setNewPassword(""); setFormError(""); }}>Reset password</Button>{" "}
                  {u.username !== "admin" && <Button size="sm" variant="danger" onClick={() => setDeleteUser(u)}>Delete</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showCreate} title="Add user" onClose={() => setShowCreate(false)} size="sm">
        <form onSubmit={handleCreate}>
          {isPlatform && companies.length > 0 && (
            <Field label="Assign to company" hint="The same username can exist in different companies" htmlFor="um-company">
              <Select
                id="um-company"
                value={form.company_slug}
                onChange={(e) => setForm({ ...form, company_slug: e.target.value })}
                options={[{ value: "", label: "Platform user (no company)" }, ...companies.map((c) => ({ value: c.slug, label: `${c.name} (${c.slug})` }))]}
              />
            </Field>
          )}
          <Field label="Username" required htmlFor="um-username">
            <Input id="um-username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Password" required htmlFor="um-password">
            <Input id="um-password" required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          </Field>
          <Field label="Email" htmlFor="um-email">
            <Input id="um-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Full name" htmlFor="um-fullname">
            <Input id="um-fullname" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Role" htmlFor="um-role">
            <Select id="um-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={ROLE_OPTIONS} />
          </Field>
          {formError && <div style={{ padding: 10, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 8, marginBottom: 12 }}>{formError}</div>}
          <Button type="submit" loading={saving} style={{ width: "100%" }}>Create user</Button>
        </form>
      </Modal>

      <Modal open={!!editUser} title={`Edit ${editUser?.username || ""}`} onClose={() => setEditUser(null)} size="sm">
        <form onSubmit={handleUpdate}>
          <Field label="Email" htmlFor="um-e-email">
            <Input id="um-e-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Full name" htmlFor="um-e-fullname">
            <Input id="um-e-fullname" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Role" htmlFor="um-e-role">
            <Select id="um-e-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={ROLE_OPTIONS} />
          </Field>
          <Checkbox label="Active (unchecking immediately logs the user out)" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          {formError && <div style={{ padding: 10, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 8, margin: "12px 0" }}>{formError}</div>}
          <Button type="submit" loading={saving} style={{ width: "100%", marginTop: 12 }}>Save changes</Button>
        </form>
      </Modal>

      <Modal open={!!resetUser} title={`Reset password — ${resetUser?.username || ""}`} onClose={() => setResetUser(null)} size="sm">
        <form onSubmit={handleResetPassword}>
          <Field label="New password" required hint="Minimum 6 characters" htmlFor="um-newpass">
            <Input id="um-newpass" required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          {formError && <div style={{ padding: 10, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 8, marginBottom: 12 }}>{formError}</div>}
          <Button type="submit" loading={saving} style={{ width: "100%" }}>Reset password</Button>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDelete}
        title="Delete user"
        message={`Delete "${deleteUser?.username}"? They will be logged out immediately and lose all access.`}
        danger
        confirmLabel="Delete user"
        loading={saving}
      />
    </div>
  );
}
