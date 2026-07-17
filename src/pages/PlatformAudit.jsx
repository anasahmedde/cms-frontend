// Audit log — the trail was always collected but never displayed anywhere.
import { useCallback, useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import Badge from "../ui/Badge";
import Table from "../ui/Table";
import SearchInput from "../ui/SearchInput";
import ErrorState from "../ui/ErrorState";
import EmptyState from "../ui/EmptyState";
import Pagination from "../ui/Pagination";
import { Field, Select } from "../ui/Field";
import { apiGet, normalizeList } from "../lib/api";
import { formatDateTime } from "../lib/format";

const ACTION_TONES = { create: "success", update: "info", delete: "danger", suspend: "danger", login: "neutral", logout: "neutral" };
const PAGE_SIZE = 50;

export default function PlatformAudit() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await apiGet("/platform/audit-log", {
      params: {
        action: action || undefined,
        resource_type: resource || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      },
    });
    if (res.ok) {
      const { items, total: t } = normalizeList(res.data, "items");
      setRows(items);
      setTotal(t);
    } else {
      setError(res.message);
    }
    setLoading(false);
  }, [action, resource, page]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = q
    ? rows.filter((r) =>
        [r.username, r.action, r.resource_type, r.resource_id, JSON.stringify(r.details)]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())
      )
    : rows;

  const toneFor = (a) => ACTION_TONES[(a || "").split(".").pop()] || "neutral";

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Who did what, across the platform" />
      <div className="u-flex" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        <Field label="Action" htmlFor="audit-action">
          <Select
            id="audit-action"
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            options={[
              { value: "", label: "All actions" },
              { value: "user.login", label: "Logins" },
              { value: "user.logout", label: "Logouts" },
              { value: "company.create", label: "Company created" },
              { value: "company.update", label: "Company updated" },
              { value: "company.suspend", label: "Company suspended" },
              { value: "company.delete", label: "Company deleted" },
              { value: "template.link", label: "Template linked" },
            ]}
          />
        </Field>
        <Field label="Resource" htmlFor="audit-resource">
          <Select
            id="audit-resource"
            value={resource}
            onChange={(e) => { setResource(e.target.value); setPage(1); }}
            options={[
              { value: "", label: "All resources" },
              { value: "user", label: "Users" },
              { value: "company", label: "Companies" },
              { value: "template", label: "Templates" },
            ]}
          />
        </Field>
        <div style={{ flex: 1, minWidth: 220, alignSelf: "flex-end" }}>
          <SearchInput value={q} onChange={setQ} placeholder="Filter loaded entries…" />
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <Table
            columns={[
              { key: "created_at", label: "When", render: (r) => formatDateTime(r.created_at), width: 170 },
              { key: "username", label: "User", render: (r) => r.username || "system" },
              { key: "action", label: "Action", render: (r) => <Badge tone={toneFor(r.action)}>{r.action}</Badge> },
              { key: "resource", label: "Resource", render: (r) => (r.resource_type ? `${r.resource_type}${r.resource_id ? ` #${r.resource_id}` : ""}` : "—") },
              {
                key: "details",
                label: "Details",
                render: (r) =>
                  r.details && Object.keys(r.details).length ? (
                    <span className="u-faint mono" style={{ fontSize: 11 }}>
                      {JSON.stringify(r.details).slice(0, 80)}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              { key: "ip_address", label: "IP", mono: true, render: (r) => r.ip_address || "—" },
            ]}
            rows={filtered}
            rowKey={(r) => r.id}
            loading={loading}
            empty={<EmptyState icon={ScrollText} title="No audit entries" hint="Actions appear here as they happen." />}
          />
          <div style={{ marginTop: 10 }}>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
