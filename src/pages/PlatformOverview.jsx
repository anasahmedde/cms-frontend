// Platform Overview — cross-company analytics where every row is actionable
// (legacy showed data with no click-through anywhere).
import { Link, useNavigate } from "react-router-dom";
import {
  Building2, MonitorPlay, UsersRound, Film, Image as ImageIcon, HardDrive,
  RefreshCw, Megaphone, AlertTriangle,
} from "lucide-react";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import StatCard from "../ui/StatCard";
import Table from "../ui/Table";
import ProgressBar from "../ui/ProgressBar";
import ErrorState from "../ui/ErrorState";
import EmptyState from "../ui/EmptyState";
import { SkeletonText } from "../ui/Skeleton";
import { usePlatformDashboard, effectiveStatus, plural } from "../platform/lib";

function storageLabel(mb) {
  if (mb == null) return "—";
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

export default function PlatformOverview() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = usePlatformDashboard();

  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Platform Overview" subtitle="Real-time analytics across all companies" />
        <SkeletonText lines={8} />
      </div>
    );
  }

  const d = data || {};
  const expired = d.expired_companies_list || [];
  const expiring = d.expiring_companies || [];
  const companies = d.companies || [];
  const versions = d.fleet_versions || [];

  return (
    <div>
      <PageHeader
        title="Platform Overview"
        subtitle="Real-time analytics across all companies"
        actions={
          <>
            <Link to="/platform/announcements"><Button variant="secondary" icon={Megaphone}>Announce</Button></Link>
            <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading}>Refresh</Button>
          </>
        }
      />

      {expired.length > 0 && (
        <Card padding={12}>
          <span className="u-flex">
            <AlertTriangle size={16} className="u-danger" aria-hidden="true" />
            <strong className="u-danger">{plural(expired.length, "company")} expired</strong>
            <span className="u-muted">— users blocked, screens show the enrollment page:</span>
            {expired.slice(0, 5).map((c) => (
              <Link key={c.slug || c.name} to={`/platform/companies/${encodeURIComponent(c.slug)}`}>
                <Badge tone="danger">{c.name}</Badge>
              </Link>
            ))}
            {expired.length > 5 && <span className="u-faint">+{expired.length - 5} more</span>}
          </span>
        </Card>
      )}
      {expired.length === 0 && expiring.length > 0 && (
        <Card padding={12}>
          <span className="u-flex">
            <Badge tone="warn">{plural(expiring.length, "company")} expiring soon</Badge>
            {expiring.slice(0, 5).map((c) => (
              <Link key={c.slug || c.name} to={`/platform/companies/${encodeURIComponent(c.slug)}`}>
                <Badge tone="neutral">{c.name} · {c.days_until_expiration}d</Badge>
              </Link>
            ))}
          </span>
        </Card>
      )}

      <div className="u-grid-cards" style={{ margin: "14px 0" }}>
        <StatCard icon={Building2} label="Companies" value={d.total_companies ?? 0} hint={`${d.active_companies ?? 0} active`} onClick={() => navigate("/platform/companies")} />
        <StatCard icon={MonitorPlay} label="Screens" value={d.total_devices ?? 0} hint={`${d.devices_online ?? 0} online · ${d.devices_offline ?? 0} offline`} tone="info" />
        <StatCard icon={UsersRound} label="Company users" value={d.total_users ?? 0} tone="neutral" />
        <StatCard icon={Film} label="Videos" value={d.total_videos ?? 0} tone="neutral" />
        <StatCard icon={ImageIcon} label="Images" value={d.total_advertisements ?? 0} tone="neutral" />
        <StatCard icon={HardDrive} label="Est. storage" value={storageLabel(d.estimated_storage_mb)} hint={`${d.total_files ?? 0} files (estimate)`} tone="neutral" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "start" }}>
        <Card title={`Companies (${companies.length})`}>
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
                key: "devices",
                label: "Screens",
                render: (c) => {
                  const total = c.device_count ?? 0;
                  const online = c.devices_online ?? 0;
                  return total === 0 ? (
                    <span className="u-faint">none</span>
                  ) : (
                    <span className="u-flex">
                      {online}/{total}
                      <span style={{ width: 60 }}><ProgressBar value={(online / total) * 100} height={5} tone={online / total >= 0.75 ? "success" : online > 0 ? "warn" : "danger"} /></span>
                    </span>
                  );
                },
              },
              { key: "user_count", label: "Users", render: (c) => c.user_count ?? 0 },
              { key: "video_count", label: "Videos", render: (c) => c.video_count ?? 0 },
              { key: "ad_count", label: "Images", render: (c) => c.advertisement_count ?? c.ad_count ?? 0 },
            ]}
            rows={companies}
            rowKey={(c) => c.slug || c.name}
            loading={loading && companies.length === 0}
            onRowClick={(c) => navigate(`/platform/companies/${encodeURIComponent(c.slug)}`)}
            empty={<EmptyState icon={Building2} title="No companies yet" action={<Link to="/platform/companies"><Button>Add company</Button></Link>} />}
          />
        </Card>

        <div style={{ display: "grid", gap: 16 }}>
          <Card title="Player versions">
            {versions.length === 0 ? (
              <span className="u-muted">No version reports yet — screens report on their next heartbeat.</span>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {versions.map((v) => (
                  <div key={String(v.app_version)} className="u-between">
                    <span className="mono">{v.app_version || "unknown"}</span>
                    <span className="u-flex" style={{ width: 120 }}>
                      <ProgressBar value={(v.count / (d.total_devices || 1)) * 100} height={6} />
                      <span className="u-muted">{v.count}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Content distribution">
            {[
              ["Videos", d.total_videos ?? 0],
              ["Images", d.total_advertisements ?? 0],
              ["Groups", d.total_groups ?? 0],
              ["Locations", d.total_shops ?? 0],
            ].map(([label, value]) => {
              const max = Math.max(d.total_videos ?? 0, d.total_advertisements ?? 0, d.total_groups ?? 0, d.total_shops ?? 0, 1);
              return (
                <div key={label} className="u-between" style={{ marginBottom: 6 }}>
                  <span className="u-muted" style={{ width: 80 }}>{label}</span>
                  <span className="u-flex" style={{ flex: 1 }}>
                    <span style={{ flex: 1 }}><ProgressBar value={(value / max) * 100} height={6} tone="info" /></span>
                    <strong style={{ width: 32, textAlign: "right" }}>{value}</strong>
                  </span>
                </div>
              );
            })}
          </Card>
          <Card title="Screens online">
            <div className="u-flex" style={{ marginBottom: 6 }}>
              <Badge tone="success">{d.devices_online ?? 0} online</Badge>
              <Badge tone="danger">{d.devices_offline ?? 0} offline</Badge>
            </div>
            <ProgressBar value={((d.devices_online ?? 0) / ((d.total_devices || 1))) * 100} tone="success" label={`${Math.round(((d.devices_online ?? 0) / (d.total_devices || 1)) * 100)}%`} />
          </Card>
        </div>
      </div>
    </div>
  );
}
