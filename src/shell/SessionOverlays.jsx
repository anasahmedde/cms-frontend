// Cross-cutting session UX: the session-expired modal and the full-screen
// company-blocked (expired/suspended subscription) panel.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, LogOut } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { useAuth } from "../lib/auth";
import "./shell.css";

export default function SessionOverlays() {
  const { sessionExpired, blockedMessage, logout, clearSessionExpired } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    clearSessionExpired();
    await logout();
    setBusy(false);
    navigate("/login", { replace: true });
  };

  return (
    <>
      <Modal
        open={!!sessionExpired}
        onClose={leave}
        title="Session expired"
        size="sm"
        closeOnOverlay={false}
        footer={
          <Button variant="primary" loading={busy} onClick={leave}>
            Log in again
          </Button>
        }
      >
        <p className="ui-session-message">
          Your session has ended or your account was deactivated. Log in again to continue.
        </p>
      </Modal>

      {blockedMessage ? (
        <div className="ui-blocked" role="alertdialog" aria-modal="true" aria-labelledby="ui-blocked-title">
          <div className="ui-blocked-card">
            <span className="ui-blocked-icon">
              <AlertTriangle size={18} aria-hidden="true" />
            </span>
            <h2 id="ui-blocked-title">Account access suspended</h2>
            <p>{blockedMessage}</p>
            <Button variant="primary" icon={LogOut} loading={busy} onClick={leave}>
              Log out
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
