// Approvals queue: review content-change requests before they go live, plus
// the company-wide approval policy toggle (now behind an explicit confirm —
// it changes publishing rules for the whole company).
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, ShieldOff } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Table from "../ui/Table";
import Card from "../ui/Card";
import ConfirmModal from "../ui/ConfirmModal";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import Tabs from "../ui/Tabs";
import { useToast } from "../ui/Toast";
import { apiGet, apiPut } from "../lib/api";
import { timeAgo } from "../lib/format";
import ReviewModal, { REQUEST_TYPE_LABELS, TARGET_TYPE_LABELS, STATUS_TONES } from "../workflows/approvals/ReviewModal";

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function Approvals() {
  const toast = useToast();
  const [filter, setFilter] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [reviewing, setReviewing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await apiGet("/content-changes", {
      params: { status: filter === "all" ? undefined : filter, limit: 200 },
    });
    if (res.ok) {
      setRequests(res.data?.items || res.data?.requests || []);
      setPendingCount(res.data?.pending_count ?? 0);
    } else {
      setError(res.message);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiGet("/company/approval-settings").then((res) => {
      if (res.ok) setSettings(res.data);
    });
  }, []);

  const toggleApproval = async () => {
    setToggling(true);
    const next = !settings?.require_content_approval;
    const res = await apiPut(`/company/approval-settings?require_approval=${next}`);
    setToggling(false);
    setConfirmToggle(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setSettings({ ...settings, require_content_approval: next });
    toast.success(next ? "Content approval enabled — new additions need review" : "Content approval disabled — changes apply immediately");
  };

  const approvalOn = !!settings?.require_content_approval;

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle="Review content changes before they reach your screens"
        actions={
          settings !== null && (
            <Button
              variant={approvalOn ? "secondary" : "primary"}
              icon={approvalOn ? ShieldOff : ShieldCheck}
              onClick={() => setConfirmToggle(true)}
            >
              {approvalOn ? "Disable approval requirement" : "Enable approval requirement"}
            </Button>
          )
        }
      />

      {settings !== null && (
        <Card padding={12} className="u-between" >
          <span className="u-flex">
            <Badge tone={approvalOn ? "success" : "neutral"}>
              {approvalOn ? "Approval required" : "Approval disabled"}
            </Badge>
            <span className="u-muted">
              {approvalOn
                ? `Additions by roles outside [${(settings.auto_approve_roles || []).join(", ")}] wait for review.`
                : "All content changes apply immediately."}
            </span>
          </span>
        </Card>
      )}

      {filter !== "pending" && pendingCount > 0 && (
        <Card padding={12}>
          <span className="u-flex">
            <Badge tone="warn">{pendingCount} pending</Badge>
            <span className="u-muted">request{pendingCount === 1 ? "" : "s"} awaiting review</span>
            <Button variant="ghost" size="sm" onClick={() => setFilter("pending")}>View pending</Button>
          </span>
        </Card>
      )}

      <div style={{ margin: "14px 0" }}>
        <Tabs
          tabs={FILTERS.map((f) => ({ ...f, badge: f.key === "pending" && pendingCount > 0 ? pendingCount : undefined }))}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <Table
          columns={[
            {
              key: "request",
              label: "Request",
              render: (r) => (
                <div>
                  <strong>{REQUEST_TYPE_LABELS[r.request_type] || r.request_type}</strong>
                  {r.request_type === "template_content" && (r.change_data?.zone_label || r.change_data?.zone_key) && (
                    <span className="u-faint"> · box “{r.change_data.zone_label || r.change_data.zone_key}”</span>
                  )}
                  {r.request_note && <div className="u-faint">"{r.request_note}"</div>}
                  {r.execution_error && <Badge tone="danger">execution failed</Badge>}
                </div>
              ),
            },
            {
              key: "target",
              label: "Target",
              render: (r) => `${TARGET_TYPE_LABELS[r.target_type] || r.target_type}${r.target_name ? ` · ${r.target_name}` : r.change_data?.gname ? ` · ${r.change_data.gname}` : ""}`,
            },
            {
              key: "requester",
              label: "Requested by",
              render: (r) => (
                <span>
                  {r.requested_by_name || r.requester_name || r.requested_by || "—"}
                  {(r.requested_by_role || r.requester_role) && (
                    <span className="u-faint"> · {r.requested_by_role || r.requester_role}</span>
                  )}
                </span>
              ),
            },
            { key: "created_at", label: "When", render: (r) => timeAgo(r.requested_at || r.created_at) },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge tone={STATUS_TONES[r.status] || "neutral"}>{r.status}</Badge>,
            },
            {
              key: "actions",
              label: "",
              align: "right",
              render: (r) => (
                <Button variant={r.status === "pending" ? "primary" : "secondary"} size="sm" onClick={() => setReviewing(r)}>
                  {r.status === "pending" ? "Review" : "View"}
                </Button>
              ),
            },
          ]}
          rows={requests}
          rowKey={(r) => r.id}
          loading={loading}
          empty={
            <EmptyState
              icon={CheckCircle2}
              title="No requests here"
              hint={filter === "pending" ? "Nothing is waiting for review." : "No requests match this filter."}
            />
          }
        />
      )}

      <ReviewModal
        request={reviewing}
        onClose={() => setReviewing(null)}
        onDecided={(action) => {
          setReviewing(null);
          toast.success(action === "approve" ? "Request approved — the change is being applied" : "Request rejected");
          load();
        }}
      />

      <ConfirmModal
        open={confirmToggle}
        onClose={() => setConfirmToggle(false)}
        onConfirm={toggleApproval}
        title={approvalOn ? "Disable content approval?" : "Enable content approval?"}
        message={
          approvalOn
            ? "Company-wide policy change: every user's content changes will apply immediately, without review."
            : `Company-wide policy change: content additions by roles outside [${(settings?.auto_approve_roles || ["admin", "manager"]).join(", ")}] will wait for an approver.`
        }
        danger={approvalOn}
        confirmLabel={approvalOn ? "Disable approvals" : "Enable approvals"}
        loading={toggling}
      />
    </div>
  );
}
