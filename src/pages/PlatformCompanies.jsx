// Companies: searchable list with status filters (incl. expired/expiring —
// the legacy separate tabs became filters), inline lifecycle actions, and the
// add-company wizard.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Plus, ExternalLink, CalendarClock } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Table from "../ui/Table";
import IconButton from "../ui/IconButton";
import SearchInput from "../ui/SearchInput";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import ConfirmModal from "../ui/ConfirmModal";
import Modal from "../ui/Modal";
import Tabs from "../ui/Tabs";
import { Field, Textarea } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { useAuth } from "../lib/auth";
import { apiGet, apiPost, normalizeList } from "../lib/api";
import { effectiveStatus, expirationLabel, plural } from "../platform/lib";
import CompanyWizard from "../platform/CompanyWizard";
import ExpirationModal from "../platform/ExpirationModal";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "trial", label: "Trial" },
  { key: "expiring", label: "Expiring soon" },
  { key: "expired", label: "Expired" },
  { key: "suspended", label: "Suspended" },
];

export default function PlatformCompanies() {
  const toast = useToast();
  const navigate = useNavigate();
  const { impersonate } = useAuth();
  const [params, setParams] = useSearchParams();
  const filter = params.get("filter") || "all";
  const [q, setQ] = useState("");
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wizard, setWizard] = useState(false);
  const [expModal, setExpModal] = useState(null);
  const [suspending, setSuspending] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [reactivating, setReactivating] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    // The endpoint caps limit at 200 (422 above it).
    const res = await apiGet("/platform/companies", { params: { q: q || undefined, limit: 200 } });
    if (res.ok) setCompanies(normalizeList(res.data, "items").items);
    else setError(res.message); // legacy rendered failures as "No companies found"
    setLoading(false);
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = companies.filter((c) => {
    const s = effectiveStatus(c).key;
    if (filter === "all") return true;
    if (filter === "expiring") return c.expires_at && s === "active" && (c.days_until_expiration ?? 999) <= 30;
    return s === filter;
  });

  const openWorkspace = async (c) => {
    const res = await impersonate(c.slug, c.name);
    if (res.ok) navigate("/");
    else toast.error(res.message || "Could not open the workspace");
  };

  const suspend = async () => {
    if (!suspendReason.trim()) return;
    setBusy(true);
    const res = await apiPost(`/platform/company/${suspending.id}/suspend`, { reason: suspendReason.trim() });
    setBusy(false);
    if (!res.ok) return toast.error(res.message);
    toast.success(`${suspending.name} suspended — ${plural(res.data?.affected_users ?? 0, "user")} logged out`);
    setSuspending(null);
    setSuspendReason("");
    load();
  };

  const reactivate = async () => {
    setBusy(true);
    const res = await apiPost(`/platform/company/${reactivating.id}/reactivate?extend_days=30`);
    setBusy(false);
    if (!res.ok) return toast.error(res.message);
    toast.success(`${reactivating.name} reactivated — subscription extended 30 days`);
    setReactivating(null);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle="Every tenant on the platform"
        actions={<Button icon={Plus} onClick={() => setWizard(true)}>Add company</Button>}
      />
      <div className="u-between" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        <Tabs tabs={FILTERS} active={filter} onChange={(k) => setParams(k === "all" ? {} : { filter: k }, { replace: true })} />
        <div style={{ minWidth: 260 }}>
          <SearchInput value={q} onChange={setQ} placeholder="Search name or workspace ID…" />
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <Table
          columns={[
            {
              key: "name",
              label: "Company",
              render: (c) => (
                <Link to={`/platform/companies/${encodeURIComponent(c.slug)}`}>
                  <strong>{c.name}</strong> <span className="u-faint mono">{c.slug}</span>
                </Link>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (c) => {
                const s = effectiveStatus(c);
                return <Badge tone={s.tone}>{s.label}</Badge>;
              },
            },
            {
              key: "expiration",
              label: "Subscription",
              render: (c) => {
                const e = expirationLabel(c);
                return <Badge tone={e.tone}>{e.label}</Badge>;
              },
            },
            { key: "device_count", label: "Screens", render: (c) => `${c.devices_online ?? 0}/${c.device_count ?? 0}` },
            { key: "user_count", label: "Users", render: (c) => c.user_count ?? 0 },
            {
              key: "actions",
              label: "",
              align: "right",
              render: (c) => {
                const s = effectiveStatus(c).key;
                return (
                  <span className="u-flex" style={{ justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                    <IconButton label={`Subscription for ${c.name}`} icon={CalendarClock} size="sm" onClick={() => setExpModal(c)} />
                    {s === "suspended" || s === "expired" ? (
                      <Button size="sm" onClick={() => setReactivating(c)}>Reactivate</Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => { setSuspending(c); setSuspendReason(""); }}>Suspend</Button>
                    )}
                    <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => openWorkspace(c)}>Open workspace</Button>
                  </span>
                );
              },
            },
          ]}
          rows={rows}
          rowKey={(c) => c.slug}
          loading={loading}
          onRowClick={(c) => navigate(`/platform/companies/${encodeURIComponent(c.slug)}`)}
          empty={
            <EmptyState
              icon={Building2}
              title={q || filter !== "all" ? "No companies match" : "No companies yet"}
              hint={q || filter !== "all" ? "Adjust the search or filter." : "Onboard the first company to get started."}
              action={!q && filter === "all" && <Button icon={Plus} onClick={() => setWizard(true)}>Add company</Button>}
            />
          }
        />
      )}

      <CompanyWizard open={wizard} onClose={() => setWizard(false)} onCreated={load} />
      <ExpirationModal company={expModal} onClose={() => setExpModal(null)} onSaved={() => { setExpModal(null); load(); }} />

      <Modal
        open={!!suspending}
        onClose={() => setSuspending(null)}
        title={`Suspend ${suspending?.name}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSuspending(null)} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={suspend} loading={busy} disabled={!suspendReason.trim()}>Suspend company</Button>
          </>
        }
      >
        <p style={{ marginTop: 0 }}>
          All users are logged out immediately and screens show the enrollment page until reactivation.
        </p>
        <Field label="Reason" required htmlFor="susp-reason">
          <Textarea id="susp-reason" rows={3} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="e.g. Payment overdue since June" />
        </Field>
      </Modal>

      <ConfirmModal
        open={!!reactivating}
        onClose={() => setReactivating(null)}
        onConfirm={reactivate}
        title={`Reactivate ${reactivating?.name}`}
        message="The company regains access immediately and its subscription is extended by 30 days."
        confirmLabel="Reactivate +30 days"
        loading={busy}
      />
    </div>
  );
}
