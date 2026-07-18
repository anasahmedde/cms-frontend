// Reports — fleet-wide analytics. One aggregate request per view (not one per
// screen): KPI tiles → aggregate chart → searchable/sortable per-screen
// breakdown. Filters live in the URL (shareable), CSV export covers exactly
// the current filtered view. Temperature/footfall appear ONLY when the
// company feature is enabled — and the backend enforces the same flags.
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, RefreshCw, Thermometer, Timer, Footprints } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Tabs from "../ui/Tabs";
import StatCard from "../ui/StatCard";
import ErrorState from "../ui/ErrorState";
import EmptyState from "../ui/EmptyState";
import { SkeletonText } from "../ui/Skeleton";
import { Field, Select, Input } from "../ui/Field";
import { apiGet, normalizeList } from "../lib/api";
import { useCompanyFeatures, featureOn } from "../lib/features";
import { formatDuration } from "../lib/format";
import useAggregateReport from "../workflows/reports/useAggregateReport";
import { TrendChart, ColumnChart, RankBars } from "../workflows/reports/charts";
import BreakdownTable from "../workflows/reports/BreakdownTable";
import { downloadCsv, breakdownCsv, seriesCsv } from "../workflows/reports/csv";
import { useState } from "react";

const PRESETS = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const iso = (d) => d.toISOString().slice(0, 10);
const fmtNum = (v) => (v == null ? "—" : Number(v).toLocaleString());

export default function Reports() {
  const { features, loaded: featuresLoaded } = useCompanyFeatures();
  const [params, setParams] = useSearchParams();

  const tabs = useMemo(() => [
    { key: "uptime", label: "Uptime", icon: Timer },
    ...(featureOn(features, "temperature") ? [{ key: "temperature", label: "Temperature", icon: Thermometer }] : []),
    ...(featureOn(features, "footfall") ? [{ key: "footfall", label: "Footfall", icon: Footprints }] : []),
  ], [features]);

  const tab = tabs.some((t) => t.key === params.get("tab")) ? params.get("tab") : "uptime";
  const preset = params.get("preset") || "7";
  const customFrom = params.get("from") || "";
  const customTo = params.get("to") || "";
  const custom = !!customFrom;
  const grain = params.get("grain") === "monthly" ? "monthly" : "daily";
  const shopId = params.get("shop") || "";
  const groupId = params.get("group") || "";

  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const range = useMemo(() => {
    if (custom) return { start: customFrom, end: customTo || iso(new Date()) };
    const days = Number(preset);
    return { start: iso(new Date(Date.now() - (days - 1) * 86400000)), end: iso(new Date()) };
  }, [custom, customFrom, customTo, preset]);

  const [shops, setShops] = useState([]);
  const [groups, setGroups] = useState([]);
  useEffect(() => {
    apiGet("/shops", { params: { limit: 1000, offset: 0 } }).then(
      (res) => res.ok && setShops(normalizeList(res.data, "items").items));
    apiGet("/groups", { params: { limit: 1000, offset: 0 } }).then(
      (res) => res.ok && setGroups(normalizeList(res.data, "items").items));
  }, []);

  const { data, loading, error, reload } = useAggregateReport({
    tab, grain, start: range.start, end: range.end,
    shopId: shopId || undefined, groupId: groupId || undefined,
  });

  const s = data?.summary;
  const kpis = useMemo(() => {
    if (!s) return [];
    if (tab === "uptime") {
      return [
        { label: "Fleet uptime", value: s.fleet_online_percentage != null ? `${s.fleet_online_percentage}%` : "—", hint: `${s.screens_reporting}/${s.screens_total} screens reporting` },
        { label: "Online time", value: formatDuration(s.total_online_seconds), hint: "total across the fleet" },
        { label: "Offline time", value: formatDuration(s.total_offline_seconds), hint: "total across the fleet" },
        { label: "Needs attention", value: s.worst ? `${s.worst.online_percentage}%` : "—", hint: s.worst ? s.worst.device_name || s.worst.mobile_id : "no screen reported" },
      ];
    }
    if (tab === "temperature") {
      return [
        { label: "Average", value: s.avg != null ? `${s.avg}°C` : "—", hint: `${fmtNum(s.readings)} readings` },
        { label: "Peak", value: s.peak ? `${s.peak.value}°C` : "—", hint: s.peak ? `on ${s.peak.device_name || s.peak.mobile_id}` : "no readings" },
        { label: "Lowest", value: s.low != null ? `${s.low}°C` : "—", hint: "across the period" },
        { label: "Reporting", value: `${s.screens_reporting}/${s.screens_total}`, hint: "screens with a BLE probe" },
      ];
    }
    return [
      { label: "Total visitors", value: fmtNum(s.total), hint: `${range.start} → ${range.end}` },
      { label: grain === "monthly" ? "Per month" : "Per day", value: fmtNum(s.per_period_avg), hint: "average over the period" },
      { label: grain === "monthly" ? "Best month" : "Busiest day", value: s.best_period ? fmtNum(s.best_period.total) : "—", hint: s.best_period ? s.best_period.t : "no counts yet" },
      { label: "Top screen", value: s.top_screen ? fmtNum(s.top_screen.total) : "—", hint: s.top_screen ? s.top_screen.device_name || s.top_screen.mobile_id : "no counts yet" },
    ];
  }, [tab, s, grain, range]);

  const exportBreakdown = () => {
    if (!data) return;
    const [name, headers, rows] = breakdownCsv(tab, data, data.range);
    downloadCsv(name, headers, rows);
  };
  const exportSeries = () => {
    if (!data) return;
    const [name, headers, rows] = seriesCsv(tab, data, data.range);
    downloadCsv(name, headers, rows);
  };

  const subtitleParts = ["uptime", featureOn(features, "temperature") && "temperature", featureOn(features, "footfall") && "footfall"].filter(Boolean);

  if (!featuresLoaded) {
    return (
      <div>
        <PageHeader title="Reports" subtitle="Loading available reports…" />
        <SkeletonText lines={6} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={`Fleet ${subtitleParts.join(", ")} analytics — filter, then download exactly what you see`}
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading}>Refresh</Button>
            <Button icon={Download} onClick={exportBreakdown} disabled={!data || !data.screens?.length}>
              Download CSV
            </Button>
          </>
        }
      />

      <Card padding={12}>
        <div className="u-flex" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
          {tabs.length > 1 && (
            <Tabs tabs={tabs} active={tab} onChange={(k) => setParam({ tab: k === "uptime" ? "" : k })} />
          )}
          {tab === "footfall" && (
            <Field label="Granularity" htmlFor="rep-grain">
              <Select id="rep-grain" value={grain}
                onChange={(e) => setParam({ grain: e.target.value === "monthly" ? "monthly" : "" })}
                options={[{ value: "daily", label: "Daily" }, { value: "monthly", label: "Monthly" }]} />
            </Field>
          )}
          {custom ? (
            <>
              <Field label="From" htmlFor="rep-from">
                <Input id="rep-from" type="date" value={customFrom} max={customTo || undefined}
                  onChange={(e) => setParam({ from: e.target.value })} />
              </Field>
              <Field label="To" htmlFor="rep-to">
                <Input id="rep-to" type="date" value={customTo} min={customFrom || undefined}
                  onChange={(e) => setParam({ to: e.target.value })} />
              </Field>
              <Button variant="ghost" size="sm" onClick={() => setParam({ from: "", to: "" })}>Use presets</Button>
            </>
          ) : (
            <>
              <Field label="Period" htmlFor="rep-preset">
                <Select id="rep-preset" value={preset}
                  onChange={(e) => setParam({ preset: e.target.value === "7" ? "" : e.target.value })}
                  options={PRESETS} />
              </Field>
              <Button variant="ghost" size="sm"
                onClick={() => setParam({ from: range.start, to: range.end })}>
                Custom range
              </Button>
            </>
          )}
          <Field label="Location" htmlFor="rep-shop">
            <Select id="rep-shop" value={shopId} onChange={(e) => setParam({ shop: e.target.value })}
              placeholder="All locations"
              options={shops.map((x) => ({ value: String(x.id), label: x.shop_name }))} />
          </Field>
          <Field label="Group" htmlFor="rep-group">
            <Select id="rep-group" value={groupId} onChange={(e) => setParam({ group: e.target.value })}
              placeholder="All groups"
              options={groups.map((x) => ({ value: String(x.id), label: x.gname }))} />
          </Field>
        </div>
      </Card>

      {error ? (
        <div style={{ marginTop: 16 }}><ErrorState message={error} onRetry={reload} /></div>
      ) : (
        <>
          <div className="u-grid-cards" style={{ margin: "16px 0" }}>
            {(kpis.length ? kpis : Array.from({ length: 4 }, (_, i) => ({ label: "…", value: "", skeleton: true, key: i }))).map((k, i) => (
              <StatCard key={k.label + i} label={k.label} value={k.skeleton ? "…" : k.value} hint={k.hint} />
            ))}
          </div>

          <Card
            title={tab === "uptime" ? "Screens by uptime — lowest first"
              : tab === "temperature" ? "Temperature across the fleet"
              : grain === "monthly" ? "Visitors per month" : "Visitors per day"}
            actions={tab !== "uptime" && data?.series?.length ? (
              <Button variant="ghost" size="sm" icon={Download} onClick={exportSeries}>Series CSV</Button>
            ) : null}
          >
            {loading && !data ? (
              <SkeletonText lines={6} />
            ) : tab === "uptime" ? (
              data?.screens?.some((x) => !x.no_data) ? (
                <>
                  <p className="u-muted" style={{ margin: "0 0 10px" }}>
                    Share of the period each screen was online. Screens with no events in the period are listed in the table as “No data”.
                  </p>
                  <RankBars
                    items={data.screens.filter((x) => !x.no_data).map((x) => ({
                      key: x.mobile_id,
                      label: x.device_name || x.mobile_id,
                      pct: x.online_percentage,
                      display: `${x.online_percentage}%`,
                    }))}
                  />
                </>
              ) : (
                <EmptyState icon={Timer} title="No uptime events in this period"
                  hint="Screens report online/offline events as they connect — widen the period or check the fleet." />
              )
            ) : tab === "temperature" ? (
              data?.series?.length ? (
                <>
                  <p className="u-muted" style={{ margin: "0 0 10px" }}>
                    Average across reporting screens per {data.bucket}; the shaded band is the min–max spread.
                  </p>
                  <TrendChart
                    points={data.series.map((p) => ({ t: p.t, value: p.avg, min: p.min, max: p.max }))}
                    unit="°C" bucket={data.bucket} label="Avg temperature"
                  />
                </>
              ) : (
                <EmptyState icon={Thermometer} title="No temperature readings in this period"
                  hint="Only screens with a BLE temperature probe report readings." />
              )
            ) : data?.series?.length ? (
              <ColumnChart
                points={data.series.map((p) => ({ t: p.t, value: p.total }))}
                bucket={grain === "monthly" ? "month" : "day"} label="Visitors"
              />
            ) : (
              <EmptyState icon={Footprints} title="No footfall counts in this period"
                hint="Only screens with a door sensor report visitor counts." />
            )}
          </Card>

          <div style={{ marginTop: 16 }}>
            <Card title={`Per-screen breakdown${data ? ` (${data.screens.length})` : ""}`}>
              <BreakdownTable tab={tab} screens={data?.screens || []} loading={loading && !data} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
