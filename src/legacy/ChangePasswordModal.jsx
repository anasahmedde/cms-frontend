// Self-service password change, ported to the kit (extracted from old App.js).
import React, { useState } from "react";
import { apiPost } from "../lib/api";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Field, Input } from "../ui/Field";
import { useToast } from "../ui/Toast";

export default function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) return setError("New password must be at least 6 characters");
    if (newPassword !== confirmPassword) return setError("Passwords do not match");
    setSaving(true);
    const res = await apiPost("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    setSaving(false);
    if (!res.ok) return setError(res.message);
    toast.success("Password changed");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  return (
    <Modal open={open} title="Change password" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit}>
        <Field label="Current password" required htmlFor="cp-current">
          <Input id="cp-current" required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="New password" required hint="Minimum 6 characters" htmlFor="cp-new">
          <Input id="cp-new" required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" required htmlFor="cp-confirm">
          <Input id="cp-confirm" required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        {error && <div style={{ padding: 10, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 8, marginBottom: 12 }}>{error}</div>}
        <Button type="submit" loading={saving} style={{ width: "100%" }}>Change password</Button>
      </form>
    </Modal>
  );
}
