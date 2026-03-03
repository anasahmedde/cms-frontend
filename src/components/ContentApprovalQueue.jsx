// src/components/ContentApprovalQueue.jsx
// Content Approval Queue for managers to approve/reject content changes
// Part of the Two-Factor Content Update feature
import React, { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;

function authHeaders() {
  const token = localStorage.getItem("digix_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// Format date helper
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString();
}

// Request type labels
const REQUEST_TYPE_LABELS = {
  video_assign: "Assign Videos",
  video_unassign: "Unassign Videos",
  group_change: "Change Group",
  content_update: "Update Content",
  device_settings: "Device Settings",
  advertisement_change: "Advertisement Change",
  link_content: "Link Content to Group",
};

// Target type labels
const TARGET_TYPE_LABELS = {
  device: "Device",
  group: "Group",
  shop: "Shop"
};

// Status badge component
function StatusBadge({ status }) {
  const styles = {
    pending: { bg: "#fef3c7", color: "#b45309" },
    approved: { bg: "#dcfce7", color: "#166534" },
    rejected: { bg: "#fef2f2", color: "#dc2626" },
    executed: { bg: "#dbeafe", color: "#1e40af" },
    failed: { bg: "#fef2f2", color: "#991b1b" }
  };
  const s = styles[status] || styles.pending;
  
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
      textTransform: "uppercase"
    }}>
      {status}
    </span>
  );
}

export default function ContentApprovalQueue({ onApprovalAction }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [approvalEnabled, setApprovalEnabled] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Fetch approval settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/company/approval-settings`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setApprovalEnabled(data.require_content_approval);
      }
    } catch (err) {
      console.error("Failed to fetch approval settings:", err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // Fetch content change requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      
      const res = await fetch(`${API_BASE}/content-changes?${params}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      } else {
        const errData = await res.json();
        setError(errData.detail || "Failed to load requests");
      }
    } catch (err) {
      setError("Network error loading requests");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { 
    fetchSettings(); 
    fetchRequests(); 
  }, [fetchSettings, fetchRequests]);

  // Handle approve/reject
  const handleReview = async (action) => {
    if (!selectedRequest) return;
    setReviewing(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${API_BASE}/content-changes/${selectedRequest.id}/review`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          action: action,
          review_note: reviewNote || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
        setSelectedRequest(null);
        setReviewNote("");
        fetchRequests();
        if (onApprovalAction) onApprovalAction(action);
      } else {
        const errData = await res.json();
        setError(errData.detail || `Failed to ${action} request`);
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setReviewing(false);
    }
  };

  // Toggle approval settings
  const toggleApproval = async () => {
    try {
      const res = await fetch(`${API_BASE}/company/approval-settings?require_approval=${!approvalEnabled}`, {
        method: "PUT",
        headers: authHeaders()
      });
      if (res.ok) {
        setApprovalEnabled(!approvalEnabled);
        setSuccess(`Content approval ${!approvalEnabled ? 'enabled' : 'disabled'}`);
      }
    } catch (err) {
      setError("Failed to update settings");
    }
  };

  // Count pending
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "#f3f4f6" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#0a1628" }}>
            Content Approval Queue
          </h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
            Review and approve content changes before they're applied
          </p>
        </div>
        
        {/* Approval Toggle */}
        {!settingsLoading && (
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 12,
            padding: "12px 20px",
            background: approvalEnabled ? "#dcfce7" : "#f3f4f6",
            borderRadius: 12,
            border: `1px solid ${approvalEnabled ? "#86efac" : "#e5e7eb"}`
          }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: approvalEnabled ? "#166534" : "#6b7280" }}>
              {approvalEnabled ? "✅ Approval Required" : "Approval Disabled"}
            </span>
            <button
              onClick={toggleApproval}
              style={{
                padding: "6px 16px",
                background: approvalEnabled ? "#dc2626" : "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600
              }}
            >
              {approvalEnabled ? "Disable" : "Enable"}
            </button>
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div style={{ padding: 12, background: "#dcfce7", borderRadius: 8, marginBottom: 16, color: "#166534" }}>
          {success}
          <button onClick={() => setSuccess("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}
      {error && (
        <div style={{ padding: 12, background: "#fef2f2", borderRadius: 8, marginBottom: 16, color: "#dc2626" }}>
          {error}
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Pending Badge */}
      {pendingCount > 0 && statusFilter !== 'pending' && (
        <div style={{ 
          padding: "12px 16px", 
          background: "#fef3c7", 
          borderRadius: 8, 
          marginBottom: 16,
          border: "1px solid #fcd34d",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <span style={{ color: "#92400e", fontWeight: 600 }}>
            ⚠️ You have {pendingCount} pending request(s) awaiting approval
          </span>
          <button
            onClick={() => setStatusFilter("pending")}
            style={{
              padding: "6px 12px",
              background: "#f59e0b",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600
            }}
          >
            View Pending
          </button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["pending", "approved", "rejected", "all"].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status === "all" ? "" : status)}
            style={{
              padding: "8px 16px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: (statusFilter === status || (status === "all" && !statusFilter)) ? "#3b82f6" : "#fff",
              color: (statusFilter === status || (status === "all" && !statusFilter)) ? "#fff" : "#374151",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              textTransform: "capitalize"
            }}
          >
            {status}
            {status === "pending" && pendingCount > 0 && (
              <span style={{
                marginLeft: 6,
                background: "rgba(255,255,255,0.3)",
                padding: "2px 6px",
                borderRadius: 10,
                fontSize: 11
              }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No content change requests</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>
              {statusFilter === "pending" 
                ? "No pending requests to review." 
                : "No requests match the selected filter."}
            </div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Request</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Target</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Requested By</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Date</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Status</th>
                <th style={{ padding: 12, textAlign: "right", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>
                      {REQUEST_TYPE_LABELS[req.request_type] || req.request_type}
                    </div>
                    {req.request_note && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        "{req.request_note}"
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 12 }}>
                    <span style={{
                      padding: "3px 8px",
                      background: "#f3f4f6",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500
                    }}>
                      {TARGET_TYPE_LABELS[req.target_type] || req.target_type}
                    </span>
                    <span style={{ marginLeft: 8, fontWeight: 500 }}>
                      {req.target_name || `#${req.target_id}`}
                    </span>
                  </td>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 500 }}>{req.requested_by_name || "Unknown"}</div>
                    {req.requested_by_role && <div style={{ fontSize: 12, color: "#6b7280", textTransform: "capitalize" }}>{req.requested_by_role}</div>}
                  </td>
                  <td style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    {formatDate(req.created_at)}
                  </td>
                  <td style={{ padding: 12 }}>
                    <StatusBadge status={req.status} />
                  </td>
                  <td style={{ padding: 12, textAlign: "right" }}>
                    {req.status === "pending" ? (
                      <button
                        onClick={() => { setSelectedRequest(req); setReviewNote(""); }}
                        style={{
                          padding: "6px 14px",
                          background: "#3b82f6",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        Review
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedRequest(req)}
                        style={{
                          padding: "6px 14px",
                          background: "#f3f4f6",
                          color: "#374151",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 500
                        }}
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Modal */}
      {selectedRequest && (
        <div 
          style={{ 
            position: "fixed", 
            inset: 0, 
            background: "rgba(0,0,0,0.5)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            zIndex: 1000 
          }}
          onClick={() => setSelectedRequest(null)}
        >
          <div 
            style={{ 
              background: "#fff", 
              borderRadius: 16, 
              padding: 28, 
              width: 520, 
              maxHeight: "80vh", 
              overflow: "auto" 
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 20 }}>
                {selectedRequest.status === "pending" ? "Review Request" : "Request Details"}
              </h3>
              <StatusBadge status={selectedRequest.status} />
            </div>

            {/* Request Info */}
            <div style={{ 
              padding: 16, 
              background: "#f9fafb", 
              borderRadius: 12, 
              marginBottom: 20 
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Request Type</div>
                  <div style={{ fontWeight: 600 }}>
                    {REQUEST_TYPE_LABELS[selectedRequest.request_type] || selectedRequest.request_type}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Target</div>
                  <div style={{ fontWeight: 600 }}>
                    {TARGET_TYPE_LABELS[selectedRequest.target_type]}: {selectedRequest.target_name || `#${selectedRequest.target_id}`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Requested By</div>
                  <div style={{ fontWeight: 600 }}>
                    {selectedRequest.requested_by_name} ({selectedRequest.requested_by_role})
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Requested At</div>
                  <div style={{ fontWeight: 600 }}>{formatDate(selectedRequest.created_at)}</div>
                </div>
              </div>

              {selectedRequest.request_note && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Note</div>
                  <div style={{ fontStyle: "italic" }}>"{selectedRequest.request_note}"</div>
                </div>
              )}

              {/* Change Data */}
              {selectedRequest.change_data && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>Changes</div>
                  <div style={{ 
                    background: "#fff", 
                    padding: 12, 
                    borderRadius: 8, 
                    border: "1px solid #e5e7eb",
                    fontSize: 13,
                    fontFamily: "monospace"
                  }}>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {JSON.stringify(selectedRequest.change_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Review Section (only for pending) */}
            {selectedRequest.status === "pending" && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Review Note (optional)
                  </label>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Add a note about your decision..."
                    style={{
                      width: "100%",
                      padding: 12,
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      fontSize: 14,
                      minHeight: 80,
                      resize: "vertical",
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    style={{
                      flex: 1,
                      padding: 12,
                      background: "#f3f4f6",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleReview("reject")}
                    disabled={reviewing}
                    style={{
                      flex: 1,
                      padding: 12,
                      background: "#dc2626",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      cursor: reviewing ? "wait" : "pointer",
                      fontWeight: 600,
                      opacity: reviewing ? 0.6 : 1
                    }}
                  >
                    {reviewing ? "..." : "❌ Reject"}
                  </button>
                  <button
                    onClick={() => handleReview("approve")}
                    disabled={reviewing}
                    style={{
                      flex: 1,
                      padding: 12,
                      background: "#16a34a",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      cursor: reviewing ? "wait" : "pointer",
                      fontWeight: 600,
                      opacity: reviewing ? 0.6 : 1
                    }}
                  >
                    {reviewing ? "..." : "✅ Approve"}
                  </button>
                </div>
              </>
            )}

            {/* View-only for non-pending */}
            {selectedRequest.status !== "pending" && (
              <>
                {selectedRequest.reviewed_by_name && (
                  <div style={{ 
                    padding: 12, 
                    background: selectedRequest.status === "approved" ? "#dcfce7" : "#fef2f2", 
                    borderRadius: 8, 
                    marginBottom: 16 
                  }}>
                    <div style={{ fontSize: 13 }}>
                      <strong>
                        {selectedRequest.status === "approved" ? "Approved" : "Rejected"}
                      </strong> by {selectedRequest.reviewed_by_name} on {formatDate(selectedRequest.reviewed_at)}
                    </div>
                    {selectedRequest.review_note && (
                      <div style={{ marginTop: 8, fontStyle: "italic" }}>
                        "{selectedRequest.review_note}"
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setSelectedRequest(null)}
                  style={{
                    width: "100%",
                    padding: 12,
                    background: "#f3f4f6",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
