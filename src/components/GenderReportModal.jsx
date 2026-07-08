import React, { useEffect, useMemo, useState } from "react";
import { getGenderSeries, getGenderSummary } from "../api/dvsg";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer
} from "recharts";

const RANGES = [
  { key: "24h", label: "Last 24h" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

function Stat({ title, male, female }) {
  const total = (male || 0) + (female || 0);
  return (
    <div style={{ flex: 1, background: "#f0f4f8", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e" }}>{total}</div>
      <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
        <span style={{ color: "#2563eb" }}>♂ {male || 0}</span>
        {"   "}
        <span style={{ color: "#db2777" }}>♀ {female || 0}</span>
      </div>
    </div>
  );
}

export default function GenderReportModal({ open, onClose, mobileId }) {
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState("24h");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || !mobileId) return;
    let cancelled = false;
    setLoading(true);
    setErr("");

    (async () => {
      const [series, sum] = await Promise.all([
        getGenderSeries(mobileId, range),
        getGenderSummary(mobileId),
      ]);
      if (cancelled) return;

      if (!series.ok) {
        setErr("Failed to load gender report");
        setRows([]);
      } else {
        setRows((series.data?.series || []).map(x => ({
          t: x.t, male: Number(x.male) || 0, female: Number(x.female) || 0,
        })));
      }
      if (sum.ok) setSummary(sum.data);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [open, mobileId, range]);

  const data = useMemo(() => rows, [rows]);
  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
    }}>
      <div style={{ width: 900, maxWidth: "95vw", background: "#fff", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Gender Count Report — {mobileId}</h3>
          <button onClick={onClose} style={{ border: 0, background: "transparent", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        {summary && (
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <Stat title="Today" male={summary.today?.male} female={summary.today?.female} />
            <Stat title="This Month" male={summary.month?.male} female={summary.month?.female} />
            <Stat title="All Time" male={summary.alltime?.male} female={summary.alltime?.female} />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              style={{
                padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                border: "1px solid #d1d5db",
                background: range === r.key ? "#1a1a2e" : "#fff",
                color: range === r.key ? "#fff" : "#374151", fontWeight: 700, fontSize: 12,
              }}>
              {r.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          {loading && <div>Loading...</div>}
          {err && <div style={{ color: "crimson" }}>{err}</div>}
          {!loading && !err && data.length === 0 && (
            <div style={{ color: "#9ca3af", padding: "40px 0", textAlign: "center" }}>
              No gender data yet for this device.
            </div>
          )}
          {!loading && !err && data.length > 0 && (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="t" tickFormatter={(v) => {
                    const d = new Date(v);
                    return range === "24h" ? d.toLocaleTimeString([], { hour: "2-digit" })
                                           : d.toLocaleDateString();
                  }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} />
                  <Legend />
                  <Bar dataKey="male" name="Male" stackId="g" fill="#2563eb" />
                  <Bar dataKey="female" name="Female" stackId="g" fill="#db2777" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
