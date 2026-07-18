// "What needs me" strip: pending approvals (live via WS).
// Renders nothing when there is nothing to act on.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, AlertTriangle } from "lucide-react";
import { apiGet } from "../../lib/api";
import { wsClient } from "../../lib/ws";
import { useAuth } from "../../lib/auth";
import Button from "../../ui/Button";
import "./dashboard.css";

const APPROVER_ROLES = ["admin", "manager", "company_admin", "content_manager"];

export default function AlertsStrip() {
  const { user } = useAuth();
  const canApprove =
    APPROVER_ROLES.includes(user?.role) || user?.user_type === "platform";
  const [pending, setPending] = useState(0);
  const [pendingError, setPendingError] = useState(false);

  const loadPending = useCallback(async () => {
    if (!canApprove) return;
    const res = await apiGet("/content-changes", {
      params: { status: "pending", limit: 1 },
    });
    if (res.ok) {
      setPending(Number(res.data?.pending_count) || 0);
      setPendingError(false);
    } else {
      setPendingError(true);
    }
  }, [canApprove]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    if (!canApprove) return undefined;
    const off = wsClient.on("pending_approvals", (data) => {
      if (data && data.pending_count != null) {
        setPending(Number(data.pending_count) || 0);
        setPendingError(false);
      }
    });
    return off;
  }, [canApprove]);

  const showApprovals = canApprove && pending > 0;
  const showApprovalsError = canApprove && pendingError;
  if (!showApprovals && !showApprovalsError) return null;

  return (
    <div className="fleet-alerts">
      {showApprovals && (
        <div className="fleet-alert">
          <span className="fleet-alert-icon">
            <ClipboardCheck size={16} aria-hidden="true" />
          </span>
          <span>
            {pending} content {pending === 1 ? "change" : "changes"} waiting for
            approval
          </span>
          <Link to="/approvals">Review approvals</Link>
        </div>
      )}
      {showApprovalsError && (
        <div className="fleet-alert">
          <span className="fleet-alert-icon">
            <AlertTriangle size={16} aria-hidden="true" />
          </span>
          <span>Couldn't check pending approvals.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadPending}
            style={{ marginLeft: "auto" }}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
