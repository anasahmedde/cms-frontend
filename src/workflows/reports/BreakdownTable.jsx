// Per-screen breakdown: searchable + sortable, one column set per report.
// Rows navigate to the screen's Telemetry tab. Status is text+badge (never
// color alone): "No data" for silent screens, "Low uptime" under 90%.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp } from "lucide-react";
import Table from "../../ui/Table";
import Badge from "../../ui/Badge";
import SearchInput from "../../ui/SearchInput";
import EmptyState from "../../ui/EmptyState";
import { BarChart3 } from "lucide-react";
import { formatDuration } from "../../lib/format";

const LOW_UPTIME = 90;

const fmtNum = (v) => (v == null ? "—" : Number(v).toLocaleString());
const fmtC = (v) => (v == null ? "—" : `${v}°C`);
const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

const COLUMNS = {
  uptime: [
    { key: "device_name", label: "Screen", sort: (s) => (s.device_name || s.mobile_id).toLowerCase() },
    { key: "shop_name", label: "Location" },
    { key: "gname", label: "Group" },
    { key: "online_percentage", label: "Online %", sort: (s) => s.online_percentage ?? -1, align: "right",
      render: (s) => (s.no_data ? "—" : `${s.online_percentage}%`) },
    { key: "online_seconds", label: "Online time", sort: (s) => s.online_seconds, align: "right",
      render: (s) => (s.no_data ? "—" : formatDuration(s.online_seconds)) },
    { key: "online_events", label: "Sessions", sort: (s) => s.online_events, align: "right",
      render: (s) => (s.no_data ? "—" : s.online_events) },
    { key: "status", label: "Status",
      render: (s) => (s.no_data
        ? <Badge tone="neutral">No data</Badge>
        : s.online_percentage != null && s.online_percentage < LOW_UPTIME
          ? <Badge tone="warn">Low uptime</Badge>
          : <Badge tone="success">Healthy</Badge>) },
  ],
  temperature: [
    { key: "device_name", label: "Screen", sort: (s) => (s.device_name || s.mobile_id).toLowerCase() },
    { key: "shop_name", label: "Location" },
    { key: "avg", label: "Avg", sort: (s) => s.avg ?? -999, align: "right", render: (s) => fmtC(s.avg) },
    { key: "min", label: "Min", sort: (s) => s.min ?? -999, align: "right", render: (s) => fmtC(s.min) },
    { key: "max", label: "Max", sort: (s) => s.max ?? -999, align: "right", render: (s) => fmtC(s.max) },
    { key: "last", label: "Latest", align: "right",
      render: (s) => (s.no_data ? "—" : <span>{fmtC(s.last)} <span className="u-faint">{fmtWhen(s.last_at)}</span></span>) },
    { key: "readings", label: "Readings", sort: (s) => s.readings ?? 0, align: "right",
      render: (s) => (s.no_data ? <Badge tone="neutral">No data</Badge> : fmtNum(s.readings)) },
  ],
  footfall: [
    { key: "device_name", label: "Screen", sort: (s) => (s.device_name || s.mobile_id).toLowerCase() },
    { key: "shop_name", label: "Location" },
    { key: "gname", label: "Group" },
    { key: "total", label: "Visitors", sort: (s) => s.total ?? -1, align: "right",
      render: (s) => (s.no_data ? "—" : fmtNum(s.total)) },
    { key: "best", label: "Best period", sort: (s) => s.best ?? -1, align: "right",
      render: (s) => (s.no_data ? "—" : fmtNum(s.best)) },
    { key: "periods", label: "Periods", align: "right",
      render: (s) => (s.no_data ? <Badge tone="neutral">No data</Badge> : s.periods) },
  ],
};

const DEFAULT_SORT = { uptime: { key: "online_percentage", dir: 1 }, temperature: { key: "max", dir: -1 }, footfall: { key: "total", dir: -1 } };

export default function BreakdownTable({ tab, screens, loading }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(null); // {key, dir} — null = per-tab default
  const cols = COLUMNS[tab];
  const active = sort || DEFAULT_SORT[tab];

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = !needle ? screens : screens.filter((s) =>
      (s.device_name || "").toLowerCase().includes(needle) ||
      (s.mobile_id || "").toLowerCase().includes(needle) ||
      (s.shop_name || "").toLowerCase().includes(needle) ||
      (s.gname || "").toLowerCase().includes(needle));
    const col = cols.find((c) => c.key === active.key);
    if (col?.sort) {
      out = [...out].sort((a, b) => {
        const av = col.sort(a); const bv = col.sort(b);
        return (av > bv ? 1 : av < bv ? -1 : 0) * active.dir;
      });
    }
    return out;
  }, [screens, q, cols, active]);

  const header = (col) => {
    if (!col.sort) return col.label;
    const is = active.key === col.key;
    const Icon = is && active.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <button type="button" className="rpt-sort" aria-label={`Sort by ${col.label}`}
        onClick={() => setSort({ key: col.key, dir: is ? -active.dir : (DEFAULT_SORT[tab].key === col.key ? DEFAULT_SORT[tab].dir : -1) })}
        style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", font: "inherit", padding: 0, display: "inline-flex", alignItems: "center", gap: 3 }}>
        {col.label}
        {is && <Icon size={12} aria-hidden="true" />}
      </button>
    );
  };

  return (
    <>
      <div style={{ maxWidth: 340, marginBottom: 10 }}>
        <SearchInput value={q} onChange={setQ} placeholder="Search screens, locations, groups…" />
      </div>
      <Table
        columns={cols.map((c) => ({ ...c, label: header(c) }))}
        rows={rows}
        rowKey="mobile_id"
        loading={loading}
        onRowClick={(s) => navigate(`/screens/${encodeURIComponent(s.mobile_id)}?tab=telemetry`)}
        empty={
          <EmptyState icon={BarChart3}
            title={q ? "No screens match your search" : "No screens in this scope"}
            hint={q ? "Try a different name, ID, location or group." : "Widen the location/group filter above."} />
        }
      />
    </>
  );
}
