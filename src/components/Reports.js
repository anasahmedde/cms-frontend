// src/components/Reports.js
// Comprehensive Reports Dashboard with Temperature, Uptime, Daily Count, Monthly Count
import React, { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE_URL || 
  "https://api-staging-cms.wizioners.com";

// Device API is on port 8000
const DEVICE_BASE = process.env.REACT_APP_DEVICE_API_URL || 
  "https://api-staging-cms.wizioners.com";

const api = axios.create({ baseURL: API_BASE, timeout: 30000 });
const deviceApi = axios.create({ baseURL: DEVICE_BASE, timeout: 30000 });

// ===== Chart Component =====
function LineChart({ data, title, yLabel, color = "#3b82f6", height = 300 }) {
  const chartWidth = 700;
  const padding = { top: 30, right: 40, bottom: 50, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const processed = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data
      .map(d => ({ time: new Date(d.time || d.logged_at || d.date), value: parseFloat(d.value || d.count || 0) }))
      .filter(d => !isNaN(d.value) && d.time instanceof Date && !isNaN(d.time))
      .sort((a, b) => a.time - b.time);
  }, [data]);

  if (processed.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
        No data available for the selected period
      </div>
    );
  }

  const minTime = processed[0].time.getTime();
  const maxTime = processed[processed.length - 1].time.getTime();
  const timeRange = maxTime - minTime || 1;
  
  const values = processed.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valRange = maxVal - minVal || 1;
  const valPadding = valRange * 0.1;

  const scaleX = (t) => padding.left + ((t - minTime) / timeRange) * innerWidth;
  const scaleY = (v) => padding.top + innerHeight - ((v - (minVal - valPadding)) / (valRange + 2 * valPadding)) * innerHeight;

  const pathD = processed.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${scaleX(p.time.getTime())} ${scaleY(p.value)}`
  ).join(' ');

  return (
    <svg width={chartWidth} height={height} style={{ background: "#fafafa", borderRadius: 8 }}>
      <text x={chartWidth / 2} y={20} textAnchor="middle" style={{ fontSize: 14, fontWeight: 600, fill: "#374151" }}>
        {title}
      </text>
      
      {/* Y axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const val = minVal - valPadding + (valRange + 2 * valPadding) * (1 - pct);
        const y = padding.top + innerHeight * pct;
        return (
          <g key={i}>
            <line x1={padding.left} y1={y} x2={padding.left + innerWidth} y2={y} stroke="#e5e7eb" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" style={{ fontSize: 10, fill: "#6b7280" }}>
              {val.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
      
      {/* Points */}
      {processed.map((p, i) => (
        <circle key={i} cx={scaleX(p.time.getTime())} cy={scaleY(p.value)} r={3} fill={color} />
      ))}

      {/* Y axis label */}
      <text x={15} y={height / 2} transform={`rotate(-90, 15, ${height / 2})`} textAnchor="middle" 
        style={{ fontSize: 11, fill: "#6b7280" }}>{yLabel}</text>
    </svg>
  );
}

// ===== Bar Chart Component =====
function BarChart({ data, title, yLabel, color = "#10b981", height = 300 }) {
  const chartWidth = 700;
  const padding = { top: 30, right: 40, bottom: 60, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
        No data available for the selected period
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.value || d.count || 0), 1);
  const barWidth = Math.min(40, (innerWidth / data.length) - 4);

  return (
    <svg width={chartWidth} height={height} style={{ background: "#fafafa", borderRadius: 8 }}>
      <text x={chartWidth / 2} y={20} textAnchor="middle" style={{ fontSize: 14, fontWeight: 600, fill: "#374151" }}>
        {title}
      </text>

      {/* Bars */}
      {data.map((d, i) => {
        const val = d.value || d.count || 0;
        const barHeight = (val / maxVal) * innerHeight;
        const x = padding.left + (i / data.length) * innerWidth + (innerWidth / data.length - barWidth) / 2;
        const y = padding.top + innerHeight - barHeight;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} rx={2} />
            <text x={x + barWidth / 2} y={padding.top + innerHeight + 15} textAnchor="middle" 
              style={{ fontSize: 9, fill: "#6b7280" }}>{d.label || d.date || i + 1}</text>
            <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" 
              style={{ fontSize: 9, fill: "#374151", fontWeight: 600 }}>{val}</text>
          </g>
        );
      })}

      <text x={15} y={height / 2} transform={`rotate(-90, 15, ${height / 2})`} textAnchor="middle" 
        style={{ fontSize: 11, fill: "#6b7280" }}>{yLabel}</text>
    </svg>
  );
}

// ===== Main Reports Component =====
export default function Reports() {
  const [activeTab, setActiveTab] = useState("temperature");
  const [devices, setDevices] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [timeRange, setTimeRange] = useState("7d");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState({});
  const [deviceSearch, setDeviceSearch] = useState(""); // Device ID search
  const [customDateMode, setCustomDateMode] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Filter devices by search
  const filteredDevices = useMemo(() => {
    if (!deviceSearch.trim()) return devices;
    const q = deviceSearch.toLowerCase();
    return devices.filter(d => d.mobile_id?.toLowerCase().includes(q));
  }, [devices, deviceSearch]);

  // Load devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Device API limit is max 100, so paginate if needed
        const res = await deviceApi.get("/devices", { params: { limit: 100 } });
        const data = res.data;
        // Handle all response formats: array, {items}, {data}, {results}
        const items = Array.isArray(data) ? data : (data.items || data.data || data.results || []);
        console.log("Loaded devices:", items.length);
        setDevices(items);
      } catch (e) {
        console.error("Failed to load devices", e);
        setDevices([]);
      }
    };
    loadDevices();
  }, []);

  // Handle select all
  useEffect(() => {
    if (selectAll) {
      setSelectedDevices(devices.map(d => d.mobile_id));
    }
  }, [selectAll, devices]);

  // Load report data when selection changes
  const loadReportData = useCallback(async () => {
    if (selectedDevices.length === 0) {
      setReportData({});
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      let startDate, endDate;
      
      if (customDateMode && customStartDate && customEndDate) {
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
      } else {
        endDate = now;
        switch (timeRange) {
          case "24h": startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
          case "7d": startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
          case "30d": startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
          case "90d": startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
          default: startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
      }
      
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      const results = {};
      
      for (const deviceId of selectedDevices) {
        try {
          // Temperature logs
          const tempRes = await api.get(`/device/${deviceId}/logs`, {
            params: { log_type: "temperature", start_date: startDateStr, limit: 5000 }
          });
          
          // Door open logs
          const doorRes = await api.get(`/device/${deviceId}/logs`, {
            params: { log_type: "door_open", start_date: startDateStr, limit: 5000 }
          });
          
          // Count history - daily counts
          let dailyCountHistory = [];
          let monthlyCountHistory = [];
          try {
            const dailyRes = await api.get(`/device/${deviceId}/count_history`, { 
              params: { period_type: "daily", limit: 365 } 
            });
            dailyCountHistory = dailyRes.data?.items || [];
            console.log(`Daily count history for ${deviceId}:`, dailyCountHistory.length, "items");
          } catch (e) { console.error("Daily count error:", e); }
          
          try {
            const monthlyRes = await api.get(`/device/${deviceId}/count_history`, { 
              params: { period_type: "monthly", limit: 24 } 
            });
            monthlyCountHistory = monthlyRes.data?.items || [];
            console.log(`Monthly count history for ${deviceId}:`, monthlyCountHistory.length, "items");
          } catch (e) { console.error("Monthly count error:", e); }

          // Uptime report - use start_date and end_date params
          let uptimeData = null;
          try {
            const uptimeRes = await api.get(`/device/${deviceId}/uptime_report`, { 
              params: { start_date: startDateStr, end_date: endDateStr }
            });
            uptimeData = uptimeRes.data;
            console.log(`Uptime data for ${deviceId}:`, uptimeData);
          } catch (e) { console.error("Uptime error:", e); }

          results[deviceId] = {
            temperature: tempRes.data?.items || [],
            doorOpen: doorRes.data?.items || [],
            dailyCountHistory,
            monthlyCountHistory,
            uptime: uptimeData
          };
        } catch (e) {
          console.error(`Failed to load data for ${deviceId}`, e);
          results[deviceId] = { temperature: [], doorOpen: [], dailyCountHistory: [], monthlyCountHistory: [], uptime: null };
        }
      }

      setReportData(results);
    } catch (e) {
      console.error("Failed to load report data", e);
    } finally {
      setLoading(false);
    }
  }, [selectedDevices, timeRange, customDateMode, customStartDate, customEndDate]);

  useEffect(() => {
    if (selectedDevices.length > 0) {
      loadReportData();
    }
  }, [selectedDevices, timeRange, loadReportData]);

  // Export functions
  const exportCSV = (type, deviceId = null) => {
    const devicesToExport = deviceId ? [deviceId] : selectedDevices;
    let csvContent = "";
    
    if (type === "temperature") {
      csvContent = "Device,Timestamp,Temperature (°C)\n";
      devicesToExport.forEach(did => {
        (reportData[did]?.temperature || []).forEach(d => {
          csvContent += `${did},${d.logged_at},${d.value}\n`;
        });
      });
    } else if (type === "uptime") {
      // Uptime is now an object, not an array
      csvContent = "Device,Online Seconds,Offline Seconds,Online %,Online Events,Offline Events,First Event,Last Event\n";
      devicesToExport.forEach(did => {
        const u = reportData[did]?.uptime;
        if (u) {
          csvContent += `${did},${u.total_online_seconds || 0},${u.total_offline_seconds || 0},${u.online_percentage || 0},${u.total_online_events || 0},${u.total_offline_events || 0},${u.first_event || ""},${u.last_event || ""}\n`;
        }
      });
    } else if (type === "daily") {
      csvContent = "Device,Date,Count\n";
      devicesToExport.forEach(did => {
        (reportData[did]?.dailyCountHistory || []).forEach(d => {
          csvContent += `${did},${d.period_date},${d.count_value}\n`;
        });
      });
    } else if (type === "monthly") {
      csvContent = "Device,Month,Count\n";
      devicesToExport.forEach(did => {
        (reportData[did]?.monthlyCountHistory || []).forEach(d => {
          csvContent += `${did},${d.period_date},${d.count_value}\n`;
        });
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${type}_report_${deviceId || "all"}_${timeRange}.csv`;
    link.click();
  };

  const tabs = [
    { id: "temperature", label: "🌡️ Temperature", color: "#ef4444" },
    { id: "uptime", label: "⏱️ Uptime", color: "#3b82f6" },
    { id: "daily", label: "📊 Daily Count", color: "#10b981" },
    { id: "monthly", label: "📈 Monthly Count", color: "#8b5cf6" }
  ];

  const styles = {
    container: { padding: 24 },
    header: { marginBottom: 24 },
    title: { fontSize: 24, fontWeight: 700, color: "#1f2937", marginBottom: 8 },
    subtitle: { color: "#6b7280", fontSize: 14 },
    grid: { display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 },
    sidebar: { background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #e5e7eb", height: "fit-content" },
    main: { background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e5e7eb" },
    tabBar: { display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid #e5e7eb", paddingBottom: 12 },
    tab: (active, color) => ({
      padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
      background: active ? color : "#f3f4f6", color: active ? "#fff" : "#6b7280", transition: "all 0.2s"
    }),
    select: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 },
    deviceList: { maxHeight: 400, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 },
    deviceItem: (selected) => ({
      display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer",
      background: selected ? "#eff6ff" : "transparent", borderBottom: "1px solid #f3f4f6"
    }),
    btn: { padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13 },
    btnPrimary: { background: "#3b82f6", color: "#fff" },
    btnSuccess: { background: "#10b981", color: "#fff" },
    chartContainer: { marginTop: 20 }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📊 Reports Dashboard</h1>
        <p style={styles.subtitle}>View and export device reports - Temperature, Uptime, Daily & Monthly Counts</p>
      </div>

      <div style={styles.grid}>
        {/* Sidebar - Device Selection */}
        <div style={styles.sidebar}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#374151" }}>Select Devices</h3>
          
          {/* Device ID Search */}
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="🔍 Search device ID..."
              value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)}
              style={{ ...styles.select, marginBottom: 8 }}
            />
          </div>
          
          {/* Time Range Selection */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              <button
                onClick={() => setCustomDateMode(false)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: customDateMode ? "1px solid #e5e7eb" : "2px solid #3b82f6",
                  background: customDateMode ? "#fff" : "#eff6ff",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  color: customDateMode ? "#6b7280" : "#1d4ed8",
                }}
              >
                Preset
              </button>
              <button
                onClick={() => setCustomDateMode(true)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: customDateMode ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                  background: customDateMode ? "#eff6ff" : "#fff",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  color: customDateMode ? "#1d4ed8" : "#6b7280",
                }}
              >
                📅 Custom
              </button>
            </div>
            
            {customDateMode ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    style={styles.select}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    style={styles.select}
                  />
                </div>
              </div>
            ) : (
              <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} style={styles.select}>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            )}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={selectAll} onChange={(e) => {
              setSelectAll(e.target.checked);
              if (!e.target.checked) setSelectedDevices([]);
            }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Select All ({filteredDevices.length})</span>
          </label>

          <div style={styles.deviceList}>
            {filteredDevices.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                {deviceSearch ? "No devices match your search" : "No devices found"}
              </div>
            ) : (
              filteredDevices.map(d => (
                <div key={d.mobile_id} style={styles.deviceItem(selectedDevices.includes(d.mobile_id))}
                  onClick={() => {
                    if (selectedDevices.includes(d.mobile_id)) {
                      setSelectedDevices(selectedDevices.filter(x => x !== d.mobile_id));
                      setSelectAll(false);
                    } else {
                      setSelectedDevices([...selectedDevices, d.mobile_id]);
                    }
                  }}>
                  <input type="checkbox" checked={selectedDevices.includes(d.mobile_id)} readOnly />
                  <span style={{ fontSize: 12, fontFamily: "monospace" }}>{d.mobile_id}</span>
                </div>
            )))}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
            {selectedDevices.length} device(s) selected
          </div>
        </div>

        {/* Main Content */}
        <div style={styles.main}>
          {/* Tab Bar */}
          <div style={styles.tabBar}>
            {tabs.map(t => (
              <button key={t.id} style={styles.tab(activeTab === t.id, t.color)} onClick={() => setActiveTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Export Buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button style={{ ...styles.btn, ...styles.btnSuccess }} onClick={() => exportCSV(activeTab)}
              disabled={selectedDevices.length === 0}>
              📥 Export All Selected ({selectedDevices.length})
            </button>
            <button 
              style={{ ...styles.btn, ...styles.btnPrimary }} 
              onClick={() => loadReportData()}
              disabled={loading || selectedDevices.length === 0}
            >
              🔄 Refresh Data
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              Loading report data...
            </div>
          )}

          {/* No Selection */}
          {!loading && selectedDevices.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
              Select one or more devices to view reports
            </div>
          )}

          {/* Charts */}
          {!loading && selectedDevices.length > 0 && (
            <div style={styles.chartContainer}>
              {selectedDevices.map(deviceId => {
                const data = reportData[deviceId] || {};
                return (
                  <div key={deviceId} style={{ marginBottom: 32, padding: 16, background: "#f9fafb", borderRadius: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1f2937" }}>
                        Device: <code style={{ fontFamily: "monospace" }}>{deviceId}</code>
                      </h4>
                      <button style={{ ...styles.btn, background: "#6b7280", color: "#fff", fontSize: 11 }}
                        onClick={() => exportCSV(activeTab, deviceId)}>
                        📥 Export
                      </button>
                    </div>

                    {activeTab === "temperature" && (
                      <LineChart 
                        data={(data.temperature || []).map(d => ({ time: d.logged_at, value: d.value }))}
                        title={`Temperature (${timeRange})`}
                        yLabel="°C"
                        color="#ef4444"
                      />
                    )}

                    {activeTab === "uptime" && (
                      data.uptime ? (
                        <div style={{ padding: 16, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>
                                {(data.uptime.online_percentage || 0).toFixed(1)}%
                              </div>
                              <div style={{ fontSize: 11, color: "#6b7280" }}>Uptime</div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>
                                {Math.round((data.uptime.total_online_seconds || 0) / 3600)}h
                              </div>
                              <div style={{ fontSize: 11, color: "#6b7280" }}>Online</div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444" }}>
                                {Math.round((data.uptime.total_offline_seconds || 0) / 3600)}h
                              </div>
                              <div style={{ fontSize: 11, color: "#6b7280" }}>Offline</div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 24, fontWeight: 700, color: "#8b5cf6" }}>
                                {(data.uptime.sessions || []).length}
                              </div>
                              <div style={{ fontSize: 11, color: "#6b7280" }}>Sessions</div>
                            </div>
                          </div>
                          {data.uptime.first_event && (
                            <div style={{ fontSize: 11, color: "#6b7280", textAlign: "center" }}>
                              Period: {new Date(data.uptime.first_event).toLocaleDateString()} - {new Date(data.uptime.last_event).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                          No uptime data available
                        </div>
                      )
                    )}

                    {activeTab === "daily" && (
                      <BarChart
                        data={(data.dailyCountHistory || []).slice(0, 30).reverse()
                          .map(d => ({ label: d.period_date?.slice(5), value: d.count_value || 0 }))}
                        title={`Daily Door Open Count`}
                        yLabel="Count"
                        color="#10b981"
                      />
                    )}

                    {activeTab === "monthly" && (
                      <BarChart
                        data={(data.monthlyCountHistory || []).slice(0, 12).reverse()
                          .map(d => ({ label: d.period_date?.slice(0, 7), value: d.count_value || 0 }))}
                        title={`Monthly Door Open Count`}
                        yLabel="Count"
                        color="#8b5cf6"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
