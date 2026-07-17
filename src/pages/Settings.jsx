// Company settings: read-only company profile + subscription status.
// Approval-policy editing stays on the Approvals page for now.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import { useAuth } from "../lib/auth";
import ZoneContentEditor from "../components/templates/ZoneContentEditor";
import Button from "../ui/Button";
import Card from "../ui/Card";
import KeyValue from "../ui/KeyValue";
import ErrorState from "../ui/ErrorState";
import { SkeletonText } from "../ui/Skeleton";
import PageHeader from "../ui/PageHeader";
import Badge from "../ui/Badge";
import { formatDateTime } from "../lib/format";

const STATUS_TONE = { active: "success", grace_period: "warn", expired: "danger", suspended: "danger" };

export default function Settings() {
  const { hasPermission } = useAuth();
  const [company, setCompany] = useState(null);
  const [expiration, setExpiration] = useState(null);
  const [hasTemplate, setHasTemplate] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    const [companyRes, expRes, tplRes] = await Promise.all([
      apiGet("/platform/my-company"),
      apiGet("/company/expiration-status"),
      apiGet("/company/template"),
    ]);
    if (companyRes.ok) setCompany(companyRes.data);
    else setError(companyRes.message);
    if (expRes.ok) setExpiration(expRes.data);
    setHasTemplate(!!(tplRes.ok && tplRes.data?.template));
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
          {hasTemplate && hasPermission("manage_company_settings") && (
            <Card title="Screen content defaults">
              <p className="u-muted" style={{ marginTop: 0 }}>
                Company-wide template content — shown wherever a location or an individual screen
                hasn't set its own.
              </p>
              <Button variant="secondary" onClick={() => setEditingContent(true)}>
                Edit content defaults
              </Button>
              {editingContent && (
                <ZoneContentEditor
                  scope="company"
                  targetName={company?.name}
                  onClose={() => setEditingContent(false)}
                />
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
