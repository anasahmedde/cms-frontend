// CSV export for the Reports page — proper quoting, BOM for Excel, clear
// filenames: digix-<report>-<from>_<to>.csv.

function cell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename, headers, rows) {
  const lines = [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

const hours = (s) => (s == null ? "" : (s / 3600).toFixed(2));

// Per-screen breakdown of the CURRENT filtered view, one row per screen.
export function breakdownCsv(tab, data, range) {
  const name = `digix-${tab}-screens-${range.start}_${range.end}.csv`;
  if (tab === "uptime") {
    return [name,
      ["Screen", "Device ID", "Location", "Group", "Online %", "Online hours", "Offline hours", "Sessions", "Status"],
      data.screens.map((s) => [s.device_name || "", s.mobile_id, s.shop_name || "", s.gname || "",
        s.no_data ? "" : s.online_percentage, hours(s.no_data ? null : s.online_seconds),
        hours(s.no_data ? null : s.offline_seconds), s.no_data ? "" : s.online_events,
        s.no_data ? "no data" : ""])];
  }
  if (tab === "temperature") {
    return [name,
      ["Screen", "Device ID", "Location", "Group", "Avg °C", "Min °C", "Max °C", "Last °C", "Last reading at", "Readings"],
      data.screens.map((s) => [s.device_name || "", s.mobile_id, s.shop_name || "", s.gname || "",
        s.no_data ? "" : s.avg, s.no_data ? "" : s.min, s.no_data ? "" : s.max,
        s.no_data ? "" : s.last, s.no_data ? "" : s.last_at, s.no_data ? "" : s.readings])];
  }
  return [name,
    ["Screen", "Device ID", "Location", "Group", "Total visitors", `Best ${data.grain === "monthly" ? "month" : "day"}`, "Periods reported"],
    data.screens.map((s) => [s.device_name || "", s.mobile_id, s.shop_name || "", s.gname || "",
      s.no_data ? "" : s.total, s.no_data ? "" : s.best, s.no_data ? "" : s.periods])];
}

// The aggregate time series behind the chart.
export function seriesCsv(tab, data, range) {
  const name = `digix-${tab}-series-${range.start}_${range.end}.csv`;
  if (tab === "temperature") {
    return [name, ["Time", "Avg °C", "Min °C", "Max °C", "Readings"],
      data.series.map((p) => [p.t, p.avg, p.min, p.max, p.readings])];
  }
  // footfall
  return [name, [data.grain === "monthly" ? "Month" : "Date", "Total visitors"],
    data.series.map((p) => [p.t, p.total])];
}
