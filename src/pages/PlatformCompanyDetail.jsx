// Company detail: profile + quotas (editable — the PUT endpoint existed but
// had no UI), subscription card with history timeline (headless endpoint),
// template link, usage stats, danger zone with typed-slug delete.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ExternalLink, Building2 } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Card from "../ui/Card";
import KeyValue from "../ui/KeyValue";
import ConfirmModal from "../ui/ConfirmModal";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import { SkeletonText } from "../ui/Skeleton";
import { Field, Input, Select, Switch } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { useAuth } from "../lib/auth";
import { apiDelete, apiGet, apiPut } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { effectiveStatus, expirationLabel } from "../platform/lib";
import ExpirationModal from "../platform/ExpirationModal";
import { FEATURE_LABELS, featureOn, invalidateFeatureCache } from "../lib/features";

export default function PlatformCompanyDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { impersonate } = useAuth();
  const [company, setCompany] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState("");
  const [quotas, setQuotas] = useState(null);
  const [savingQuotas, setSavingQuotas] = useState(false);
  const [expModal, setExpModal] = useState(null);
  const [templateId, setTemplateId] = useState("");
  const [features, setFeatures] = useState({});
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deleting, setDeleting] = useState(null); // {linked?}
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    // The enriched list has expiration + counts; the plain GET does not.
    const res = await apiGet("/platform/companies", { params: { q: slug, limit: 50 } });
    if (!res.ok) return setError(res.message);
    const found = (res.data?.items || []).find((c) => c.slug === slug);
    if (!found) return setError(`No company with workspace ID "${slug}"`);
    setCompany(found);
    setQuotas({ max_devices: found.max_devices, max_users: found.max_users, max_storage_mb: found.max_storage_mb });
    setTemplateId(found.template_id ? String(found.template_id) : "");
    setFeatures(found.features || {});
    apiGet(`/platform/companies/${encodeURIComponent(slug)}/stats`).then((r) => r.ok && setStats(r.data));
    apiGet(`/platform/company/${found.id}/expiration-history`, { params: { limit: 20 } }).then(
      (r) => setHistory(r.ok ? r.data?.items || r.data?.history || r.data || [] : [])
    );
    apiGet("/platform/templates", { params: { status: "published" } }).then(
      (r) => r.ok && setTemplates(r.data?.items || r.data || [])
    );
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!company) return <SkeletonText lines={8} />;

  const status = effectiveStatus(company);
  const exp = expirationLabel(company);

  const saveQuotas = async () => {
    setSavingQuotas(true);
    const res = await apiPut(`/platform/companies/${encodeURIComponent(slug)}`, {
      max_devices: Number(quotas.max_devices),
      max_users: Number(quotas.max_users),
      max_storage_mb: Number(quotas.max_storage_mb),
    });
    setSavingQuotas(false);
    if (!res.ok) return toast.error(res.message);
    toast.success("Limits updated");
    load();
  };

  const saveTemplate = async () => {
    setSavingTemplate(true);
    const res = await apiPut(`/platform/companies/${company.id}/template`, {
      template_id: templateId ? Number(templateId) : null,
    });
    setSavingTemplate(false);
    if (!res.ok) return toast.error(res.message);
    toast.success(templateId ? "Template linked — screens pick it up on their next heartbeat" : "Template unlinked");
    load();
  };

  const doDelete = async (force) => {
    setBusy(true);
    const res = await apiDelete(`/platform/companies/${encodeURIComponent(slug)}${force ? "?force=true" : ""}`);
    setBusy(false);
    if (res.ok) {
      toast.success(`Company "${company.name}" deleted`);
      navigate("/platform/companies");
      return;
    }
    if (res.status === 409 && !force) {
      setDeleting({ linked: res.detail?.linked || {} });
      return;
    }
    toast.error(res.message);
    setDeleting(null);
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Companies", to: "/platform/companies" }, { label: company.name }]}
        title={
          <span className="u-flex">
            {company.name}
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone={exp.tone}>{exp.label}</Badge>
          </span>
        }
        subtitle={<span className="mono">{company.slug}</span>}
        actions={
          <Button
            icon={ExternalLink}
            onClick={async () => {
              const res = await impersonate(company.slug, company.name);
              if (res.ok) navigate("/");
              else toast.error(res.message);
            }}
          >
            Open workspace
          </Button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <Card title="Profile">
          <KeyValue
            columns={2}
            items={[
              { label: "Email", value: company.email || "—" },
              { label: "Phone", value: company.phone || "—" },
              { label: "Created", value: company.created_at ? formatDateTime(company.created_at) : "—" },
              { label: "Company ID", value: company.id, mono: true },
            ]}
          />
        </Card>

        <Card title="Usage">
          {stats ? (
            <KeyValue
              columns={3}
              items={[
                { label: "Screens", value: `${company.devices_online ?? 0}/${stats.device_count ?? 0} online` },
                { label: "Users", value: stats.user_count ?? 0 },
                { label: "Videos", value: stats.video_count ?? 0 },
                { label: "Images", value: stats.advertisement_count ?? 0 },
                { label: "Groups", value: stats.group_count ?? 0 },
                { label: "Locations", value: stats.shop_count ?? 0 },
              ]}
            />
          ) : (
            <SkeletonText lines={2} />
          )}
        </Card>

        <Card title="Limits" actions={<Button size="sm" onClick={saveQuotas} loading={savingQuotas}>Save</Button>}>
          <Field label="Screen limit" htmlFor="cd-dev"><Input id="cd-dev" type="number" min={1} value={quotas.max_devices} onChange={(e) => setQuotas({ ...quotas, max_devices: e.target.value })} /></Field>
          <Field label="Team limit" htmlFor="cd-usr"><Input id="cd-usr" type="number" min={1} value={quotas.max_users} onChange={(e) => setQuotas({ ...quotas, max_users: e.target.value })} /></Field>
          <Field label="Storage (MB)" htmlFor="cd-stor"><Input id="cd-stor" type="number" min={100} value={quotas.max_storage_mb} onChange={(e) => setQuotas({ ...quotas, max_storage_mb: e.target.value })} /></Field>
        </Card>

        <Card
          title="Subscription"
          actions={<Button size="sm" variant="secondary" onClick={() => setExpModal(company)}>Manage</Button>}
        >
          <KeyValue
            columns={2}
            items={[
              { label: "Expires", value: company.expires_at ? formatDateTime(company.expires_at) : "Never" },
              { label: "Grace period", value: `${company.grace_period_days ?? 7} days` },
            ]}
          />
          <div className="u-faint" style={{ margin: "10px 0 4px" }}>History</div>
          {history === null ? (
            <SkeletonText lines={2} />
          ) : history.length === 0 ? (
            <span className="u-muted">No subscription changes recorded.</span>
          ) : (
            <div style={{ display: "grid", gap: 6, maxHeight: 180, overflowY: "auto" }}>
              {history.map((h, i) => (
                <div key={h.id || i} className="u-flex">
                  <Badge tone="neutral">{(h.event_type || "").replace(/_/g, " ")}</Badge>
                  <span className="u-faint">{formatDateTime(h.created_at)} · {h.performed_by_username || h.performed_by || "system"}</span>
                  {h.notes && <span className="u-muted">— {h.notes}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Analytics features"
          actions={
            <Button
              size="sm"
              loading={savingFeatures}
              onClick={async () => {
                setSavingFeatures(true);
                const res = await apiPut(`/platform/companies/${encodeURIComponent(slug)}`, { features });
                setSavingFeatures(false);
                if (!res.ok) return toast.error(res.message);
                invalidateFeatureCache();
                toast.success("Features updated — the company dashboard reflects it on next load");
              }}
            >
              Save
            </Button>
          }
        >
          <p className="u-muted" style={{ marginTop: 0 }}>
            Hardware-dependent analytics. Disabled features are hidden from this company's
            dashboard and reports.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {Object.entries(FEATURE_LABELS).map(([key, label]) => (
              <Switch
                key={key}
                label={label}
                checked={featureOn(features, key)}
                onChange={(e) => setFeatures({ ...features, [key]: e.target.checked })}
              />
            ))}
          </div>
        </Card>

        <Card title="Screen template">
          <Field label="Linked template" hint="Published templates only; screens re-render on their next heartbeat" htmlFor="cd-tpl">
            <Select
              id="cd-tpl"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              options={[{ value: "", label: "No template" }, ...templates.map((t) => ({ value: String(t.id), label: `${t.name} (v${t.version})` }))]}
            />
          </Field>
          <Button size="sm" onClick={saveTemplate} loading={savingTemplate} disabled={String(company.template_id || "") === templateId}>
            {templateId ? "Link template" : "Unlink template"}
          </Button>
        </Card>

        <Card title="Danger zone">
          <p className="u-muted" style={{ marginTop: 0 }}>
            Deleting removes every screen, user, media file, and record of this company. Irreversible.
          </p>
          <Button variant="danger" onClick={() => setDeleting({})}>Delete company</Button>
        </Card>
      </div>

      <ExpirationModal company={expModal} onClose={() => setExpModal(null)} onSaved={() => { setExpModal(null); load(); }} />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => doDelete(!!deleting?.linked)}
        title={`Delete "${company.name}"`}
        message={
          deleting?.linked
            ? "The company still has linked data — deleting removes ALL of it permanently:"
            : `Type the workspace ID to confirm. Every user is logged out and all data is destroyed.`
        }
        danger
        confirmLabel={deleting?.linked ? "Force delete everything" : "Delete company"}
        loading={busy}
        linked={deleting?.linked}
        typedConfirm={deleting?.linked ? undefined : company.slug}
      />
    </div>
  );
}
