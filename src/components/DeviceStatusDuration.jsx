// src/components/DeviceStatusDuration.jsx
// Shows device online/offline status with duration (e.g., "Online for 2h 15m")
import React, { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;

/**
 * Format seconds into human readable duration
 * @param {number} seconds 
 * @returns {string} e.g., "2h 15m", "3d 4h", "45m"
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return "0m";
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return "< 1m";
  }
}

/**
 * DeviceStatusDuration - Displays online/offline status with duration
 * 
 * Props:
 * - mobileId: string - The device mobile_id
 * - isOnline: boolean - Current online status (from device list)
 * - showUptime: boolean - Show uptime percentage (optional)
 * - compact: boolean - Compact display mode (optional)
 * - refreshInterval: number - Auto-refresh interval in ms (default: 30000)
 */
export default function DeviceStatusDuration({ 
  mobileId, 
  isOnline = false, 
  showUptime = false,
  compact = false,
  refreshInterval = 30000 
}) {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    if (!mobileId) return;
    
    try {
      const res = await fetch(`${API_BASE}/device/${encodeURIComponent(mobileId)}/status/duration`);
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
        setError(null);
      } else if (res.status === 404) {
        // Device not found - use fallback
        setStatusData(null);
      } else {
        setError("Failed to fetch");
      }
    } catch (err) {
      console.error("Error fetching device status:", err);
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [mobileId]);

  useEffect(() => {
    fetchStatus();
    
    // Auto-refresh
    if (refreshInterval > 0) {
      const interval = setInterval(fetchStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStatus, refreshInterval]);

  // Loading state
  if (loading) {
    return (
      <span style={{ color: "#9ca3af", fontSize: 12 }}>
        Loading...
      </span>
    );
  }

  // Error or no data - fallback to basic display
  if (error || !statusData) {
    const color = isOnline ? "#16a34a" : "#dc2626";
    const bg = isOnline ? "#dcfce7" : "#fef2f2";
    const text = isOnline ? "Online" : "Offline";
    
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: compact ? "2px 8px" : "4px 12px",
        background: bg,
        borderRadius: 20,
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        color: color
      }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color
        }} />
        {text}
      </span>
    );
  }

  // Full status display
  const { 
    is_online, 
    current_status_duration_seconds,
    current_status_duration_human,
    uptime_percentage 
  } = statusData;

  const actualOnline = is_online ?? isOnline;
  const color = actualOnline ? "#16a34a" : "#dc2626";
  const bg = actualOnline ? "#dcfce7" : "#fef2f2";
  const statusText = actualOnline ? "Online" : "Offline";
  const durationText = current_status_duration_human || formatDuration(current_status_duration_seconds);

  if (compact) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px",
          background: bg,
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 600,
          color: color
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            animation: actualOnline ? "pulse 2s infinite" : "none"
          }} />
          {statusText}
        </span>
        <span style={{ fontSize: 10, color: "#6b7280", paddingLeft: 4 }}>
          {durationText}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        background: bg,
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        color: color
      }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          animation: actualOnline ? "pulse 2s infinite" : "none"
        }} />
        {statusText} for {durationText}
      </span>
      
      {showUptime && uptime_percentage != null && (
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 6,
          paddingLeft: 4
        }}>
          <div style={{
            width: 60,
            height: 4,
            borderRadius: 2,
            background: "#e5e7eb",
            overflow: "hidden"
          }}>
            <div style={{
              width: `${uptime_percentage}%`,
              height: "100%",
              background: uptime_percentage >= 90 ? "#16a34a" : uptime_percentage >= 70 ? "#f59e0b" : "#dc2626",
              transition: "width 0.3s"
            }} />
          </div>
          <span style={{ fontSize: 10, color: "#6b7280" }}>
            {uptime_percentage.toFixed(1)}% uptime
          </span>
        </div>
      )}
    </div>
  );
}

// CSS animation for pulsing dot (add to your CSS or use inline keyframes)
const pulseKeyframes = `
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;

// Inject keyframes if not present
if (typeof document !== 'undefined') {
  const styleId = 'device-status-pulse-animation';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = pulseKeyframes;
    document.head.appendChild(style);
  }
}
