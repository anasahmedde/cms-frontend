// Reports: temperature / uptime / footfall analytics per screen, with CSV
// export. Fixes ported from the audit: "Select all" respects the search
// filter; fetches run in parallel with cancellation; failures are visible.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, RefreshCw, Thermometer, Timer, BarChart3, TrendingUp } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Tabs from "../ui/Tabs";
import SearchInput from "../ui/SearchInput";
import ErrorState from "../ui/ErrorState";
import EmptyState from "../ui/EmptyState";
import KeyValue from "../ui/KeyValue";
import { SkeletonText } from "../ui/Skeleton";
import { Field, Select, Input, Checkbox } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { apiGet, normalizeList } from "../lib/api";
import { useCompanyFeatures } from "../lib/features";
import { formatDuration, formatPercent } from "../lib/format";
import { LineChart, BarChart } from "../workflows/reports/charts";
import useReportData from "../workflows/reports/useReportData";

const TABS = [
  { key: "temperature", label: "Temperature", icon: Thermometer },
  { key: "uptime", label: "Uptime", icon: Timer },
  { key: "daily", label: "Daily footfall", icon: BarChart3 },
  { key: "monthly", label: "Monthly footfall", icon: TrendingUp },
];

const PRESETS = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const CSV_HEADERS = {
  temperature: "Device,Timestamp,Temperature (°C)",
  uptime: "Device,Online Seconds,Offline Seconds,Online %,Online Events,Offline Events,First Event,Last Event",
  daily: "Device,Date,Count",
  monthly: "Device,Month,Count",
};

function csvRows(tab, id, entry) {
  if (!entry?.rows) return [];
  if (tab === "temperature") {
    return entry.rows.map((r) => `${id},${r.logged_at || r.time},${r.value}`);
  }
  if (tab === "uptime") {
    const u = entry.rows;
    return [
      `${id},${u.online_seconds ?? ""},${u.offline_seconds ?? ""},${u.online_percentage ?? ""},${u.online_events ?? ""},${u.offline_events ?? ""},${u.first_event ?? ""},${u.last_event ?? ""}`,
    ];
  }
  return entry.rows.map((r) => `${id},${r.label},${r.value}`);
}

export default function Reports() {
  const toast = useToast();
  const { features } = useCompanyFeatures();
  const [devices, setDevices] = useState([]);
  const [devError, setDevError] = useState("");
  const [devLoading, setDevLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]);
  const visibleTabs = TABS.filter(
    (t) =>
      t.key === "uptime" ||
      (t.key === "temperature" ? features.temperature : features.footfall)
  );
  const [tab, setTab] = useState("uptime");
  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === tab)) setTab("uptime");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs.length]);
  const [preset, setPreset] = useState("7");
  const [custom, setCustom] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { byDevice, load, clear } = useReportData();

  const loadDevices = async () => {
    setDevLoading(true);
    setDevError("");
    const res = await apiGet("/devices", { params: { limit: 500, offset: 0 } });
    if (res.ok) setDevices(normalizeList(res.data, "items").items);
    else setDevError(res.message);
    setDevLoading(false);
  };

  useEffect(() => {
    loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return devices;
    return devices.filter(
      (d) =>
        (d.device_name || "").toLowerCase().includes(needle) ||
        (d.mobile_id || "").toLowerCase().includes(needle)
    );
  }, [devices, q]);

  const range = useMemo(() => {
    if (custom && startDate) return { startDate, endDate: endDate || undefined };
    const start = new Date(Date.now() - Number(preset) * 86400000);
    return { startDate: start.toISOString().slice(0, 10), endDate: undefined };
  }, [custom, startDate, endDate, preset]);

  const run = () => {
    if (selected.length === 0) {
      clear();
      return;
    }
    load(tab, selected, range);
  };

  // Reload when tab/selection/range changes.
  useEffect(run, [tab, selected, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((d) => selected.includes(d.mobile_id));
  const toggleAll = () => {
    const ids = filtered.map((d) => d.mobile_id);
    setSelected(allFilteredSelected ? selected.filter((s) => !ids.includes(s)) : [...new Set([...selected, ...ids])]);
  };

  const exportCsv = (ids) => {
    const lines = [CSV_HEADERS[tab]];
    ids.forEach((id) => lines.push(...csvRows(tab, id, byDevice[id])));
    if (lines.length === 1) {
      toast.info("Nothing to export for the current selection and period.");
      return;
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${tab}_report_${ids.length === 1 ? ids[0] : "all"}_${range.startDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const renderDeviceReport = (id) => {
    const entry = byDevice[id];
    const device = devices.find((d) => d.mobile_id === id);
    return (
      <Card
        key={id}
        title={
          <span className="u-flex">
            <Link to={`/screens/${encodeURIComponent(id)}`}>{device?.device_name || id}</Link>
            <span className="mono u-faint">{id}</span>
          </span>
        }
        actions={<Button variant="ghost" size="sm" icon={Download} onClick={() => exportCsv([id])}>Export</Button>}
      >
        {!entry || entry.loading ? (
          <SkeletonText lines={4} />
        ) : entry.error ? (
          <ErrorState message={entry.error} onRetry={run} />
        ) : tab === "temperature" ? (
          <LineChart data={entry.rows} title={`Temperature (${custom ? "custom range" : PRESETS.find((p) => p.value === preset)?.label})`} yLabel="°C" color="var(--danger)" />
        ) : tab === "uptime" ? (
          entry.rows ? (
            <KeyValue
              columns={4}
              items={[
                { label: "Uptime", value: formatPercent(entry.rows.online_percentage) },
                { label: "Online", value: formatDuration(entry.rows.online_seconds) },
                { label: "Offline", value: formatDuration(entry.rows.offline_seconds) },
                { label: "Sessions", value: entry.rows.online_events ?? "—" },
              ]}
            />
          ) : (
            <span className="u-muted">No uptime data available</span>
          )
        ) : (
          <BarChart
            data={tab === "daily" ? entry.rows.slice(-30) : entry.rows.slice(-12)}
            title={tab === "daily" ? "Daily footfall count" : "Monthly footfall count"}
            yLabel="Count"
            color={tab === "daily" ? "var(--success)" : "var(--info)"}
          />
        )}
      </Card>
    );
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Temperature, uptime, and footfall analytics per screen"
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={run} disabled={selected.length === 0}>Refresh</Button>
            <Button icon={Download} onClick={() => exportCsv(selected)} disabled={selected.length === 0}>
              Export all ({selected.length})
            </Button>
          </>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>
        <Card title="Screens">
          <SearchInput value={q} onChange={setQ} placeholder="Search screens…" />
          <div style={{ margin: "10px 0" }}>
            <Checkbox
              label={`Select all (${filtered.length})`}
              checked={allFilteredSelected}
              onChange={toggleAll}
            />
          </div>
          {devError ? (
            <ErrorState message={devError} onRetry={loadDevices} />
          ) : devLoading ? (
            <SkeletonText lines={5} />
          ) : filtered.length === 0 ? (
            <span className="u-muted">{q ? "No screens match your search" : "No screens found"}</span>
          ) : (
            <div style={{ maxHeight: 420, overflowY: "auto", display: "grid", gap: 4 }}>
              {filtered.map((d) => (
                <Checkbox
                  key={d.mobile_id}
                  label={`${d.device_name || d.mobile_id}`}
                  checked={selected.includes(d.mobile_id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, d.mobile_id]
                        : selected.filter((s) => s !== d.mobile_id)
                    )
                  }
                />
              ))}
            </div>
          )}
          <p className="u-faint" style={{ marginBottom: 0 }}>{selected.length} selected</p>
        </Card>

        <div>
          <div className="u-between" style={{ marginBottom: 12, flexWrap: "wrap" }}>
            <Tabs tabs={visibleTabs} active={tab} onChange={setTab} />
            <div className="u-flex">
              {custom ? (
                <>
                  <Field label="Start" htmlFor="rep-start">
                    <Input id="rep-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </Field>
                  <Field label="End" htmlFor="rep-end">
                    <Input id="rep-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </Field>
                </>
              ) : (
                <Field label="Period" htmlFor="rep-preset">
                  <Select id="rep-preset" value={preset} onChange={(e) => setPreset(e.target.value)} options={PRESETS} />
                </Field>
              )}
              <Button variant="ghost" size="sm" onClick={() => setCustom(!custom)}>
                {custom ? "Presets" : "Custom range"}
              </Button>
            </div>
          </div>

          {selected.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Select screens to view reports"
              hint="Pick one or more screens from the list on the left."
            />
          ) : (
            <div style={{ display: "grid", gap: 14 }}>{selected.map(renderDeviceReport)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
