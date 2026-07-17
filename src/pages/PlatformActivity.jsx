// User activity: sessions, currently-online users, daily logins, per-user
// summary. Ported from the legacy dashboard's Activity tab with visible
// error states (legacy swallowed failures silently).
import { useCallback, useEffect, useState } from "react";
import { Activity, UsersRound, MousePointerClick } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Card from "../ui/Card";
import StatCard from "../ui/StatCard";
import Table from "../ui/Table";
import ErrorState from "../ui/ErrorState";
import EmptyState from "../ui/EmptyState";
import { SkeletonText } from "../ui/Skeleton";
import { apiGet } from "../lib/api";
import { formatDuration, formatDateTime, timeAgo } from "../lib/format";
import { BarChart } from "../workflows/reports/charts";

const PERIODS = [7, 14, 30];

export default function PlatformActivity() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await apiGet("/platform/user-activity", { params: { days, limit: 200 } });
    if (res.ok) setData(res.data);
    else setError(res.message);
  }, [days]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <SkeletonText lines={8} />;

  const activeUsers = data.active_users || [];
  const sessions = data.sessions || [];
  const summaries = data.user_summaries || [];
  const daily = (data.daily_logins || []).map((d) => ({ label: d.date?.slice(5), value: d.logins ?? d.count ?? 0 }));

  return (
    <div>
      <PageHeader
        title="User activity"
        subtitle="Dashboard logins and usage across companies"
        actions={
          <span className="u-flex">
            {PERIODS.map((p) => (
              <Button key={p} size="sm" variant={days === p ? "primary" : "secondary"} onClick={() => setDays(p)}>
                {p}d
              </Button>
            ))}
          </span>
        }
      />

      <div className="u-grid-cards" style={{ marginBottom: 16 }}>
        <StatCard icon={UsersRound} label="Online now" value={activeUsers.length} tone="success" />
        <StatCard icon={Activity} label={`Sessions (${days}d)`} value={sessions.length} tone="info" />
        <StatCard icon={MousePointerClick} label="Pages tracked" value={data.total_page_visits ?? data.page_visits_total ?? "—"} tone="neutral" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <Card title="Daily logins">
          <BarChart data={daily} title={`Logins — last ${days} days`} yLabel="Logins" color="var(--info)" height={240} />
        </Card>

        <Card title={`Currently online (${activeUsers.length})`}>
          {activeUsers.length === 0 ? (
            <span className="u-muted">Nobody is online right now.</span>
          ) : (
            <div className="u-flex" style={{ flexWrap: "wrap" }}>
              {activeUsers.map((u, i) => (
                <Badge key={u.username || i} tone="success">
                  {u.username} · {u.company_name || "Platform"} · {timeAgo(u.login_at || u.last_login)}
                </Badge>
              ))}
            </div>
          )}
        </Card>

        <Card title="User summary">
          <Table
            columns={[
              { key: "username", label: "User" },
              { key: "company_name", label: "Company", render: (u) => u.company_name || <Badge tone="warn">Platform</Badge> },
              { key: "session_count", label: "Sessions", render: (u) => u.session_count ?? u.sessions ?? 0 },
              { key: "total_time", label: "Total time", render: (u) => formatDuration(u.total_seconds ?? u.total_time_seconds) },
              { key: "last_login", label: "Last login", render: (u) => timeAgo(u.last_login) },
              { key: "online", label: "", render: (u) => (u.is_online ? <Badge tone="success">online</Badge> : null) },
            ]}
            rows={summaries}
            rowKey={(u, i) => u.username || i}
            loading={false}
            empty={<EmptyState icon={UsersRound} title="No activity recorded yet" />}
          />
        </Card>

        <Card title="Recent sessions">
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <Table
              columns={[
                { key: "username", label: "User" },
                { key: "company_name", label: "Company", render: (s) => s.company_name || "Platform" },
                { key: "login_at", label: "Login", render: (s) => formatDateTime(s.login_at) },
                { key: "logout_at", label: "Logout", render: (s) => (s.logout_at ? formatDateTime(s.logout_at) : <Badge tone="success">active</Badge>) },
                { key: "duration", label: "Duration", render: (s) => formatDuration(s.duration_seconds) },
              ]}
              rows={sessions.slice(0, 50)}
              rowKey={(s, i) => s.id || i}
              loading={false}
              stickyHeader
              empty={<EmptyState icon={Activity} title="No sessions recorded yet" />}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
