// src/components/Device.js
// Device Management with server-side pagination and temperature line graph reports
// Updated with Report button for each device listing
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { listDevices, insertDevice, deleteDevice } from "../api/device";
import { listGroupNames } from "../api/group";
import { listShopNames } from "../api/shop";
import axios from "axios";

// DVSG API for device creation with linking
const DVSG_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8005`;

const dvsgApi = axios.create({
  baseURL: DVSG_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Simple toast notification
const toast = (message) => {
  const div = document.createElement("div");
  div.textContent = message;
  div.style.cssText = `
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: #1f2937; color: #fff; padding: 12px 24px; border-radius: 8px;
    font-size: 14px; font-weight: 500; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
};

// ===== Temperature Line Graph Component =====
function TemperatureLineGraph({ data, timeRange, title, onDownload }) {
  const chartHeight = 320;
  const chartWidth = 750;
  const padding = { top: 30, right: 40, bottom: 60, left: 70 };

  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Process data
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data
      .filter((d) => d.log_type === "temperature" && d.value != null)
      .map((d) => ({
        time: new Date(d.logged_at),
        value: parseFloat(d.value),
      }))
      .sort((a, b) => a.time - b.time);
  }, [data]);

  if (processedData.length === 0) {
    return (
      <div
        style={{
          height: chartHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          borderRadius: 8,
          color: "#6b7280",
        }}
      >
        No temperature data available for the selected period
      </div>
    );
  }

  // Calculate scales
  const minTemp = Math.floor(Math.min(...processedData.map((d) => d.value)) - 2);
  const maxTemp = Math.ceil(Math.max(...processedData.map((d) => d.value)) + 2);
  const minTime = processedData[0].time.getTime();
  const maxTime = processedData[processedData.length - 1].time.getTime();
  const timeSpan = maxTime - minTime || 1;
  const tempSpan = maxTemp - minTemp || 1;

  // Generate line path
  const linePath = processedData
    .map((d, i) => {
      const x = padding.left + ((d.time.getTime() - minTime) / timeSpan) * innerWidth;
      const y = padding.top + innerHeight - ((d.value - minTemp) / tempSpan) * innerHeight;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Generate area path for gradient fill
  const firstX = padding.left + ((processedData[0].time.getTime() - minTime) / timeSpan) * innerWidth;
  const lastX = padding.left + ((processedData[processedData.length - 1].time.getTime() - minTime) / timeSpan) * innerWidth;
  const bottomY = padding.top + innerHeight;
  const areaPath = `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

  // Y-axis ticks
  const yTicks = [];
  const yStep = tempSpan <= 10 ? 1 : Math.ceil(tempSpan / 6);
  for (let t = minTemp; t <= maxTemp; t += yStep) {
    const y = padding.top + innerHeight - ((t - minTemp) / tempSpan) * innerHeight;
    yTicks.push({ value: t, y });
  }

  // X-axis ticks
  const xTicks = [];
  const numXTicks = 6;
  for (let i = 0; i <= numXTicks; i++) {
    const time = new Date(minTime + (timeSpan * i) / numXTicks);
    const x = padding.left + (innerWidth * i) / numXTicks;
    xTicks.push({ time, x });
  }

  // Format time based on time range
  const formatTime = (date) => {
    if (timeRange === "1h" || timeRange === "6h" || timeRange === "24h") {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Statistics
  const avgTemp = processedData.reduce((sum, d) => sum + d.value, 0) / processedData.length;
  const minTempVal = Math.min(...processedData.map((d) => d.value));
  const maxTempVal = Math.max(...processedData.map((d) => d.value));
  const currentTemp = processedData[processedData.length - 1].value;

  return (
    <div>
      {/* Title */}
      {title && (
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>{title}</div>
      )}

      {/* Stats Cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ padding: "10px 16px", background: "#dbeafe", borderRadius: 8, minWidth: 90 }}>
          <div style={{ fontSize: 11, color: "#1e40af", fontWeight: 600 }}>Current</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1e40af" }}>{currentTemp.toFixed(1)}°C</div>
        </div>
        <div style={{ padding: "10px 16px", background: "#dcfce7", borderRadius: 8, minWidth: 90 }}>
          <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>Average</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#166534" }}>{avgTemp.toFixed(1)}°C</div>
        </div>
        <div style={{ padding: "10px 16px", background: "#fef3c7", borderRadius: 8, minWidth: 90 }}>
          <div style={{ fontSize: 11, color: "#92400e", fontWeight: 600 }}>Min</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#92400e" }}>{minTempVal.toFixed(1)}°C</div>
        </div>
        <div style={{ padding: "10px 16px", background: "#fee2e2", borderRadius: 8, minWidth: 90 }}>
          <div style={{ fontSize: 11, color: "#991b1b", fontWeight: 600 }}>Max</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#991b1b" }}>{maxTempVal.toFixed(1)}°C</div>
        </div>
        <div style={{ padding: "10px 16px", background: "#f3e8ff", borderRadius: 8, minWidth: 90 }}>
          <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>Points</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#7c3aed" }}>{processedData.length}</div>
        </div>
      </div>

      {/* SVG Line Chart */}
      <svg
        width={chartWidth}
        height={chartHeight}
        style={{ background: "#fafafa", borderRadius: 8, maxWidth: "100%", display: "block" }}
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id="tempGradientLine" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <line
            key={`grid-y-${i}`}
            x1={padding.left}
            x2={chartWidth - padding.right}
            y1={tick.y}
            y2={tick.y}
            stroke="#e5e7eb"
            strokeDasharray="4,4"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#tempGradientLine)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points (only show if not too many) */}
        {processedData.length <= 50 &&
          processedData.map((d, i) => {
            const x = padding.left + ((d.time.getTime() - minTime) / timeSpan) * innerWidth;
            const y = padding.top + innerHeight - ((d.value - minTemp) / tempSpan) * innerHeight;
            return <circle key={i} cx={x} cy={y} r={3} fill="#3b82f6" stroke="#fff" strokeWidth={1.5} />;
          })}

        {/* Y-axis */}
        <line x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + innerHeight} stroke="#9ca3af" />
        {yTicks.map((tick, i) => (
          <g key={`y-tick-${i}`}>
            <line x1={padding.left - 5} x2={padding.left} y1={tick.y} y2={tick.y} stroke="#9ca3af" />
            <text x={padding.left - 10} y={tick.y + 4} textAnchor="end" fontSize={11} fill="#6b7280">
              {tick.value}°C
            </text>
          </g>
        ))}

        {/* X-axis */}
        <line
          x1={padding.left}
          x2={chartWidth - padding.right}
          y1={padding.top + innerHeight}
          y2={padding.top + innerHeight}
          stroke="#9ca3af"
        />
        {xTicks.map((tick, i) => (
          <g key={`x-tick-${i}`}>
            <line x1={tick.x} x2={tick.x} y1={padding.top + innerHeight} y2={padding.top + innerHeight + 5} stroke="#9ca3af" />
            <text
              x={tick.x}
              y={padding.top + innerHeight + 20}
              textAnchor="middle"
              fontSize={10}
              fill="#6b7280"
              transform={`rotate(-30, ${tick.x}, ${padding.top + innerHeight + 20})`}
            >
              {formatTime(tick.time)}
            </text>
          </g>
        ))}

        {/* Axis Labels */}
        <text 
          x={padding.left / 2} 
          y={chartHeight / 2} 
          textAnchor="middle" 
          fontSize={12} 
          fill="#374151" 
          transform={`rotate(-90, ${padding.left / 2}, ${chartHeight / 2})`}
        >
          Temperature (°C)
        </text>
        <text x={chartWidth / 2} y={chartHeight - 5} textAnchor="middle" fontSize={12} fill="#374151">
          Time
        </text>
      </svg>

      {/* Download Buttons */}
      {onDownload && (
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #3b82f6",
              background: "#3b82f6",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
            onClick={() => onDownload("absolute")}
          >
            📥 Download CSV (Absolute Values)
          </button>
          <button
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #8b5cf6",
              background: "#8b5cf6",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
            onClick={() => onDownload("relative")}
          >
            📥 Download CSV (Relative to Average)
          </button>
        </div>
      )}
    </div>
  );
}

// ===== Modal Component =====
function Modal({ open, title, onClose, children, footer, width = "980px" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(17,24,39,.55)",
    display: open ? "grid" : "none",
    placeItems: "center",
    zIndex: 2000,
    padding: 16,
  };

  const card = {
    width: `min(92vw, ${width})`,
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 20px 60px rgba(0,0,0,.25)",
    overflow: "hidden",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
  };

  const header = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    color: "white",
    background: "linear-gradient(90deg, #5b7cfa, #7c4bc9)",
    flexShrink: 0,
  };

  const closeBtn = {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "none",
    background: "rgba(255,255,255,.18)",
    color: "white",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: "34px",
  };

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()}>
        <div style={header}>
          <div style={{ fontWeight: 700 }}>{title}</div>
          <button style={closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div style={{ padding: 14, overflowY: "auto", flex: 1 }}>{children}</div>
        {footer ? <div style={{ padding: 14, borderTop: "1px solid #e5e7eb", flexShrink: 0 }}>{footer}</div> : null}
      </div>
    </div>
  );
}

// ===== Helper Functions =====
function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function prettyErrText(s) {
  if (!s) return "";
  try {
    const obj = JSON.parse(s);
    if (Array.isArray(obj)) return obj?.[0]?.msg || s;
    if (obj?.detail && Array.isArray(obj.detail)) return obj.detail?.[0]?.msg || s;
    if (obj?.msg) return obj.msg;
    return s;
  } catch {
    return s;
  }
}

// ===== Styles =====
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  outline: "none",
  fontSize: 14,
};

const btn = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
  background: "#6d5efc",
  color: "white",
  boxShadow: "0 10px 24px rgba(109,94,252,.25)",
};

const btnGhost = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  cursor: "pointer",
  fontWeight: 700,
  background: "white",
};

const btnSuccess = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
  background: "#10b981",
  color: "white",
};

const btnDanger = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
  background: "#ef4444",
  color: "white",
  fontSize: 12,
};

const btnTiny = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  cursor: "pointer",
  fontWeight: 800,
  background: "white",
};

const btnTinyDisabled = {
  ...btnTiny,
  opacity: 0.45,
  cursor: "not-allowed",
};

const btnReport = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #8b5cf6",
  background: "#f5f3ff",
  color: "#7c3aed",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 11,
};

// ===== Main Component =====
export default function Device() {
  // Remove modal wrapper - show devices directly
  const [open] = useState(true); // Always open - no modal wrapper needed

  // list data
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // search input vs applied search
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");

  // pagination
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1); // 1-based

  const totalPages = useMemo(() => {
    const t = Number(total || 0);
    const ps = Number(pageSize || 10);
    return Math.max(1, Math.ceil(t / ps));
  }, [total, pageSize]);

  const fromRow = useMemo(() => {
    if (!total) return 0;
    return (page - 1) * pageSize + 1;
  }, [total, page, pageSize]);

  const toRow = useMemo(() => {
    if (!total) return 0;
    return Math.min(total, (page - 1) * pageSize + (items?.length || 0));
  }, [total, page, pageSize, items]);

  const [errText, setErrText] = useState("");
  const [fkDetail, setFkDetail] = useState(null);

  // Two-step add modal
  const [addOpen, setAddOpen] = useState(false);
  const [step, setStep] = useState(1);

  // Form data
  const [mobileId, setMobileId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const [group, setGroup] = useState("");
  const [shop, setShop] = useState("");
  const [resolution, setResolution] = useState("");
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [showCustomResolution, setShowCustomResolution] = useState(false);

  // Edit device modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editDevice, setEditDevice] = useState(null);
  const [editDeviceName, setEditDeviceName] = useState("");
  const [editResolution, setEditResolution] = useState("");
  const [editCustomWidth, setEditCustomWidth] = useState("");
  const [editCustomHeight, setEditCustomHeight] = useState("");
  const [showEditCustomResolution, setShowEditCustomResolution] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Active status and unassign state
  const [togglingActive, setTogglingActive] = useState(null); // mobile_id of device being toggled
  const [unassigning, setUnassigning] = useState(null); // mobile_id of device being unassigned
  const [activeTab, setActiveTab] = useState("active"); // "active" or "inactive"

  // Assign videos modal state
  const [assignDevice, setAssignDevice] = useState(null);
  const [assignGroup, setAssignGroup] = useState("");
  const [assignShop, setAssignShop] = useState("");
  const [assignVideos, setAssignVideos] = useState([]);
  const [availableVideos, setAvailableVideos] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [changeGroupMode, setChangeGroupMode] = useState(false); // true = unlink existing first

  // Dropdown data
  const [groups, setGroups] = useState([]);
  const [shops, setShops] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState("");

  // Resolution options - expanded list with custom option
  const RESOLUTION_OPTIONS = [
    { value: "", label: "Auto (Device Default)" },
    // Common Landscape
    { value: "1920x1080", label: "1920×1080 (Full HD Landscape)" },
    { value: "1280x720", label: "1280×720 (HD Landscape)" },
    { value: "1366x768", label: "1366×768 (Common Display)" },
    { value: "1600x900", label: "1600×900 (HD+ Landscape)" },
    { value: "2560x1440", label: "2560×1440 (QHD Landscape)" },
    { value: "3840x2160", label: "3840×2160 (4K UHD Landscape)" },
    { value: "2560x1080", label: "2560×1080 (Ultrawide)" },
    { value: "3440x1440", label: "3440×1440 (Ultrawide QHD)" },
    // Common Portrait
    { value: "1080x1920", label: "1080×1920 (Full HD Portrait)" },
    { value: "720x1280", label: "720×1280 (HD Portrait)" },
    { value: "768x1366", label: "768×1366 (Common Portrait)" },
    { value: "900x1600", label: "900×1600 (HD+ Portrait)" },
    { value: "1440x2560", label: "1440×2560 (QHD Portrait)" },
    { value: "2160x3840", label: "2160×3840 (4K UHD Portrait)" },
    // Square & Special
    { value: "1080x1080", label: "1080×1080 (Square HD)" },
    { value: "1920x1920", label: "1920×1920 (Square Full HD)" },
    { value: "800x480", label: "800×480 (Small Display)" },
    { value: "480x800", label: "480×800 (Small Portrait)" },
    { value: "1024x600", label: "1024×600 (Netbook)" },
    { value: "600x1024", label: "600×1024 (Netbook Portrait)" },
    // Custom option
    { value: "custom", label: "🔧 Custom Resolution..." },
  ];

  // Helper to check if resolution is custom (not in predefined list)
  const isCustomResolution = (res) => {
    if (!res || res === "custom") return false;
    return !RESOLUTION_OPTIONS.some(opt => opt.value === res && opt.value !== "custom");
  };

  // Handle resolution change for add form
  const handleResolutionChange = (value) => {
    if (value === "custom") {
      setShowCustomResolution(true);
      setResolution("");
    } else {
      setShowCustomResolution(false);
      setCustomWidth("");
      setCustomHeight("");
      setResolution(value);
    }
  };

  // Handle custom resolution input for add form
  const handleCustomResolutionChange = (w, h) => {
    setCustomWidth(w);
    setCustomHeight(h);
    if (w && h && parseInt(w) > 0 && parseInt(h) > 0) {
      setResolution(`${w}x${h}`);
    }
  };

  // Handle resolution change for edit form
  const handleEditResolutionChange = (value) => {
    if (value === "custom") {
      setShowEditCustomResolution(true);
      setEditResolution("");
    } else {
      setShowEditCustomResolution(false);
      setEditCustomWidth("");
      setEditCustomHeight("");
      setEditResolution(value);
    }
  };

  // Handle custom resolution input for edit form
  const handleEditCustomResolutionChange = (w, h) => {
    setEditCustomWidth(w);
    setEditCustomHeight(h);
    if (w && h && parseInt(w) > 0 && parseInt(h) > 0) {
      setEditResolution(`${w}x${h}`);
    }
  };

  // Open edit modal
  const openEditModal = (device) => {
    setEditDevice(device);
    setEditDeviceName(device.device_name || "");
    const deviceRes = device.resolution || "";
    if (isCustomResolution(deviceRes)) {
      setShowEditCustomResolution(true);
      const [w, h] = deviceRes.split("x");
      setEditCustomWidth(w || "");
      setEditCustomHeight(h || "");
      setEditResolution(deviceRes);
    } else {
      setShowEditCustomResolution(false);
      setEditCustomWidth("");
      setEditCustomHeight("");
      setEditResolution(deviceRes);
    }
    setEditOpen(true);
    setErrText("");
    setSuccess("");
  };

  // Update device resolution and name
  const updateDeviceSettings = async () => {
    if (!editDevice) return;
    setUpdating(true);
    setErrText("");
    try {
      // Update resolution
      await dvsgApi.post(`/device/${editDevice.mobile_id}/resolution?resolution=${encodeURIComponent(editResolution || "")}`);
      
      // Update device name if changed
      if (editDeviceName !== (editDevice.device_name || "")) {
        await dvsgApi.post(`/device/${editDevice.mobile_id}/name`, { device_name: editDeviceName });
      }
      
      setSuccess("Device settings updated successfully!");
      setTimeout(() => {
        setEditOpen(false);
        setEditDevice(null);
        loadPage(page, pageSize, qApplied);
      }, 1000);
    } catch (err) {
      setErrText(err.response?.data?.detail || "Failed to update device");
    }
    setUpdating(false);
  };

  // Line Graph Report Modal State
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDevice, setReportDevice] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportTimeRange, setReportTimeRange] = useState("24h");

  const canProceedToStep2 = useMemo(() => (mobileId ?? "").trim().length > 0, [mobileId]);
  const canSubmit = useMemo(() => mobileId.trim() && group && shop, [mobileId, group, shop]);

  // Load groups and shops for step 2
  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    setErrText("");
    try {
      const [gnames, snames] = await Promise.all([listGroupNames(""), listShopNames("")]);
      setGroups(gnames || []);
      setShops(snames || []);
      if (!group && gnames?.length) setGroup(gnames[0]);
      if (!shop && snames?.length) setShop(snames[0]);
    } catch (e) {
      console.error("Failed to load groups/shops:", e);
      setErrText("Failed to load groups/shops");
    } finally {
      setLoadingLists(false);
    }
  }, [group, shop]);

  useEffect(() => {
    if (addOpen && step === 2) loadLists();
  }, [addOpen, step, loadLists]);

  // Also load lists when assign modal opens
  useEffect(() => {
    if (assignDevice) loadLists();
  }, [assignDevice, loadLists]);

  // Load page data
  const loadPage = useCallback(async (p = 1, ps = 10, qx = "") => {
    setLoading(true);
    setErrText("");
    setFkDetail(null);

    const safeP = Math.max(1, Number(p || 1));
    const safePS = Math.max(1, Number(ps || 10));
    const offset = (safeP - 1) * safePS;

    const r = await listDevices(safePS, offset, qx);
    if (!r.ok) {
      setErrText(prettyErrText(r.error || "Network Error"));
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const newTotal = Number(r.total ?? 0);
    const newPages = Math.max(1, Math.ceil(newTotal / safePS));

    // if current page is out of range (after deletions), move back
    if (safeP > newPages && newTotal > 0) {
      setTotal(newTotal);
      setPage(newPages);
      setLoading(false);
      return;
    }

    setItems(r.items || []);
    setTotal(newTotal);
    setLoading(false);
  }, []);

  // Load temperature report data
  const loadReportData = useCallback(async (mobileIdVal, timeRangeVal) => {
    setReportLoading(true);
    try {
      // Calculate date range
      const now = new Date();
      let startDate;
      switch (timeRangeVal) {
        case "1h":
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case "6h":
          startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          break;
        case "24h":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const res = await dvsgApi.get(`/device/${mobileIdVal}/logs`, {
        params: {
          log_type: "temperature",
          start_date: startDate.toISOString().split("T")[0],
          end_date: now.toISOString().split("T")[0],
          limit: 5000,
        },
      });
      setReportData(res.data?.items || []);
    } catch (e) {
      console.error("Failed to load report data", e);
      setReportData([]);
    } finally {
      setReportLoading(false);
    }
  }, []);

  // Download report as CSV
  const downloadReport = useCallback(
    (mode) => {
      if (!reportData || reportData.length === 0) return;

      const tempData = reportData
        .filter((d) => d.log_type === "temperature" && d.value != null)
        .map((d) => ({
          time: new Date(d.logged_at),
          value: parseFloat(d.value),
        }))
        .sort((a, b) => a.time - b.time);

      if (tempData.length === 0) return;

      let csvContent = "";
      const avgTemp = tempData.reduce((sum, d) => sum + d.value, 0) / tempData.length;

      if (mode === "absolute") {
        csvContent = "Timestamp,Temperature (°C)\n";
        tempData.forEach((d) => {
          csvContent += `${d.time.toISOString()},${d.value.toFixed(2)}\n`;
        });
      } else {
        // Relative to average
        csvContent = "Timestamp,Temperature (°C),Deviation from Avg (°C),Deviation (%)\n";
        tempData.forEach((d) => {
          const deviation = d.value - avgTemp;
          const deviationPct = ((deviation / avgTemp) * 100).toFixed(2);
          csvContent += `${d.time.toISOString()},${d.value.toFixed(2)},${deviation.toFixed(2)},${deviationPct}\n`;
        });
      }

      // Download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `temperature_report_${reportDevice}_${reportTimeRange}_${mode}.csv`;
      link.click();
    },
    [reportData, reportDevice, reportTimeRange]
  );

  // Load available videos for assign modal
  useEffect(() => {
    if (!assignDevice) return;
    const loadVideos = async () => {
      try {
        // Video API is on port 8003
        const VIDEO_BASE = `${window.location.protocol}//${window.location.hostname}:8003`;
        const res = await axios.get(`${VIDEO_BASE}/videos`, { params: { limit: 500 } });
        const data = res.data;
        // Handle both array and {items: [...]} or {data: [...]} response formats
        const videoItems = Array.isArray(data) ? data : (data.items || data.data || []);
        const videos = videoItems.map((v) => v.video_name).filter(Boolean);
        console.log("Loaded videos:", videos.length, "items");
        setAvailableVideos(videos);
      } catch (e) {
        console.error("Failed to load videos", e);
        setAvailableVideos([]);
      }
    };
    loadVideos();
  }, [assignDevice]);

  // Open report modal
  const openReport = useCallback(
    (device) => {
      setReportDevice(device.mobile_id);
      setReportTimeRange("24h");
      setReportOpen(true);
      loadReportData(device.mobile_id, "24h");
    },
    [loadReportData]
  );

  // Change time range
  const changeTimeRange = useCallback(
    (range) => {
      setReportTimeRange(range);
      if (reportDevice) {
        loadReportData(reportDevice, range);
      }
    },
    [reportDevice, loadReportData]
  );

  // initial load + reload when page/pageSize changes (only when modal open)
  useEffect(() => {
    if (!open) return;
    loadPage(page, pageSize, qApplied);
  }, [open, page, pageSize, qApplied, loadPage]);

  const onSearch = async () => {
    const nextQ = (q || "").trim();
    setQApplied(nextQ);
    setPage(1);
    if (open) await loadPage(1, pageSize, nextQ);
  };

  const onRefresh = async () => {
    if (!open) return;
    await loadPage(page, pageSize, qApplied);
  };

  const onDelete = async (row) => {
    const mid = row?.mobile_id;
    if (!mid) return;

    const ok = window.confirm(`Delete device "${mid}"?`);
    if (!ok) return;

    setErrText("");
    setFkDetail(null);

    const r = await deleteDevice(mid);
    if (r.ok) {
      const offset = (page - 1) * pageSize;
      const rr = await listDevices(pageSize, offset, qApplied);
      if (rr.ok) {
        if ((rr.items || []).length === 0 && page > 1) {
          setPage(page - 1);
          return;
        }
        setItems(rr.items || []);
        setTotal(Number(rr.total ?? 0));
        return;
      }
      await loadPage(page, pageSize, qApplied);
      return;
    }

    if (r.status === 409 && r.detailObj) {
      setErrText(r.detailObj.message || "Device is linked with other records.");
      setFkDetail(r.detailObj);
      return;
    }

    setErrText(prettyErrText(r.error || "Failed to delete"));
  };

  // Handler to toggle device active/inactive status
  const handleToggleActive = async (device) => {
    const newStatus = device.is_active !== false ? false : true; // Toggle
    const action = newStatus ? "activate" : "deactivate";
    
    if (!window.confirm(`Are you sure you want to ${action} device "${device.device_name || device.mobile_id}"?\n\n${!newStatus ? "The device will show 'Not Enrolled' screen." : "The device will work normally again."}`)) {
      return;
    }
    
    setTogglingActive(device.mobile_id);
    try {
      const res = await dvsgApi.post(`/device/${device.mobile_id}/active-status`, { is_active: newStatus });
      toast(res.data.message || `Device ${action}d successfully`);
      await loadPage(page, pageSize, qApplied); // Refresh the list
    } catch (err) {
      toast(`Failed to ${action} device: ${err.response?.data?.detail || err.message}`);
    } finally {
      setTogglingActive(null);
    }
  };

  // Handler to unassign device from its current group
  const handleUnassignFromGroup = async (device) => {
    if (!device.group_name) {
      toast("Device is not assigned to any group");
      return;
    }
    
    if (!window.confirm(`Unassign device "${device.device_name || device.mobile_id}" from group "${device.group_name}"?\n\nThis will remove all video/image assignments from this device.`)) {
      return;
    }
    
    setUnassigning(device.mobile_id);
    try {
      const res = await dvsgApi.post(`/device/${device.mobile_id}/unassign-from-group`);
      toast(res.data.message || "Device unassigned successfully");
      await loadPage(page, pageSize, qApplied); // Refresh the list
    } catch (err) {
      toast(`Failed to unassign device: ${err.response?.data?.detail || err.message}`);
    } finally {
      setUnassigning(null);
    }
  };

  const handleOpenAddModal = () => {
    setAddOpen(true);
    setStep(1);
    setMobileId("");
    setDeviceName("");
    setDownloaded(false);
    setGroup("");
    setShop("");
    setResolution("");
    setSuccess("");
    setErrText("");
  };

  const handleProceedToStep2 = () => {
    if (canProceedToStep2) setStep(2);
  };

  const handleBack = () => setStep(1);

  // Add device with linking (new flow)
  const addDeviceWithLinking = async () => {
    if (!canSubmit) return;
    setAdding(true);
    setErrText("");
    setSuccess("");

    const id = mobileId.trim();
    const name = deviceName.trim() || null;

    try {
      const response = await dvsgApi.post("/device/create", {
        mobile_id: id,
        device_name: name,
        group_name: group,
        shop_name: shop,
        resolution: resolution || null,
      });

      if (response.data) {
        setSuccess(`Device ${name || id} created and linked successfully!`);
        setTimeout(async () => {
          setMobileId("");
          setDeviceName("");
          setDownloaded(false);
          setResolution("");
          setShowCustomResolution(false);
          setCustomWidth("");
          setCustomHeight("");
          setStep(1);
          setAddOpen(false);
          setSuccess("");
          setPage(1);
          await loadPage(1, pageSize, qApplied);
        }, 800);
      }
    } catch (e) {
      console.error("Create device error:", e);
      // Fallback to old method
      try {
        await insertDevice({ mobile_id: id, download_status: downloaded });
        setSuccess(`Device ${id} added successfully!`);
        setTimeout(async () => {
          setMobileId("");
          setDeviceName("");
          setDownloaded(false);
          setStep(1);
          setAddOpen(false);
          setSuccess("");
          setPage(1);
          await loadPage(1, pageSize, qApplied);
        }, 800);
      } catch (e2) {
        setErrText(e2?.response?.data?.detail || e2?.message || "Failed to add device");
      }
    } finally {
      setAdding(false);
    }
  };

  // Create device without linking (just mobile_id)
  const addDeviceOnly = async () => {
    if (!mobileId.trim()) return;
    setAdding(true);
    setErrText("");
    setSuccess("");

    const name = deviceName.trim() || null;

    try {
      // Try new API first with resolution and name support
      try {
        await dvsgApi.post("/device/create", {
          mobile_id: mobileId.trim(),
          device_name: name,
          resolution: resolution || null,
        });
      } catch (e) {
        // Fallback to old API
        await insertDevice({ mobile_id: mobileId.trim(), download_status: downloaded });
      }
      setSuccess(`Device ${name || mobileId.trim()} created! You can link it to a group later.`);
      setTimeout(async () => {
        setMobileId("");
        setDeviceName("");
        setDownloaded(false);
        setResolution("");
        setShowCustomResolution(false);
        setCustomWidth("");
        setCustomHeight("");
        setAddOpen(false);
        setSuccess("");
        setPage(1);
        await loadPage(1, pageSize, qApplied);
      }, 800);
    } catch (e) {
      setErrText(e?.response?.data?.detail || e?.message || "Failed to create device");
    } finally {
      setAdding(false);
    }
  };

  const paginationBar = (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 12,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center", color: "#6b7280", fontSize: 13 }}>
        <div>
          Showing <b>{fromRow}</b>-<b>{toRow}</b> of <b>{total}</b>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span>Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            style={{ ...inputStyle, width: 90, padding: "8px 10px" }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Page <b>{page}</b> / <b>{totalPages}</b>
        </div>

        <button
          style={page <= 1 ? btnTinyDisabled : btnTiny}
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ← Prev
        </button>

        <button
          style={page >= totalPages ? btnTinyDisabled : btnTiny}
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Next →
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>📱 Device Management</h2>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Total: <b>{total}</b> devices
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={btnGhost} onClick={onRefresh} disabled={loading}>
            🔄 Refresh
          </button>
          <button style={btn} onClick={handleOpenAddModal}>
            + Add Device
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by device name or mobile id..."
          style={{ ...inputStyle, flex: 1, maxWidth: 400 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
        />
        <button style={btnGhost} onClick={onSearch} disabled={loading}>
          Search
        </button>
      </div>

      {/* Active/Inactive Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
        <button
          onClick={() => setActiveTab("active")}
          style={{
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            background: activeTab === "active" ? "#fff" : "transparent",
            color: activeTab === "active" ? "#16a34a" : "#6b7280",
            borderBottom: activeTab === "active" ? "2px solid #16a34a" : "2px solid transparent",
            marginBottom: "-2px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          ✓ Active Devices
          <span style={{
            background: activeTab === "active" ? "#dcfce7" : "#f3f4f6",
            color: activeTab === "active" ? "#16a34a" : "#6b7280",
            padding: "2px 8px",
            borderRadius: 10,
            fontSize: 12,
          }}>
            {items.filter(d => d.is_active !== false).length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("inactive")}
          style={{
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            background: activeTab === "inactive" ? "#fff" : "transparent",
            color: activeTab === "inactive" ? "#dc2626" : "#6b7280",
            borderBottom: activeTab === "inactive" ? "2px solid #dc2626" : "2px solid transparent",
            marginBottom: "-2px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          ⏸️ Inactive Devices
          <span style={{
            background: activeTab === "inactive" ? "#fee2e2" : "#f3f4f6",
            color: activeTab === "inactive" ? "#dc2626" : "#6b7280",
            padding: "2px 8px",
            borderRadius: 10,
            fontSize: 12,
          }}>
            {items.filter(d => d.is_active === false).length}
          </span>
        </button>
      </div>

      {errText ? (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: 10,
            borderRadius: 10,
            marginBottom: 10,
            fontWeight: 600,
          }}
        >
          {errText}
        </div>
      ) : null}

      {fkDetail?.recent_links?.length ? (
        <div style={{ marginBottom: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 800, color: "#991b1b" }}>⚠️ Device has {fkDetail.linked_count || fkDetail.recent_links.length} linked record(s)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{
                  padding: "8px 16px",
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
                onClick={async () => {
                  // Get mobile_id from recent_links (the string identifier, not numeric ID)
                  const mobileId = fkDetail.recent_links?.[0]?.mobile_id || fkDetail.mobile_id;
                  if (!mobileId) {
                    setErrText("Could not determine device mobile_id");
                    return;
                  }
                  const ok = window.confirm(`Delete ALL ${fkDetail.linked_count || fkDetail.recent_links.length} links for device "${mobileId}"?\n\nThis will unlink all videos from the device.`);
                  if (!ok) return;
                  try {
                    await dvsgApi.delete(`/device/${encodeURIComponent(mobileId)}/links`);
                    setFkDetail(null);
                    setErrText("");
                    toast("Links deleted successfully. You can now delete the device.");
                  } catch (e) {
                    setErrText(e?.response?.data?.detail || "Failed to delete links");
                  }
                }}
              >
                🗑️ Delete All Links
              </button>
              <button
                style={{
                  padding: "8px 16px",
                  background: "#6b7280",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
                onClick={() => {
                  setFkDetail(null);
                  setErrText("");
                }}
              >
                ✕ Dismiss
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #fecaca", borderRadius: 8, background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fef2f2", textAlign: "left" }}>
                  <th style={{ padding: 10, fontSize: 12, color: "#991b1b" }}>Link ID</th>
                  <th style={{ padding: 10, fontSize: 12, color: "#991b1b" }}>Group</th>
                  <th style={{ padding: 10, fontSize: 12, color: "#991b1b" }}>Shop</th>
                  <th style={{ padding: 10, fontSize: 12, color: "#991b1b" }}>Video</th>
                  <th style={{ padding: 10, fontSize: 12, color: "#991b1b" }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {fkDetail.recent_links.map((x) => (
                  <tr key={x.link_id} style={{ borderTop: "1px solid #fecaca" }}>
                    <td style={{ padding: 10, fontWeight: 700 }}>{x.link_id}</td>
                    <td style={{ padding: 10 }}>{x.gname || x.gid}</td>
                    <td style={{ padding: 10 }}>{x.shop_name || x.sid}</td>
                    <td style={{ padding: 10 }}>{x.video_name || x.vid}</td>
                    <td style={{ padding: 10 }}>{fmtDate(x.updated_at || x.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Device Name</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Mobile ID</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Group</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Resolution</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Downloaded</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Created</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Updated</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280", width: 320, textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 14, color: "#6b7280" }}>
                    Loading...
                  </td>
                </tr>
              ) : items.filter(d => activeTab === "active" ? d.is_active !== false : d.is_active === false).length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 14, color: "#6b7280" }}>
                    {activeTab === "active" ? "No active devices found." : "No inactive devices found."}
                  </td>
                </tr>
              ) : (
                items.filter(d => activeTab === "active" ? d.is_active !== false : d.is_active === false).map((d) => (
                  <tr key={d.id ?? d.mobile_id} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: 12 }}>
                      {d.device_name ? (
                        <span style={{ fontWeight: 700, color: "#1f2937" }}>{d.device_name}</span>
                      ) : (
                        <span style={{ color: "#9ca3af", fontStyle: "italic", fontSize: 12 }}>No name set</span>
                      )}
                    </td>
                    <td style={{ padding: 12, fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>{d.mobile_id}</td>
                    <td style={{ padding: 12 }}>
                      {d.group_name ? (
                        <span style={{
                          padding: "4px 10px",
                          background: "#dbeafe",
                          borderRadius: 6,
                          fontSize: 12,
                          color: "#1e40af",
                          fontWeight: 600,
                        }}>
                          {d.group_name}
                        </span>
                      ) : (
                        <span style={{
                          padding: "4px 10px",
                          background: "#fef3c7",
                          borderRadius: 6,
                          fontSize: 12,
                          color: "#92400e",
                          fontWeight: 500,
                        }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      {d.resolution ? (
                        <span style={{
                          padding: "4px 8px",
                          background: "#f3e8ff",
                          borderRadius: 6,
                          fontSize: 12,
                          fontFamily: "monospace",
                          color: "#7c3aed",
                          fontWeight: 600,
                        }}>
                          {d.resolution}
                        </span>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: 12 }}>Auto</span>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>{d.download_status ? "Yes" : "No"}</td>
                    <td style={{ padding: 12 }}>{fmtDate(d.created_at)}</td>
                    <td style={{ padding: 12 }}>{fmtDate(d.updated_at)}</td>
                    <td style={{ padding: 12, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {/* Unassign button - only show if device has a group */}
                        {d.group_name && (
                          <button 
                            style={{ 
                              ...btn, 
                              background: "#f59e0b", 
                              padding: "6px 10px", 
                              fontSize: 11,
                              opacity: unassigning === d.mobile_id ? 0.7 : 1,
                            }} 
                            onClick={() => handleUnassignFromGroup(d)}
                            disabled={unassigning === d.mobile_id}
                            title="Unassign from group"
                          >
                            {unassigning === d.mobile_id ? "..." : "🔓 Unassign"}
                          </button>
                        )}
                        {/* Active/Inactive toggle button - shows different action based on current tab */}
                        <button 
                          style={{ 
                            ...btn, 
                            background: activeTab === "inactive" ? "#16a34a" : "#dc2626", 
                            padding: "6px 10px", 
                            fontSize: 11,
                            opacity: togglingActive === d.mobile_id ? 0.7 : 1,
                          }} 
                          onClick={() => handleToggleActive(d)}
                          disabled={togglingActive === d.mobile_id}
                          title={activeTab === "inactive" ? "Activate device" : "Deactivate device"}
                        >
                          {togglingActive === d.mobile_id ? "..." : (activeTab === "inactive" ? "▶️ Activate" : "⏸️ Deactivate")}
                        </button>
                        <button 
                          style={{ ...btn, background: "#10b981", padding: "6px 12px", fontSize: 12 }} 
                          onClick={() => setAssignDevice(d)}
                          title="Assign videos to this device"
                        >
                          📹 Assign
                        </button>
                        <button style={btnReport} onClick={() => openReport(d)} title="View Temperature Report">
                          📈 Report
                        </button>
                        <button style={{ ...btn, background: "#6366f1", padding: "6px 12px", fontSize: 12 }} onClick={() => openEditModal(d)} title="Edit Device Resolution">
                          ✏️ Edit
                        </button>
                        <button style={btnDanger} onClick={() => onDelete(d)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {paginationBar}

        {/* Two-step Add Device Modal */}
        <Modal
          open={addOpen}
          title={step === 1 ? "Add Device - Step 1: Enter Mobile ID" : "Add Device - Step 2: Link to Group & Shop"}
          onClose={() => setAddOpen(false)}
          width="600px"
          footer={
            step === 1 ? (
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button style={btnGhost} onClick={() => setAddOpen(false)} disabled={adding}>
                  Cancel
                </button>
                <button style={btnGhost} onClick={addDeviceOnly} disabled={!canProceedToStep2 || adding}>
                  Create Without Linking
                </button>
                <button style={btn} onClick={handleProceedToStep2} disabled={!canProceedToStep2}>
                  Next: Select Group & Shop →
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button style={btnGhost} onClick={handleBack} disabled={adding}>
                  ← Back
                </button>
                <button style={btnGhost} onClick={() => setAddOpen(false)} disabled={adding}>
                  Cancel
                </button>
                <button style={btnSuccess} onClick={addDeviceWithLinking} disabled={!canSubmit || adding}>
                  {adding ? "Creating..." : "Create & Link Device"}
                </button>
              </div>
            )
          }
        >
          {errText && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 10,
                background: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
              }}
            >
              {errText}
            </div>
          )}

          {success && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 10,
                background: "#ecfdf5",
                color: "#065f46",
                border: "1px solid #a7f3d0",
              }}
            >
              {success}
            </div>
          )}

          {step === 1 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Device Name</div>
                <input
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. Store #1 Main Display"
                  style={inputStyle}
                  autoFocus
                />
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                  Give your device a friendly name for easy identification. This can be changed later.
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Mobile ID *</div>
                <input
                  value={mobileId}
                  onChange={(e) => setMobileId(e.target.value)}
                  placeholder="e.g. c5c64c89008c530e"
                  style={inputStyle}
                />
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                  This is the Android device ID. You can find it in the device settings or from the app.
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <input type="checkbox" checked={downloaded} onChange={(e) => setDownloaded(e.target.checked)} />
                Mark as downloaded (videos already on device)
              </label>

              <div style={{ padding: 12, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Workflow:</div>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#4b5563" }}>
                  <li>Enter a friendly name and the Mobile ID</li>
                  <li>Select Group and Shop to link the device</li>
                  <li>Videos from the group will be automatically assigned</li>
                </ol>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ padding: 12, background: "#eef2ff", borderRadius: 8, border: "1px solid #c7d2fe" }}>
                <div><strong>Device Name:</strong> {deviceName || <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Not set</span>}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}><strong>Mobile ID:</strong> <code style={{ background: "#e0e7ff", padding: "2px 6px", borderRadius: 4 }}>{mobileId}</code></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Group *</div>
                  <select
                    style={inputStyle}
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    disabled={loadingLists}
                  >
                    <option value="">-- Select Group --</option>
                    {groups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Videos are linked to groups</div>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Shop *</div>
                  <select
                    style={inputStyle}
                    value={shop}
                    onChange={(e) => setShop(e.target.value)}
                    disabled={loadingLists}
                  >
                    <option value="">-- Select Shop --</option>
                    {shops.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Location where device is installed</div>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Screen Resolution</div>
                  <select
                    style={inputStyle}
                    value={showCustomResolution ? "custom" : resolution}
                    onChange={(e) => handleResolutionChange(e.target.value)}
                  >
                    {RESOLUTION_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  
                  {/* Custom Resolution Input Fields */}
                  {showCustomResolution && (
                    <div style={{
                      marginTop: 12,
                      padding: 16,
                      background: "#f8fafc",
                      borderRadius: 10,
                      border: "2px dashed #cbd5e1",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "#64748b" }}>
                        Enter Custom Resolution
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, display: "block" }}>Width (px)</label>
                          <input
                            type="number"
                            placeholder="1920"
                            value={customWidth}
                            onChange={(e) => handleCustomResolutionChange(e.target.value, customHeight)}
                            style={{
                              ...inputStyle,
                              textAlign: "center",
                              fontFamily: "monospace",
                              fontWeight: 600,
                            }}
                            min="100"
                            max="7680"
                          />
                        </div>
                        <span style={{ fontSize: 20, color: "#94a3b8", marginTop: 16 }}>×</span>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, display: "block" }}>Height (px)</label>
                          <input
                            type="number"
                            placeholder="1080"
                            value={customHeight}
                            onChange={(e) => handleCustomResolutionChange(customWidth, e.target.value)}
                            style={{
                              ...inputStyle,
                              textAlign: "center",
                              fontFamily: "monospace",
                              fontWeight: 600,
                            }}
                            min="100"
                            max="4320"
                          />
                        </div>
                      </div>
                      {customWidth && customHeight && (
                        <div style={{
                          marginTop: 10,
                          padding: "8px 12px",
                          background: "#dcfce7",
                          borderRadius: 6,
                          fontSize: 12,
                          color: "#166534",
                          fontWeight: 600,
                          textAlign: "center",
                        }}>
                          ✓ Resolution: {customWidth}×{customHeight}
                          {parseInt(customWidth) > parseInt(customHeight) ? " (Landscape)" : 
                           parseInt(customWidth) < parseInt(customHeight) ? " (Portrait)" : " (Square)"}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Used for grid layout positioning</div>
                </div>
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: "#6b7280",
                  padding: 12,
                  background: "#fffbeb",
                  borderRadius: 8,
                  border: "1px solid #fde68a",
                }}
              >
                <strong>Note:</strong> The device will automatically receive all videos assigned to the selected group.
                You can change the video assignments in the "Group Linked Video" section.
              </div>
            </div>
          )}
        </Modal>

        {/* Temperature Report Modal */}
        <Modal
          open={reportOpen}
          title={`📈 Temperature Report: ${reportDevice}`}
          onClose={() => setReportOpen(false)}
          width="900px"
          footer={
            <button style={btnGhost} onClick={() => setReportOpen(false)}>
              Close
            </button>
          }
        >
          {/* Time Range Selector */}
          <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginRight: 8 }}>Time Range:</div>
            {[
              { value: "1h", label: "1 Hour" },
              { value: "6h", label: "6 Hours" },
              { value: "24h", label: "24 Hours" },
              { value: "7d", label: "7 Days" },
              { value: "30d", label: "30 Days" },
            ].map((opt) => (
              <button
                key={opt.value}
                style={{
                  ...btnTiny,
                  background: reportTimeRange === opt.value ? "#4f46e5" : "#fff",
                  color: reportTimeRange === opt.value ? "#fff" : "#374151",
                  borderColor: reportTimeRange === opt.value ? "#4f46e5" : "#e5e7eb",
                }}
                onClick={() => changeTimeRange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {reportLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading temperature data...</div>
          ) : (
            <TemperatureLineGraph
              data={reportData}
              timeRange={reportTimeRange}
              title={`Temperature History (${reportTimeRange})`}
              onDownload={downloadReport}
            />
          )}
        </Modal>

      {/* Edit Device Modal */}
      <Modal
        open={editOpen}
        title="✏️ Edit Device Settings"
        onClose={() => { setEditOpen(false); setEditDevice(null); setSuccess(""); }}
        width="500px"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button style={btnGhost} onClick={() => { setEditOpen(false); setEditDevice(null); }} disabled={updating}>
              Cancel
            </button>
            <button style={btn} onClick={updateDeviceSettings} disabled={updating}>
              {updating ? "Updating..." : "Save Changes"}
            </button>
          </div>
        }
      >
        {editDevice && (
          <div style={{ display: "grid", gap: 16 }}>
            {/* Device ID Display */}
            <div style={{
              padding: 16,
              background: "#f1f5f9",
              borderRadius: 10,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Mobile ID</div>
              <code style={{
                fontFamily: "monospace",
                fontWeight: 700,
                fontSize: 18,
                color: "#1e293b",
              }}>
                {editDevice.mobile_id}
              </code>
            </div>

            {errText && (
              <div style={{
                padding: "12px 16px",
                background: "#fee2e2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                color: "#dc2626",
                fontSize: 14,
              }}>
                {errText}
              </div>
            )}

            {success && (
              <div style={{
                padding: "14px",
                background: "#dcfce7",
                border: "1px solid #bbf7d0",
                borderRadius: 10,
                color: "#166534",
                textAlign: "center",
                fontWeight: 600,
              }}>
                ✅ {success}
              </div>
            )}

            {/* Device Name */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Device Name</div>
              <input
                value={editDeviceName}
                onChange={(e) => setEditDeviceName(e.target.value)}
                placeholder="e.g. Store #1 Main Display"
                style={inputStyle}
              />
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                A friendly name to easily identify this device.
              </div>
            </div>

            {/* Resolution Selection */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Screen Resolution</div>
              <select
                style={inputStyle}
                value={showEditCustomResolution ? "custom" : (RESOLUTION_OPTIONS.some(opt => opt.value === editResolution) ? editResolution : "custom")}
                onChange={(e) => handleEditResolutionChange(e.target.value)}
              >
                {RESOLUTION_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              
              {/* Custom Resolution Input Fields */}
              {showEditCustomResolution && (
                <div style={{
                  marginTop: 12,
                  padding: 16,
                  background: "#f8fafc",
                  borderRadius: 10,
                  border: "2px dashed #cbd5e1",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "#64748b" }}>
                    Enter Custom Resolution
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, display: "block" }}>Width (px)</label>
                      <input
                        type="number"
                        placeholder="1920"
                        value={editCustomWidth}
                        onChange={(e) => handleEditCustomResolutionChange(e.target.value, editCustomHeight)}
                        style={{
                          ...inputStyle,
                          textAlign: "center",
                          fontFamily: "monospace",
                          fontWeight: 600,
                        }}
                        min="100"
                        max="7680"
                      />
                    </div>
                    <span style={{ fontSize: 20, color: "#94a3b8", marginTop: 16 }}>×</span>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, display: "block" }}>Height (px)</label>
                      <input
                        type="number"
                        placeholder="1080"
                        value={editCustomHeight}
                        onChange={(e) => handleEditCustomResolutionChange(editCustomWidth, e.target.value)}
                        style={{
                          ...inputStyle,
                          textAlign: "center",
                          fontFamily: "monospace",
                          fontWeight: 600,
                        }}
                        min="100"
                        max="4320"
                      />
                    </div>
                  </div>
                  {editCustomWidth && editCustomHeight && (
                    <div style={{
                      marginTop: 10,
                      padding: "8px 12px",
                      background: "#dcfce7",
                      borderRadius: 6,
                      fontSize: 12,
                      color: "#166534",
                      fontWeight: 600,
                      textAlign: "center",
                    }}>
                      ✓ Resolution: {editCustomWidth}×{editCustomHeight}
                      {parseInt(editCustomWidth) > parseInt(editCustomHeight) ? " (Landscape)" : 
                       parseInt(editCustomWidth) < parseInt(editCustomHeight) ? " (Portrait)" : " (Square)"}
                    </div>
                  )}
                </div>
              )}
              
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
                This resolution is used for grid layout positioning and video scaling.
              </div>
            </div>

            {/* Current Resolution Display */}
            {editDevice.resolution && (
              <div style={{
                padding: 12,
                background: "#f5f3ff",
                borderRadius: 8,
                border: "1px solid #ddd6fe",
              }}>
                <div style={{ fontSize: 12, color: "#6d28d9", fontWeight: 600 }}>
                  Current Resolution: <code style={{ fontFamily: "monospace" }}>{editDevice.resolution}</code>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Assign to Group Modal */}
      <Modal
        open={!!assignDevice}
        title={changeGroupMode ? `🔄 Change Group for Device` : `👥 Assign Device to Group`}
        onClose={() => {
          setAssignDevice(null);
          setAssignGroup("");
          setAssignShop("");
          setErrText("");
          setChangeGroupMode(false);
        }}
        width="520px"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              style={btnGhost}
              onClick={() => {
                setAssignDevice(null);
                setAssignGroup("");
                setAssignShop("");
                setErrText("");
                setChangeGroupMode(false);
              }}
              disabled={assigning}
            >
              Cancel
            </button>
            <button
              style={changeGroupMode ? { ...btn, background: "#f59e0b" } : btnSuccess}
              onClick={async () => {
                if (!assignGroup || !assignShop) {
                  setErrText("Please select both group and shop");
                  return;
                }
                setAssigning(true);
                setErrText("");
                try {
                  // If changeGroupMode, first delete all existing links
                  if (changeGroupMode) {
                    try {
                      await dvsgApi.delete(`/device/${encodeURIComponent(assignDevice.mobile_id)}/links`);
                    } catch (delErr) {
                      // Ignore if no links exist
                      console.log("No existing links to delete or error:", delErr);
                    }
                  }
                  
                  // Link device to group - this will inherit all videos from the group
                  const res = await dvsgApi.post("/link/device-to-group", {
                    mobile_id: assignDevice.mobile_id,
                    gname: assignGroup,
                    shop_name: assignShop,
                  });
                  const data = res?.data || {};
                  console.log("Link device response:", data);
                  const videoCount = data.links_created || 0;
                  const videosInGroup = data.videos_in_group || 0;
                  let toastMsg = `Successfully ${changeGroupMode ? "changed" : "assigned"} ${assignDevice.mobile_id} to group "${assignGroup}"`;
                  if (videoCount > 0) {
                    toastMsg += ` (${videoCount} video(s) linked)`;
                  } else if (videosInGroup === 0) {
                    toastMsg += " (no videos in group yet)";
                  } else {
                    toastMsg += ` (Warning: ${videosInGroup} videos in group but 0 links created)`;
                  }
                  toast(toastMsg);
                  setAssignDevice(null);
                  setAssignGroup("");
                  setAssignShop("");
                  setChangeGroupMode(false);
                  loadPage(page, pageSize, qApplied);
                } catch (e) {
                  setErrText(e?.response?.data?.detail || "Failed to assign device to group");
                } finally {
                  setAssigning(false);
                }
              }}
              disabled={assigning || !assignGroup || !assignShop}
            >
              {assigning ? "Processing..." : (changeGroupMode ? "🔄 Change Group" : "Assign to Group")}
            </button>
          </div>
        }
      >
        {assignDevice && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {errText && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: 10, borderRadius: 8, fontSize: 13 }}>
                {errText}
              </div>
            )}

            <div style={{ padding: 12, background: changeGroupMode ? "#fef3c7" : "#f0f9ff", borderRadius: 8, border: changeGroupMode ? "1px solid #fcd34d" : "1px solid #bae6fd" }}>
              <div style={{ fontSize: 13, color: changeGroupMode ? "#92400e" : "#0369a1", fontWeight: 600 }}>
                Device: <code style={{ fontFamily: "monospace", background: changeGroupMode ? "#fef08a" : "#e0f2fe", padding: "2px 6px", borderRadius: 4 }}>{assignDevice.mobile_id}</code>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>
                {changeGroupMode ? (
                  <><strong>⚠️ Change Group:</strong> This will remove all existing video links and assign the device to the new group.</>
                ) : (
                  <><strong>Note:</strong> Assigning a device to a group will automatically link all videos from that group to this device. A device can only belong to ONE group.</>
                )}
              </div>
            </div>

            {/* Mode Toggle */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{
                  flex: 1,
                  padding: "10px",
                  border: changeGroupMode ? "1px solid #e5e7eb" : "2px solid #3b82f6",
                  background: changeGroupMode ? "#fff" : "#eff6ff",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  color: changeGroupMode ? "#6b7280" : "#1d4ed8",
                }}
                onClick={() => setChangeGroupMode(false)}
              >
                👥 New Assignment
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "10px",
                  border: changeGroupMode ? "2px solid #f59e0b" : "1px solid #e5e7eb",
                  background: changeGroupMode ? "#fefce8" : "#fff",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  color: changeGroupMode ? "#b45309" : "#6b7280",
                }}
                onClick={() => setChangeGroupMode(true)}
              >
                🔄 Change Group
              </button>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                {changeGroupMode ? "New Group *" : "Group *"}
              </label>
              <select
                value={assignGroup}
                onChange={(e) => setAssignGroup(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              >
                <option value="">Select a group...</option>
                {groups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                {changeGroupMode ? "New Shop *" : "Shop *"}
              </label>
              <select
                value={assignShop}
                onChange={(e) => setAssignShop(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              >
                <option value="">Select a shop...</option>
                {shops.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ padding: 12, background: "#fefce8", borderRadius: 8, border: "1px solid #fef08a" }}>
              <div style={{ fontSize: 12, color: "#854d0e" }}>
                💡 <strong>Tip:</strong> To add videos to a group, go to <strong>Link Videos</strong> in the sidebar and select the group.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
