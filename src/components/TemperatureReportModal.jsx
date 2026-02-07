import React, { useEffect, useMemo, useState } from "react";
import { getDeviceTemperatureSeries } from "../api/dvsg";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";

export default function TemperatureReportModal({ open, onClose, mobileId }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || !mobileId) return;

    let cancelled = false;
    setLoading(true);
    setErr("");

    (async () => {
      const r = await getDeviceTemperatureSeries(mobileId, 30, "day");
      if (cancelled) return;

      if (!r.ok) {
        setErr("Failed to load temperature report");
        setRows([]);
      } else {
        const items = (r.data?.items || []).map(x => ({
          t: x.t,
          temperature: Number(x.temperature),
        }));
        setRows(items);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [open, mobileId]);

  const data = useMemo(() => rows, [rows]);

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
    }}>
      <div style={{ width: 900, maxWidth: "95vw", background: "#fff", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Temperature Report — {mobileId}</h3>
          <button onClick={onClose} style={{ border: 0, background: "transparent", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ marginTop: 12 }}>
          {loading && <div>Loading...</div>}
          {err && <div style={{ color: "crimson" }}>{err}</div>}

          {!loading && !err && (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="t"
                    tickFormatter={(v) => new Date(v).toLocaleDateString()}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(v) => new Date(v).toLocaleString()}
                  />
                  <Line type="monotone" dataKey="temperature" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

