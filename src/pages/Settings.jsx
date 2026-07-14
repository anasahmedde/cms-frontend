// Company settings: read-only company profile + subscription status.
// Approval-policy editing stays on the Approvals page for now.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import Card from "../ui/Card";
import KeyValue from "../ui/KeyValue";
import ErrorState from "../ui/ErrorState";
import { SkeletonText } from "../ui/Skeleton";
import PageHeader from "../ui/PageHeader";
import Badge from "../ui/Badge";
import { formatDateTime } from "../lib/format";

const STATUS_TONE = { active: "success", grace_period: "warn", expired: "danger", suspended: "danger" };

export default function Settings() {
  const [company, setCompany] = useState(null);
  const [expiration, setExpiration] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    const [companyRes, expRes] = await Promise.all([
      apiGet("/platform/my-company"),
      apiGet("/company/expiration-status"),
    ]);
    if (companyRes.ok) setCompany(companyRes.data);
    else setError(companyRes.message);
    if (expRes.ok) setExpiration(expRes.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your company profile and subscription" />
      {loading ? (
        <Card><SkeletonText lines={5} /></Card>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
          <Card title="Company">
            <KeyValue
              columns={2}
              items={[
                { label: "Name", value: company?.name || "—" },
                { label: "Workspace ID", value: company?.slug || "—", mono: true },
                { label: "Email", value: company?.email || "—" },
                { label: "Phone", value: company?.phone || "—" },
                { label: "Screen limit", value: company?.max_devices ?? "—" },
                { label: "Team limit", value: company?.max_users ?? "—" },
              ]}
            />
          </Card>
          <Card title="Subscription">
            <div className="u-flex" style={{ marginBottom: 10 }}>
              <Badge tone={STATUS_TONE[expiration?.status] || "neutral"}>{(expiration?.status || "active").replace("_", " ")}</Badge>
              {expiration?.days_remaining != null && (
                <span className="u-muted">{expiration.days_remaining} days remaining</span>
              )}
            </div>
            <KeyValue
              columns={2}
              items={[
                { label: "Expires", value: expiration?.expires_at ? formatDateTime(expiration.expires_at) : "Never" },
                { label: "Message", value: expiration?.message || "—" },
              ]}
            />
          </Card>
          <Card title="Content approval">
            <p className="u-muted" style={{ margin: "0 0 4px" }}>
              Approval policy (who can publish without review) is managed on the{" "}
              <Link to="/approvals">Approvals page</Link>.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
