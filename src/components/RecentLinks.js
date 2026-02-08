// src/components/RecentLinks.js
// - Keeps your existing Play / Download / Edit / Delete behavior
// - Updates the "Report" button to show a Temperature line graph (time vs temperature)
// - Uses DVSG backend: GET /device/{mobile_id}/temperature_series?days=..&bucket=..

import React, { useEffect, useMemo, useState, useRef } from "react";
import { listLinks, deleteLink, createLink, getDeviceOnlineStatus } from "../api/link";
import { listVideoNames } from "../api/video";
import axios from "axios";
import GridLayoutEditor from "./GridLayoutEditor";

// DVSG API base (your video_group service)
const DVSG_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8005`;

const dvsgApi = axios.create({
  baseURL: DVSG_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});
dvsgApi.interceptors.request.use((c) => { const t = localStorage.getItem("digix_token") || localStorage.getItem("token"); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });

/* ======================== Styles ======================== */
const styles = {
  card: { background: "#fff", borderRadius: 16, overflow: "hidden" },
  header: {
    padding: "20px 24px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: "#1e293b",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  btn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    background: "#f1f5f9",
    color: "#475569",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    transition: "all 0.2s",
  },
  btnPrimary: {
    padding: "10px 18px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    boxShadow: "0 2px 8px rgba(102, 126, 234, 0.3)",
    transition: "all 0.2s",
  },
  btnSuccess: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "none",
    background: "#10b981",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    transition: "all 0.2s",
  },
  btnWarning: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "none",
    background: "#f59e0b",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    transition: "all 0.2s",
  },
  btnInfo: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "none",
    background: "#3b82f6",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    transition: "all 0.2s",
  },
  btnDanger: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "none",
    background: "#fee2e2",
    color: "#dc2626",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    transition: "all 0.2s",
  },
  input: {
    padding: "12px 16px",
    borderRadius: 10,
    border: "2px solid #e5e7eb",
    fontSize: 14,
    outline: "none",
    width: "100%",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    borderBottom: "2px solid #e5e7eb",
  },
  td: { padding: "16px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" },
};

/* ======================== Helpers ======================== */
function StatusDot({ isOnline }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 20,
        background:
          isOnline === undefined ? "#f1f5f9" : isOnline ? "#ecfdf5" : "#fef2f2",
        color:
          isOnline === undefined ? "#64748b" : isOnline ? "#059669" : "#dc2626",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background:
            isOnline === undefined ? "#9ca3af" : isOnline ? "#10b981" : "#ef4444",
          boxShadow: isOnline ? "0 0 8px rgba(16, 185, 129, 0.5)" : "none",
        }}
      />
      {isOnline === undefined ? "Unknown" : isOnline ? "Online" : "Offline"}
    </span>
  );
}

function DownloadProgressBadge({ progress }) {
  if (!progress || !progress.is_downloading) return null;
  
  const { current_file, total_files, file_name, progress: percent, downloaded_bytes, total_bytes } = progress;
  
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };
  
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "8px 12px",
        borderRadius: 10,
        background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        color: "#fff",
        fontSize: 11,
        marginTop: 8,
        boxShadow: "0 2px 8px rgba(59, 130, 246, 0.4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14 }}>⬇️</span>
        <span style={{ fontWeight: 700 }}>Downloading</span>
        <span style={{ opacity: 0.8, fontSize: 10 }}>
          File {current_file}/{total_files}
        </span>
      </div>
      
      {file_name && (
        <div style={{ 
          fontSize: 10, 
          opacity: 0.9,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 180,
        }}>
          {file_name}
        </div>
      )}
      
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          flex: 1,
          height: 6,
          background: "rgba(255,255,255,0.3)",
          borderRadius: 3,
          overflow: "hidden",
        }}>
          <div style={{
            width: `${percent || 0}%`,
            height: "100%",
            background: "#fff",
            borderRadius: 3,
            transition: "width 0.3s ease",
          }} />
        </div>
        <span style={{ fontWeight: 700, minWidth: 36 }}>{percent || 0}%</span>
      </div>
      
      {total_bytes > 0 && (
        <div style={{ fontSize: 10, opacity: 0.8 }}>
          {formatBytes(downloaded_bytes)} / {formatBytes(total_bytes)}
        </div>
      )}
    </div>
  );
}

function MetricsCard({ temperature, daily, monthly }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <span
        style={{
          padding: "4px 10px",
          borderRadius: 8,
          background: "#fef3c7",
          color: "#92400e",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        🌡️ {temperature ?? 0}°C
      </span>
      <span
        style={{
          padding: "4px 10px",
          borderRadius: 8,
          background: "#dbeafe",
          color: "#1e40af",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        📅 Daily: {daily ?? 0}
      </span>
      <span
        style={{
          padding: "4px 10px",
          borderRadius: 8,
          background: "#f3e8ff",
          color: "#7c3aed",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        📆 Monthly: {monthly ?? 0}
      </span>
    </div>
  );
}

function VideoTags({ videos }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {(videos || []).map((v) => (
        <span
          key={v}
          style={{
            padding: "5px 10px",
            borderRadius: 6,
            background: "#f1f5f9",
            color: "#475569",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          🎬 {v}
        </span>
      ))}
    </div>
  );
}

function DeviceRenameModal({ open, mobile_id, currentName, onClose, onSaved }) {
  const [deviceName, setDeviceName] = useState(currentName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDeviceName(currentName || "");
    setError("");
  }, [currentName, open]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await dvsgApi.post(`/device/${mobile_id}/name`, { device_name: deviceName.trim() });
      onSaved?.();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "Failed to rename device");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "95%",
          maxWidth: 400,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e5e7eb",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "16px 16px 0 0",
          }}
        >
          <h3 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 700 }}>
            ✏️ Rename Device
          </h3>
          <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
            {mobile_id}
          </p>
        </div>
        <div style={{ padding: 24 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151", fontSize: 13 }}>
            Device Name
          </label>
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="Enter a friendly name..."
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 10,
              border: "2px solid #e5e7eb",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
            autoFocus
          />
          {error && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "#fef2f2", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#3b82f6",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 14,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function groupRows(items) {
  const map = new Map();
  for (const it of items || []) {
    const key = `${it.mobile_id}||${it.gname}||${it.shop_name}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        mobile_id: it.mobile_id,
        device_name: it.device_name || null,
        gname: it.gname,
        shop_name: it.shop_name,
        temperature: it.temperature,
        daily_count: it.daily_count,
        monthly_count: it.monthly_count,
        rotation: it.rotation || 0,
        is_active: it.is_active !== false, // Default to true if not set
        originals: [],
      });
    }
    map.get(key).originals.push({
      id: it.id,
      link_id: it.id, // Alias for GridLayoutEditor compatibility
      video_name: it.video_name,
      rotation: it.rotation || 0,
      device_rotation: it.device_rotation, // Per-device rotation override
      grid_position: it.grid_position || 0,
    });
  }
  return Array.from(map.values()).map((row) => {
    // Sort originals by grid_position
    row.originals.sort((a, b) => (a.grid_position || 0) - (b.grid_position || 0));
    const videos = row.originals.map((x) => x.video_name);
    const idByVideo = Object.fromEntries(row.originals.map((x) => [x.video_name, x.id]));
    return { ...row, videos, idByVideo };
  });
}

function extractOnlineFlag(res) {
  const payload = res?.data ?? res;
  const candidates = [
    res?.online,
    res?.is_online,
    payload?.online,
    payload?.is_online,
    payload?.isOnline,
    payload?.status,
    payload,
  ];
  for (const v of candidates) {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "true" || s === "1" || s === "online") return true;
      if (s === "false" || s === "0" || s === "offline") return false;
    }
  }
  return false;
}

/* ======================== Video Player Modal (UPDATED - Grid Layout Support) ======================== */
function VideoPlayerModal({ open, onClose, deviceId, videos }) {
  const [videoData, setVideoData] = useState([]);
  const [layoutMode, setLayoutMode] = useState("single");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentSingleIndex, setCurrentSingleIndex] = useState(0);
  const videoRefs = useRef([]);

  useEffect(() => {
    if (!open || !deviceId || !videos?.length) {
      setVideoData([]);
      setCurrentSingleIndex(0);
      setLayoutMode("single");
      setError(null);
      return;
    }
    const fetchUrls = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await dvsgApi.get(
          `/device/${encodeURIComponent(deviceId)}/videos/downloads`
        );
        if (res.data?.items?.length > 0) {
          // Sort by grid_position for grid layouts
          const sortedItems = [...res.data.items].sort((a, b) => (a.grid_position || 0) - (b.grid_position || 0));
          setVideoData(sortedItems);
          setLayoutMode(res.data.layout_mode || "single");
        } else {
          setError("No downloadable videos found for this device");
        }
      } catch (e) {
        console.error("Failed to fetch video URLs:", e);
        setError(
          e?.response?.status === 404
            ? "No videos linked to this device or videos have no S3 links"
            : `Failed to load videos: ${e?.response?.data?.detail || e.message}`
        );
      } finally {
        setLoading(false);
      }
    };
    fetchUrls();
  }, [open, deviceId, videos]);

  useEffect(() => {
    if (!open) {
      videoRefs.current.forEach(ref => ref?.pause());
    }
  }, [open]);

  // For single mode - navigation
  const currentVideo = layoutMode === "single" ? videoData[currentSingleIndex] : null;
  const nextVideo = () => {
    if (videoData.length > 1 && layoutMode === "single")
      setCurrentSingleIndex((prev) => (prev + 1) % videoData.length);
  };
  const prevVideo = () => {
    if (videoData.length > 1 && layoutMode === "single")
      setCurrentSingleIndex((prev) => (prev - 1 + videoData.length) % videoData.length);
  };

  // Get grid layout styles based on layout_mode
  const getGridStyles = () => {
    switch (layoutMode) {
      case "split_h":
        return { display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr", gap: 2 };
      case "split_v":
        return { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "1fr 1fr", gap: 2 };
      case "grid_3":
        return { display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 2 };
      case "grid_4":
        return { display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 2 };
      case "grid_1x4":
        return { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "1fr 1fr 1fr 1fr", gap: 2 };
      default:
        return {};
    }
  };

  // Get video container style for grid_3 (third video spans full width)
  const getVideoContainerStyle = (index) => {
    if (layoutMode === "grid_3" && index === 2) {
      return { gridColumn: "1 / -1" };
    }
    return {};
  };

  if (!open) return null;

  const isGridMode = layoutMode !== "single" && videoData.length > 1;

  // Calculate appropriate height based on layout
  const getVideoContainerHeight = () => {
    if (isGridMode) {
      // For grid modes, limit height to fit viewport
      if (layoutMode === "grid_1x4") return "min(70vh, 600px)";
      if (layoutMode === "split_v") return "min(60vh, 500px)";
      return "min(50vh, 450px)"; // 2x2 and other grids
    }
    return "auto";
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 3000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isGridMode ? "min(90vw, 800px)" : "min(90vw, 700px)",
          maxHeight: "90vh",
          background: "#000",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            background: "linear-gradient(90deg, #1f2937, #374151)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#fff", fontWeight: 600 }}>
              🎬 Device: {deviceId}
            </span>
            <span style={{
              padding: "4px 10px",
              background: isGridMode ? "#10b981" : "#6366f1",
              borderRadius: 6,
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
            }}>
              {isGridMode ? `Grid: ${layoutMode.replace("_", " ").toUpperCase()}` : "Single View"}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "none",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Info Bar (for single mode) */}
        {!isGridMode && currentVideo && (
          <div
            style={{
              padding: "8px 16px",
              background: "#374151",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ color: "#e5e7eb", fontSize: 14 }}>
              <span style={{ color: "#9ca3af" }}>
                {currentVideo.content_type === "image" ? "Image" : "Video"} {currentSingleIndex + 1} of {videoData.length}:
              </span>{" "}
              <strong>{currentVideo.video_name || currentVideo.filename || "Unknown"}</strong>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {currentVideo.content_type === "image" && (
                <span
                  style={{
                    padding: "4px 10px",
                    background: "#10b981",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  🖼️ Image
                </span>
              )}
              {(currentVideo.rotation || 0) !== 0 && (
                <span
                  style={{
                    padding: "4px 10px",
                    background: "#4f46e5",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Rotation: {currentVideo.rotation}°
                </span>
              )}
            </div>
          </div>
        )}

        {/* Video Container */}
        <div
          style={{
            background: "#000",
            height: getVideoContainerHeight(),
            minHeight: isGridMode ? 300 : 250,
            maxHeight: isGridMode ? "70vh" : "60vh",
            position: "relative",
            overflow: "hidden",
            ...(isGridMode ? getGridStyles() : { display: "flex", alignItems: "center", justifyContent: "center" }),
          }}
        >
          {loading ? (
            <div style={{ color: "#fff", padding: 40, gridColumn: "1 / -1", textAlign: "center" }}>Loading content...</div>
          ) : error ? (
            <div style={{ color: "#fff", padding: 40, textAlign: "center", gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
              <div style={{ color: "#ef4444", marginBottom: 8 }}>Content not available</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{error}</div>
            </div>
          ) : isGridMode ? (
            // GRID MODE - Multiple videos/images simultaneously
            videoData.slice(0, layoutMode === "grid_1x4" ? 4 : layoutMode === "grid_4" ? 4 : layoutMode === "grid_3" ? 3 : 2).map((item, index) => {
              const isImage = item.content_type === "image";
              return (
                <div
                  key={item.link_id || index}
                  style={{
                    position: "relative",
                    background: "#111",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    ...getVideoContainerStyle(index),
                  }}
                >
                  {item.url ? (
                    <>
                      {isImage ? (
                        <img
                          src={item.url}
                          alt={item.video_name || "Image"}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: item.fit_mode || "cover",
                            transform: `rotate(${item.rotation || 0}deg)`,
                          }}
                        />
                      ) : (
                        <video
                          ref={el => videoRefs.current[index] = el}
                          src={item.url}
                          autoPlay
                          muted={index > 0} // Only first video has sound
                          loop
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            transform: `rotate(${item.rotation || 0}deg)`,
                          }}
                        />
                      )}
                      {/* Content label overlay */}
                      <div style={{
                        position: "absolute",
                        bottom: 8,
                        left: 8,
                        padding: "4px 8px",
                        background: isImage ? "rgba(16,185,129,0.8)" : "rgba(0,0,0,0.7)",
                        borderRadius: 4,
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {isImage ? "🖼️" : "🎬"} {index + 1}. {item.video_name || (isImage ? "Image" : "Video")}
                        {(item.rotation || 0) !== 0 && ` (${item.rotation}°)`}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#6b7280", textAlign: "center" }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{isImage ? "🖼️" : "🎬"}</div>
                      <div style={{ fontSize: 12 }}>No URL</div>
                    </div>
                  )}
                </div>
              );
            })
          ) : currentVideo?.url ? (
            // SINGLE MODE - One video/image at a time
            currentVideo.content_type === "image" ? (
              <img
                src={currentVideo.url}
                alt={currentVideo.video_name || "Image"}
                style={{
                  maxWidth: "100%",
                  maxHeight: 500,
                  objectFit: currentVideo.fit_mode || "contain",
                  transform: `rotate(${currentVideo.rotation || 0}deg)`,
                  transition: "transform 0.3s",
                }}
              />
            ) : (
              <video
                ref={el => videoRefs.current[0] = el}
                src={currentVideo.url}
                controls
                autoPlay
                style={{
                  maxWidth: "100%",
                  maxHeight: 500,
                  transform: `rotate(${currentVideo.rotation || 0}deg)`,
                  transition: "transform 0.3s",
                }}
                onEnded={nextVideo}
                onError={() => setError("Failed to play video. The URL may have expired.")}
              />
            )
          ) : (
            <div style={{ color: "#6b7280", padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
              <div>No content URL available</div>
            </div>
          )}
        </div>

        {/* Navigation (for single mode only) */}
        {!isGridMode && videoData.length > 1 && (
          <div
            style={{
              padding: "12px 16px",
              background: "#1f2937",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <button
              onClick={prevVideo}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#4f46e5",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              ◀ Previous
            </button>

            <div style={{ display: "flex", gap: 6 }}>
              {videoData.map((_, i) => (
                <div
                  key={i}
                  onClick={() => setCurrentSingleIndex(i)}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: i === currentSingleIndex ? "#4f46e5" : "#4b5563",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>

            <button
              onClick={nextVideo}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#4f46e5",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Next ▶
            </button>
          </div>
        )}

        {/* Grid mode controls */}
        {isGridMode && (
          <div
            style={{
              padding: "12px 16px",
              background: "#1f2937",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <span style={{ color: "#9ca3af", fontSize: 13 }}>
              Playing {videoData.slice(0, layoutMode === "grid_1x4" ? 4 : layoutMode === "grid_4" ? 4 : layoutMode === "grid_3" ? 3 : 2).length} videos in grid layout
            </span>
            <button
              onClick={() => {
                videoRefs.current.forEach(ref => {
                  if (ref) {
                    ref.currentTime = 0;
                    ref.play();
                  }
                });
              }}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#10b981",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              🔄 Restart All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ======================== Temperature Report Modal (UPDATED) ======================== */
function TemperatureReportModal({ open, onClose, deviceId }) {
  const [loading, setLoading] = useState(false);
  const [series, setSeries] = useState([]);
  const [error, setError] = useState(null);
  const [range, setRange] = useState("30d"); // 24h, 7d, 30d, 90d

  const rangeToDays = (r) => {
    if (r === "24h") return 1;
    if (r === "7d") return 7;
    if (r === "30d") return 30;
    if (r === "90d") return 90;
    return 30;
  };

  const load = async (r = range) => {
    if (!deviceId) return;
    setLoading(true);
    setError(null);
    setRange(r);

    try {
      const days = rangeToDays(r);
      // bucket="hour" for 24h, otherwise bucket="day"
      const bucket = r === "24h" ? "hour" : "day";

      const res = await dvsgApi.get(
        `/device/${encodeURIComponent(deviceId)}/temperature_series`,
        { params: { days, bucket } }
      );

      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      // Normalize
      const normalized = items
        .map((x) => ({
          t: x.t ? new Date(x.t) : null,
          temperature: x.temperature == null ? null : Number(x.temperature),
        }))
        .filter((x) => x.t && Number.isFinite(x.temperature))
        .sort((a, b) => a.t - b.t);

      setSeries(normalized);
    } catch (e) {
      console.error("Temperature series failed:", e);
      setError(e?.response?.data?.detail || e.message || "Failed to load temperature report");
      setSeries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setSeries([]);
      setError(null);
      setRange("30d");
      return;
    }
    load("30d");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId]);

  const stats = useMemo(() => {
    if (!series.length) return null;
    const temps = series.map((x) => x.temperature);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    const cur = temps[temps.length - 1];
    return {
      points: series.length,
      min,
      max,
      avg,
      cur,
      from: series[0].t,
      to: series[series.length - 1].t,
    };
  }, [series]);

  // Simple SVG line chart (no external libs)
  const chart = useMemo(() => {
    const W = 640;
    const H = 260;
    const padL = 46, padR = 16, padT = 16, padB = 34;

    if (!series.length) {
      return { W, H, path: "", yMin: 0, yMax: 0, ticks: [] };
    }

    const tMin = series[0].t.getTime();
    const tMax = series[series.length - 1].t.getTime();
    const temps = series.map((p) => p.temperature);
    let yMin = Math.min(...temps);
    let yMax = Math.max(...temps);

    // small padding
    if (yMax === yMin) {
      yMax += 1;
      yMin -= 1;
    } else {
      const pad = (yMax - yMin) * 0.1;
      yMax += pad;
      yMin -= pad;
    }

    const xScale = (t) => {
      if (tMax === tMin) return padL;
      return padL + ((t - tMin) / (tMax - tMin)) * (W - padL - padR);
    };
    const yScale = (y) => padT + ((yMax - y) / (yMax - yMin)) * (H - padT - padB);

    const pts = series.map((p) => [xScale(p.t.getTime()), yScale(p.temperature)]);
    const path = pts
      .map((p, i) => (i === 0 ? `M ${p[0].toFixed(2)} ${p[1].toFixed(2)}` : `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`))
      .join(" ");

    // 4 y-ticks
    const ticks = [];
    for (let i = 0; i < 4; i++) {
      const v = yMin + (i * (yMax - yMin)) / 3;
      ticks.push({ v, y: yScale(v) });
    }

    return { W, H, path, yMin, yMax, ticks, padL, padR, padT, padB };
  }, [series]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 3000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(98vw, 900px)",
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
            🌡️ Temperature Report: {deviceId}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "none",
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 16, overflowY: "auto" }}>
          {/* Range Buttons */}
          <div style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginRight: 8 }}>
              Range:
            </span>
            {[
              { v: "24h", l: "24 Hours" },
              { v: "7d", l: "7 Days" },
              { v: "30d", l: "30 Days" },
              { v: "90d", l: "90 Days" },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => load(opt.v)}
                style={{
                  ...styles.btn,
                  padding: "6px 12px",
                  background: range === opt.v ? "#f59e0b" : "#f1f5f9",
                  color: range === opt.v ? "#fff" : "#475569",
                }}
              >
                {opt.l}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              Loading temperature series...
            </div>
          ) : error ? (
            <div
              style={{
                padding: 14,
                background: "#fef2f2",
                borderRadius: 10,
                color: "#dc2626",
              }}
            >
              {error}
            </div>
          ) : !series.length ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              No temperature points found for this period.
              <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
                Make sure your device is sending data to <code>/device/&lt;mobile_id&gt;/temperature_update</code>
              </div>
            </div>
          ) : (
            <>
              {/* Stats */}
              {stats && (
                <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ padding: "10px 16px", background: "#dbeafe", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "#1e40af" }}>Current</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1e40af" }}>
                      {stats.cur.toFixed(2)}°C
                    </div>
                  </div>
                  <div style={{ padding: "10px 16px", background: "#dcfce7", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "#166534" }}>Average</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#166534" }}>
                      {stats.avg.toFixed(2)}°C
                    </div>
                  </div>
                  <div style={{ padding: "10px 16px", background: "#fef3c7", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "#92400e" }}>Min</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#92400e" }}>
                      {stats.min.toFixed(2)}°C
                    </div>
                  </div>
                  <div style={{ padding: "10px 16px", background: "#fee2e2", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "#991b1b" }}>Max</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#991b1b" }}>
                      {stats.max.toFixed(2)}°C
                    </div>
                  </div>
                  <div style={{ padding: "10px 16px", background: "#e0e7ff", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "#4338ca" }}>Points</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#4338ca" }}>
                      {stats.points}
                    </div>
                  </div>
                </div>
              )}

              {/* Chart */}
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <svg width="100%" viewBox={`0 0 ${chart.W} ${chart.H}`}>
                  {/* grid + y labels */}
                  {chart.ticks.map((t, i) => (
                    <g key={i}>
                      <line
                        x1={chart.padL}
                        y1={t.y}
                        x2={chart.W - chart.padR}
                        y2={t.y}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                      <text
                        x={chart.padL - 6}
                        y={t.y + 4}
                        textAnchor="end"
                        fontSize="11"
                        fill="#64748b"
                      >
                        {t.v.toFixed(1)}
                      </text>
                    </g>
                  ))}

                  {/* axes */}
                  <line
                    x1={chart.padL}
                    y1={chart.padT}
                    x2={chart.padL}
                    y2={chart.H - chart.padB}
                    stroke="#94a3b8"
                    strokeWidth="1"
                  />
                  <line
                    x1={chart.padL}
                    y1={chart.H - chart.padB}
                    x2={chart.W - chart.padR}
                    y2={chart.H - chart.padB}
                    stroke="#94a3b8"
                    strokeWidth="1"
                  />

                  {/* line */}
                  <path d={chart.path} fill="none" stroke="#f59e0b" strokeWidth="2.5" />

                  {/* last point */}
                  {series.length > 0 && (
                    <circle
                      cx={Number(chart.path.split(" ").slice(-2)[0] || 0)}
                      cy={Number(chart.path.split(" ").slice(-1)[0] || 0)}
                      r="3.5"
                      fill="#f59e0b"
                    />
                  )}
                </svg>
              </div>

              {/* Last points table */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                  Latest points
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead style={{ background: "#f8fafc" }}>
                      <tr>
                        <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                          Time
                        </th>
                        <th style={{ padding: 10, textAlign: "right", borderBottom: "1px solid #e5e7eb" }}>
                          Temperature
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {series.slice(-10).reverse().map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: 10, color: "#334155" }}>{p.t.toLocaleString()}</td>
                          <td style={{ padding: 10, textAlign: "right", fontFamily: "monospace" }}>
                            {p.temperature.toFixed(2)}°C
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================== Uptime Report Modal ======================== */
function UptimeReportModal({ open, onClose, deviceId }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRange] = useState("7d");

  const load = async (r = range) => {
    if (!deviceId) return;
    setLoading(true);
    setError(null);
    setRange(r);

    try {
      const now = new Date();
      let startDate = new Date();
      
      switch (r) {
        case "24h":
          startDate.setDate(now.getDate() - 1);
          break;
        case "7d":
          startDate.setDate(now.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(now.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(now.getDate() - 90);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      const res = await dvsgApi.get(
        `/device/${encodeURIComponent(deviceId)}/uptime_report`,
        { 
          params: { 
            start_date: startDate.toISOString().split("T")[0],
            end_date: now.toISOString().split("T")[0],
          } 
        }
      );

      setData(res.data);
    } catch (e) {
      console.error("Uptime report failed:", e);
      setError(e?.response?.data?.detail || e.message || "Failed to load uptime report");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setData(null);
      setError(null);
      setRange("7d");
      return;
    }
    load("7d");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId]);

  // Format duration in human-readable format
  const formatDuration = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    if (seconds < 86400) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return `${h}h ${m}m`;
    }
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    return `${d}d ${h}h`;
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return "Ongoing";
    const d = new Date(isoString);
    return d.toLocaleString();
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 3000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(98vw, 800px)",
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
            ⏱️ Uptime Report: {deviceId}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "none",
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 16, overflowY: "auto" }}>
          {/* Range Buttons */}
          <div style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginRight: 8 }}>
              Range:
            </span>
            {[
              { v: "24h", l: "24 Hours" },
              { v: "7d", l: "7 Days" },
              { v: "30d", l: "30 Days" },
              { v: "90d", l: "90 Days" },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => load(opt.v)}
                style={{
                  ...styles.btn,
                  padding: "6px 12px",
                  background: range === opt.v ? "#6366f1" : "#f1f5f9",
                  color: range === opt.v ? "#fff" : "#475569",
                }}
              >
                {opt.l}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              Loading uptime data...
            </div>
          ) : error ? (
            <div
              style={{
                padding: 14,
                background: "#fef2f2",
                borderRadius: 10,
                color: "#dc2626",
              }}
            >
              {error}
            </div>
          ) : !data || (!data.sessions?.length && data.total_online_events === 0) ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              No uptime data found for this period.
              <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
                Uptime tracking starts when the device first connects.
              </div>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <div style={{ padding: "10px 16px", background: "#dcfce7", borderRadius: 8, minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: "#166534" }}>Online Time</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#166534" }}>
                    {formatDuration(data.total_online_seconds)}
                  </div>
                </div>
                <div style={{ padding: "10px 16px", background: "#fee2e2", borderRadius: 8, minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: "#991b1b" }}>Offline Time</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#991b1b" }}>
                    {formatDuration(data.total_offline_seconds)}
                  </div>
                </div>
                <div style={{ padding: "10px 16px", background: "#dbeafe", borderRadius: 8, minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: "#1e40af" }}>Uptime</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1e40af" }}>
                    {data.online_percentage.toFixed(1)}%
                  </div>
                </div>
                <div style={{ padding: "10px 16px", background: "#f3e8ff", borderRadius: 8, minWidth: 80 }}>
                  <div style={{ fontSize: 11, color: "#7c3aed" }}>Online Events</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#7c3aed" }}>
                    {data.total_online_events}
                  </div>
                </div>
                <div style={{ padding: "10px 16px", background: "#fef3c7", borderRadius: 8, minWidth: 80 }}>
                  <div style={{ fontSize: 11, color: "#92400e" }}>Offline Events</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#92400e" }}>
                    {data.total_offline_events}
                  </div>
                </div>
              </div>

              {/* Uptime Bar */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Uptime Overview
                </div>
                <div style={{ 
                  height: 24, 
                  borderRadius: 12, 
                  overflow: "hidden", 
                  display: "flex",
                  background: "#e5e7eb",
                }}>
                  <div 
                    style={{ 
                      width: `${data.online_percentage}%`, 
                      background: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                      transition: "width 0.3s",
                    }} 
                  />
                  <div 
                    style={{ 
                      width: `${100 - data.online_percentage}%`, 
                      background: "linear-gradient(90deg, #ef4444 0%, #f87171 100%)",
                      transition: "width 0.3s",
                    }} 
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "#6b7280" }}>
                  <span>🟢 Online: {data.online_percentage.toFixed(1)}%</span>
                  <span>🔴 Offline: {(100 - data.online_percentage).toFixed(1)}%</span>
                </div>
              </div>

              {/* Sessions Table */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                  Recent Sessions (Last {Math.min(data.sessions?.length || 0, 100)})
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", maxHeight: 300, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                      <tr>
                        <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                          Status
                        </th>
                        <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                          Start
                        </th>
                        <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                          End
                        </th>
                        <th style={{ padding: 10, textAlign: "right", borderBottom: "1px solid #e5e7eb" }}>
                          Duration
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.sessions || []).map((s, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: 10 }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "3px 8px",
                                borderRadius: 12,
                                background: s.type === "online" ? "#dcfce7" : "#fee2e2",
                                color: s.type === "online" ? "#166534" : "#991b1b",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: s.type === "online" ? "#10b981" : "#ef4444",
                                }}
                              />
                              {s.type === "online" ? "Online" : "Offline"}
                            </span>
                          </td>
                          <td style={{ padding: 10, color: "#475569" }}>
                            {formatDateTime(s.start)}
                          </td>
                          <td style={{ padding: 10, color: "#475569" }}>
                            {s.ongoing ? (
                              <span style={{ color: "#10b981", fontWeight: 600 }}>Ongoing</span>
                            ) : (
                              formatDateTime(s.end)
                            )}
                          </td>
                          <td style={{ padding: 10, textAlign: "right", fontWeight: 600, color: "#1e293b" }}>
                            {formatDuration(s.duration_seconds)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================== Edit Content Modal (Videos + Images) ======================== */
function EditContentModal({ open, onClose, row, onSaved }) {
  const [tab, setTab] = useState("videos"); // "videos" or "images"
  const [allVideoNames, setAllVideoNames] = useState([]);
  const [allImageNames, setAllImageNames] = useState([]);
  const [typedVideo, setTypedVideo] = useState("");
  const [typedImage, setTypedImage] = useState("");
  const [videoList, setVideoList] = useState(row?.videos || []);
  const [imageList, setImageList] = useState(row?.images || []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setTypedVideo("");
    setTypedImage("");
    setVideoList(row?.videos || []);
    setImageList(row?.images || []);
    setMsg("");
    setTab("videos");
    
    // Load videos
    (async () => {
      try {
        const names = await listVideoNames();
        setAllVideoNames(Array.isArray(names) ? names : []);
      } catch {
        setAllVideoNames([]);
      }
    })();
    
    // Load images/advertisements
    (async () => {
      try {
        const res = await dvsgApi.get("/advertisements", { params: { limit: 500 } });
        const ads = res.data?.items || res.data || [];
        setAllImageNames(ads.map(a => a.ad_name).filter(Boolean));
      } catch {
        setAllImageNames([]);
      }
    })();
  }, [open, row]);

  const addVideo = () => {
    const v = (typedVideo || "").trim();
    if (!v) return;
    if (!allVideoNames.includes(v)) {
      setMsg(`"${v}" is not in the video list.`);
      return;
    }
    if (!videoList.includes(v)) setVideoList([...videoList, v]);
    setTypedVideo("");
    setMsg("");
  };

  const addImage = () => {
    const v = (typedImage || "").trim();
    if (!v) return;
    if (!allImageNames.includes(v)) {
      setMsg(`"${v}" is not in the image list.`);
      return;
    }
    if (!imageList.includes(v)) setImageList([...imageList, v]);
    setTypedImage("");
    setMsg("");
  };

  const removeVideo = (v) => setVideoList(videoList.filter((x) => x !== v));
  const removeImage = (v) => setImageList(imageList.filter((x) => x !== v));

  const save = async () => {
    if (!row || busy) return;
    setBusy(true);
    setMsg("");
    try {
      // Handle videos
      const beforeVideos = new Set(row.videos || []);
      const afterVideos = new Set(videoList || []);
      const toDeleteVideos = [...beforeVideos].filter((v) => !afterVideos.has(v));
      const toAddVideos = [...afterVideos].filter((v) => !beforeVideos.has(v));

      await Promise.all(
        toDeleteVideos.map((v) => {
          const id = row.idByVideo?.[v];
          if (!id) return Promise.resolve();
          return deleteLink(id);
        })
      );

      await Promise.all(
        toAddVideos.map((v) =>
          createLink({
            mobile_id: row.mobile_id,
            gname: row.gname,
            shop_name: row.shop_name,
            video_name: v,
          })
        )
      );

      // Handle images - update layout_config if images changed
      const beforeImages = new Set(row.images || []);
      const afterImages = new Set(imageList || []);
      const imagesChanged = toDeleteVideos.length > 0 || toAddVideos.length > 0 ||
        [...beforeImages].some(i => !afterImages.has(i)) ||
        [...afterImages].some(i => !beforeImages.has(i));
      
      if (imagesChanged && imageList.length > 0) {
        // Build a simple layout config with the first image
        // For more complex layouts, use GridLayoutEditor
        const layoutConfig = imageList.map((imgName, idx) => ({
          position: idx + 1,
          ad_name: imgName,
          content_type: "image",
          rotation: null,
        }));
        
        await dvsgApi.post(`/device/${row.mobile_id}/layout`, {
          layout_mode: imageList.length === 1 ? "single" : "split_h",
          layout_config: JSON.stringify(layoutConfig),
        });
      }

      onSaved?.();
      onClose?.();
    } catch (e) {
      setMsg(e?.response?.data?.detail || e.message || "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const tabStyle = (active) => ({
    padding: "10px 20px",
    border: "none",
    borderBottom: active ? "3px solid #667eea" : "3px solid transparent",
    background: active ? "#f8fafc" : "transparent",
    color: active ? "#667eea" : "#64748b",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(95vw, 650px)",
          maxHeight: "90vh",
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 600 }}>
            ✏️ Edit Content
          </h3>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              border: "none",
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
          <button style={tabStyle(tab === "videos")} onClick={() => setTab("videos")}>
            🎬 Videos ({videoList.length})
          </button>
          <button style={tabStyle(tab === "images")} onClick={() => setTab("images")}>
            🖼️ Images ({imageList.length})
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          <div style={{ color: "#475569", fontSize: 14 }}>
            Device: <b>{row?.mobile_id}</b> — Group: <b>{row?.gname}</b> — Shop:{" "}
            <b>{row?.shop_name}</b>
          </div>

          {/* Videos Tab */}
          {tab === "videos" && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(videoList || []).map((v) => (
                  <span
                    key={v}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      borderRadius: 10,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    🎬 {v}
                    <button
                      onClick={() => removeVideo(v)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 8,
                        border: "none",
                        background: "#fee2e2",
                        color: "#dc2626",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {(!videoList || videoList.length === 0) && (
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>No videos selected.</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  style={styles.input}
                  placeholder="Type video name..."
                  value={typedVideo}
                  onChange={(e) => setTypedVideo(e.target.value)}
                  list="videoNamesList"
                />
                <datalist id="videoNamesList">
                  {allVideoNames.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
                <button onClick={addVideo} disabled={!typedVideo} style={styles.btn}>
                  Add
                </button>
              </div>
            </>
          )}

          {/* Images Tab */}
          {tab === "images" && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(imageList || []).map((v) => (
                  <span
                    key={v}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      borderRadius: 10,
                      background: "#ecfdf5",
                      color: "#059669",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    🖼️ {v}
                    <button
                      onClick={() => removeImage(v)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 8,
                        border: "none",
                        background: "#fee2e2",
                        color: "#dc2626",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {(!imageList || imageList.length === 0) && (
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>No images selected.</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  style={styles.input}
                  placeholder="Type image name..."
                  value={typedImage}
                  onChange={(e) => setTypedImage(e.target.value)}
                  list="imageNamesList"
                />
                <datalist id="imageNamesList">
                  {allImageNames.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
                <button onClick={addImage} disabled={!typedImage} style={styles.btn}>
                  Add
                </button>
              </div>
              
              <div style={{ padding: 12, background: "#f0f9ff", borderRadius: 8, fontSize: 12, color: "#0369a1" }}>
                💡 <b>Tip:</b> For advanced layouts with multiple videos and images, use the <b>Grid Layout Editor</b> (🔲 button).
              </div>
            </>
          )}

          {msg && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "#fef2f2",
                color: "#dc2626",
                fontSize: 13,
              }}
            >
              {msg}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={styles.btn}>
              Cancel
            </button>
            <button onClick={save} disabled={busy} style={styles.btnPrimary}>
              {busy ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================== Main Component ======================== */
export default function RecentLinks({ refreshKey }) {
  const [rowsRaw, setRowsRaw] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [layoutInfo, setLayoutInfo] = useState({}); // Store layout_mode per device
  const [layoutRefreshKey, setLayoutRefreshKey] = useState(0); // Force layout reload
  const [downloadProgress, setDownloadProgress] = useState({}); // Store download progress per device
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [loadedAt, setLoadedAt] = useState(null);

  const [editing, setEditing] = useState(null);
  const [playingRow, setPlayingRow] = useState(null);
  const [reportDevice, setReportDevice] = useState(null);
  const [uptimeDevice, setUptimeDevice] = useState(null);
  const [gridLayoutDevice, setGridLayoutDevice] = useState(null);
  const [renamingDevice, setRenamingDevice] = useState(null); // { mobile_id, device_name }

  const [fDevice, setFDevice] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [fShop, setFShop] = useState("");
  const [fVideo, setFVideo] = useState("");

  const load = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await listLinks({ limit: 1000, offset: 0 });
      const items = res?.data?.items || res?.items || [];
      setRowsRaw(items);
      setLoadedAt(new Date());
    } catch (e) {
      setMsg(e?.response?.data?.detail || e.message || "Failed to load.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowsGrouped = useMemo(() => groupRows(rowsRaw), [rowsRaw]);

  // Poll download progress for all devices (more frequently than other data)
  useEffect(() => {
    const devices = Array.from(new Set(rowsGrouped.map((r) => r.mobile_id)));
    if (devices.length === 0) return;

    let cancelled = false;
    
    const fetchProgress = async () => {
      try {
        const progressResults = await Promise.all(
          devices.map((mobileId) =>
            fetch(`${window.location.protocol}//${window.location.hostname}:8005/device/${encodeURIComponent(mobileId)}/download_progress`)
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          )
        );
        if (cancelled) return;

        setDownloadProgress((prev) => {
          const next = { ...prev };
          progressResults.forEach((data) => {
            if (data && data.mobile_id) {
              next[data.mobile_id] = data;
            }
          });
          return next;
        });
      } catch (e) {
        // Ignore errors
      }
    };

    // Initial fetch
    fetchProgress();
    
    // Poll every 2 seconds for download progress
    const intervalId = setInterval(fetchProgress, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [rowsGrouped]);

  // Load online status AND layout info for each device
  useEffect(() => {
    const devices = Array.from(new Set(rowsGrouped.map((r) => r.mobile_id)));
    if (devices.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        // Load online status
        const onlineResults = await Promise.all(
          devices.map((mobileId) =>
            getDeviceOnlineStatus(mobileId)
              .then((res) => ({ mobileId, is_online: extractOnlineFlag(res) }))
              .catch(() => ({ mobileId, is_online: false }))
          )
        );
        if (cancelled) return;

        setOnlineStatus((prev) => {
          const next = { ...prev };
          onlineResults.forEach(({ mobileId, is_online }) => {
            next[mobileId] = is_online;
          });
          return next;
        });

        // Load layout info for each device
        const layoutResults = await Promise.all(
          devices.map((mobileId) =>
            fetch(`${window.location.protocol}//${window.location.hostname}:8005/device/${encodeURIComponent(mobileId)}/layout`)
              .then(r => r.ok ? r.json() : null)
              .then(data => ({ 
                mobileId, 
                layout_mode: data?.layout_mode || "single",
                layout_config: data?.layout_config || null
              }))
              .catch(() => ({ mobileId, layout_mode: "single", layout_config: null }))
          )
        );
        if (cancelled) return;

        setLayoutInfo((prev) => {
          const next = { ...prev };
          layoutResults.forEach(({ mobileId, layout_mode, layout_config }) => {
            // Parse layout_config if it's a string
            let parsedConfig = [];
            if (layout_config) {
              try {
                const parsed = typeof layout_config === 'string' ? JSON.parse(layout_config) : layout_config;
                // Ensure parsedConfig is always an array
                parsedConfig = Array.isArray(parsed) ? parsed : [];
              } catch (e) {
                parsedConfig = [];
              }
            }
            next[mobileId] = { mode: layout_mode, config: parsedConfig };
          });
          return next;
        });
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [rowsGrouped, layoutRefreshKey]);

  const rowsFiltered = useMemo(() => {
    const d = (fDevice || "").toLowerCase();
    const g = (fGroup || "").toLowerCase();
    const s = (fShop || "").toLowerCase();
    const v = (fVideo || "").toLowerCase();

    return rowsGrouped
      .filter((r) => r.is_active !== false) // Only show active devices
      .map((r) => {
        // Extract images from layoutInfo
        const layout = layoutInfo[r.mobile_id];
        const images = [];
        if (layout?.config && Array.isArray(layout.config)) {
          layout.config.forEach((slot) => {
            if (slot.ad_name && slot.content_type === "image") {
              images.push(slot.ad_name);
            }
          });
        }
        return { ...r, images };
      })
      .filter((r) => !d || r.mobile_id.toLowerCase().includes(d))
      .filter((r) => !g || (r.gname || "").toLowerCase().includes(g))
      .filter((r) => !s || r.shop_name.toLowerCase().includes(s))
      .filter((r) => !v || r.videos.join(", ").toLowerCase().includes(v))
      // Sort by online status (online first)
      .sort((a, b) => {
        const aOnline = onlineStatus[a.mobile_id] === true ? 1 : 0;
        const bOnline = onlineStatus[b.mobile_id] === true ? 1 : 0;
        return bOnline - aOnline;
      });
  }, [rowsGrouped, fDevice, fGroup, fShop, fVideo, onlineStatus, layoutInfo]);

  // Count inactive devices
  const inactiveDeviceCount = useMemo(() => {
    return rowsGrouped.filter((r) => r.is_active === false).length;
  }, [rowsGrouped]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const uniqueDevices = new Set(rowsGrouped.map((r) => r.mobile_id));
    const uniqueGroups = new Set(rowsGrouped.map((r) => r.gname).filter(Boolean));
    const uniqueShops = new Set(rowsGrouped.map((r) => r.shop_name).filter(Boolean));
    const uniqueVideos = new Set(rowsGrouped.flatMap((r) => r.videos || []));

    let onlineCount = 0;
    let offlineCount = 0;
    let unassignedCount = 0;
    
    uniqueDevices.forEach((deviceId) => {
      if (onlineStatus[deviceId] === true) {
        onlineCount++;
      } else {
        offlineCount++;
      }
    });
    
    // Count unassigned devices
    rowsGrouped.forEach((r) => {
      if (r.gname === "Unassigned" || !r.gname) {
        unassignedCount++;
      }
    });

    // Temperature stats
    const temperatures = rowsGrouped
      .map((r) => r.temperature)
      .filter((t) => t != null && !isNaN(t));
    const avgTemp = temperatures.length > 0
      ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length
      : null;
    const minTemp = temperatures.length > 0 ? Math.min(...temperatures) : null;
    const maxTemp = temperatures.length > 0 ? Math.max(...temperatures) : null;

    // Daily and monthly counts
    const totalDailyCount = rowsGrouped.reduce((sum, r) => sum + (r.daily_count || 0), 0);
    const totalMonthlyCount = rowsGrouped.reduce((sum, r) => sum + (r.monthly_count || 0), 0);

    return {
      totalDevices: uniqueDevices.size,
      onlineDevices: onlineCount,
      offlineDevices: offlineCount,
      unassignedDevices: unassignedCount,
      totalGroups: uniqueGroups.size,
      totalShops: uniqueShops.size,
      totalVideos: uniqueVideos.size,
      totalLinks: rowsRaw.length,
      avgTemp,
      minTemp,
      maxTemp,
      totalDailyCount,
      totalMonthlyCount,
    };
  }, [rowsGrouped, rowsRaw, onlineStatus]);

  const clearFilters = () => {
    setFDevice("");
    setFGroup("");
    setFShop("");
    setFVideo("");
  };

  const deleteGroup = async (row) => {
    if (!row) return;
    const ok = window.confirm(
      `Delete all ${row.originals.length} link(s) for:\n\nDevice: ${row.mobile_id}\nGroup: ${row.gname}\nShop: ${row.shop_name}?`
    );
    if (!ok) return;

    try {
      setBusy(true);
      await Promise.all(row.originals.map((x) => deleteLink(x.id)));
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.detail || e.message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h2 style={styles.title}>
            📋 Recent Links <span style={styles.badge}>{rowsFiltered.length}</span>
          </h2>
          {loadedAt && (
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              Last updated: {loadedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
        <button onClick={load} disabled={busy} style={styles.btnPrimary}>
          {busy ? "⏳ Loading..." : "🔄 Reload"}
        </button>
      </div>

      {/* Summary Dashboard */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #f1f5f9",
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {/* Devices Online */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "14px 16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              borderLeft: "4px solid #10b981",
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
              ONLINE
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#10b981" }}>
              {summary.onlineDevices}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>devices</div>
          </div>

          {/* Devices Offline */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "14px 16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              borderLeft: "4px solid #ef4444",
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
              OFFLINE
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#ef4444" }}>
              {summary.offlineDevices}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>devices</div>
          </div>

          {/* Unassigned Devices */}
          {summary.unassignedDevices > 0 && (
            <div
              onClick={() => setFGroup("Unassigned")}
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: "14px 16px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                borderLeft: "4px solid #f59e0b",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              title="Click to filter unassigned devices"
            >
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
                ⚠️ UNASSIGNED
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>
                {summary.unassignedDevices}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>devices</div>
            </div>
          )}

          {/* Inactive Devices */}
          {inactiveDeviceCount > 0 && (
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: "14px 16px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                borderLeft: "4px solid #dc2626",
              }}
              title="Inactive devices are hidden from this list"
            >
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
                ⏸️ INACTIVE
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#dc2626" }}>
                {inactiveDeviceCount}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>devices</div>
            </div>
          )}

          {/* Total Devices */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "14px 16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              borderLeft: "4px solid #6366f1",
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
              TOTAL DEVICES
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#6366f1" }}>
              {summary.totalDevices}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>registered</div>
          </div>

          {/* Groups */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "14px 16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              borderLeft: "4px solid #0ea5e9",
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
              GROUPS
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0ea5e9" }}>
              {summary.totalGroups}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>active</div>
          </div>

          {/* Shops */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "14px 16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              borderLeft: "4px solid #a855f7",
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
              SHOPS
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#a855f7" }}>
              {summary.totalShops}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>locations</div>
          </div>

          {/* Videos */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "14px 16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              borderLeft: "4px solid #f59e0b",
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
              VIDEOS
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>
              {summary.totalVideos}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>assigned</div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #f1f5f9",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr) auto",
          gap: 12,
        }}
      >
        <input
          style={styles.input}
          placeholder="🔍 Device ID..."
          value={fDevice}
          onChange={(e) => setFDevice(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder="👥 Group..."
          value={fGroup}
          onChange={(e) => setFGroup(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder="🏪 Shop..."
          value={fShop}
          onChange={(e) => setFShop(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder="🎬 Video..."
          value={fVideo}
          onChange={(e) => setFVideo(e.target.value)}
        />
        <button onClick={clearFilters} style={styles.btn}>
          Clear
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Device</th>
              <th style={styles.th}>Group</th>
              <th style={styles.th}>Shop</th>
              <th style={styles.th}>Layout</th>
              <th style={styles.th}>Videos</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rowsFiltered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                  <div style={{ color: "#64748b", fontSize: 16 }}>No links found</div>
                </td>
              </tr>
            ) : (
              rowsFiltered.map((r) => (
                <tr key={r.key} style={{ transition: "background 0.2s" }}>
                  <td style={styles.td}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {r.device_name && (
                            <span style={{
                              fontWeight: 600,
                              fontSize: 13,
                              color: "#1e293b",
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }} title={r.device_name}>
                              {r.device_name}
                            </span>
                          )}
                          <code
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 500,
                              fontSize: 11,
                              color: r.device_name ? "#64748b" : "#1e293b",
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={r.mobile_id}
                          >
                            {r.mobile_id}
                          </code>
                        </div>
                        <button
                          onClick={() => setRenamingDevice({ mobile_id: r.mobile_id, device_name: r.device_name || "" })}
                          style={{
                            padding: "4px 6px",
                            borderRadius: 4,
                            border: "none",
                            background: "#f1f5f9",
                            color: "#64748b",
                            cursor: "pointer",
                            fontSize: 10,
                            flexShrink: 0,
                          }}
                          title="Rename device"
                        >
                          ✏️
                        </button>
                      </div>
                      <StatusDot isOnline={onlineStatus[r.mobile_id]} />
                      <DownloadProgressBadge progress={downloadProgress[r.mobile_id]} />
                    </div>
                  </td>

                  <td style={{ ...styles.td, verticalAlign: "middle" }}>
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: r.gname === "Unassigned" ? "#fef2f2" : "#f0f9ff",
                        color: r.gname === "Unassigned" ? "#dc2626" : "#0369a1",
                        fontWeight: 600,
                        fontSize: 13,
                        display: "inline-block",
                        maxWidth: 140,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={r.gname || "—"}
                    >
                      {r.gname === "Unassigned" ? "⚠️ Unassigned" : (r.gname || "—")}
                    </span>
                  </td>

                  <td style={{ ...styles.td, verticalAlign: "middle" }}>
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "#fdf4ff",
                        color: "#a21caf",
                        fontWeight: 600,
                        fontSize: 13,
                        display: "inline-block",
                        maxWidth: 140,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={r.shop_name || "—"}
                    >
                      {r.shop_name || "—"}
                    </span>
                  </td>

                  <td style={styles.td}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: layoutInfo[r.mobile_id]?.mode && layoutInfo[r.mobile_id]?.mode !== "single" ? "#dcfce7" : "#f1f5f9",
                          color: layoutInfo[r.mobile_id]?.mode && layoutInfo[r.mobile_id]?.mode !== "single" ? "#166534" : "#64748b",
                          fontWeight: 600,
                          fontSize: 12,
                          display: "inline-block",
                        }}
                      >
                        {layoutInfo[r.mobile_id]?.mode 
                          ? layoutInfo[r.mobile_id].mode.replace("_", " ").replace("split h", "2 Horizontal").replace("split v", "2 Vertical").replace("grid 3", "3 Grid").replace("grid 4", "2×2 Grid").replace("grid 1x4", "1×4 Grid")
                          : "Single"
                        }
                      </span>
                      {(() => {
                        // Get layout config for this device
                        const layoutData = layoutInfo[r.mobile_id];
                        const layout = layoutData?.mode || "single";
                        const config = Array.isArray(layoutData?.config) ? layoutData.config : [];
                        
                        const slotCounts = {
                          single: 1,
                          split_h: 2,
                          split_v: 2,
                          grid_3: 3,
                          grid_4: 4,
                          grid_1x4: 4,
                        };
                        const numSlots = slotCounts[layout] || 1;
                        
                        // Build slot info from layout_config
                        const slotInfo = [];
                        
                        // If we have valid config, use it exclusively
                        if (config.length > 0) {
                          for (let i = 0; i < numSlots; i++) {
                            const position = i + 1;
                            const configSlot = config.find(s => s.position === position);
                            
                            if (configSlot?.ad_name && configSlot?.content_type === "image") {
                              // Image slot
                              slotInfo.push({
                                type: "image",
                                name: configSlot.ad_name,
                                rotation: configSlot.rotation ?? 0,
                              });
                            } else if (configSlot?.video_name) {
                              // Video slot from config
                              slotInfo.push({
                                type: "video",
                                name: configSlot.video_name,
                                rotation: configSlot.rotation ?? 0,
                              });
                            } else {
                              // Empty slot in config
                              slotInfo.push({ type: "empty", name: null, rotation: 0 });
                            }
                          }
                        } else {
                          // No layout_config - fall back to originals sorted by grid_position
                          const sortedVideos = [...(r.originals || [])]
                            .sort((a, b) => (a.grid_position || 0) - (b.grid_position || 0));
                          
                          for (let i = 0; i < numSlots; i++) {
                            const video = sortedVideos[i];
                            if (video) {
                              slotInfo.push({
                                type: "video",
                                name: video.video_name,
                                rotation: video.device_rotation ?? video.rotation ?? 0,
                              });
                            } else {
                              slotInfo.push({ type: "empty", name: null, rotation: 0 });
                            }
                          }
                        }
                        
                        if (slotInfo.length === 0) return null;
                        
                        return (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {slotInfo.map((slot, idx) => {
                              const isImage = slot.type === "image";
                              const isEmpty = slot.type === "empty";
                              const prefix = isImage ? "🖼️" : "🎬";
                              // Truncate name to first 8 chars
                              const shortName = slot.name ? (slot.name.length > 8 ? slot.name.substring(0, 8) + "…" : slot.name) : "";
                              
                              return (
                                <span
                                  key={idx}
                                  style={{
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: isEmpty ? "#f1f5f9" : (isImage ? "#dcfce7" : (slot.rotation ? "#fef3c7" : "#dbeafe")),
                                    color: isEmpty ? "#9ca3af" : (isImage ? "#166534" : (slot.rotation ? "#92400e" : "#1e40af")),
                                    fontSize: 10,
                                    fontWeight: 500,
                                    maxWidth: 120,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={isEmpty ? `Slot ${idx + 1}: Empty` : `Slot ${idx + 1}: ${slot.name} (${slot.rotation}°)`}
                                >
                                  {isEmpty ? `S${idx + 1}: —` : `${prefix}${shortName} ${slot.rotation}°`}
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </td>

                  <td style={styles.td}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <VideoTags videos={r.videos} />
                      <MetricsCard
                        temperature={r.temperature}
                        daily={r.daily_count}
                        monthly={r.monthly_count}
                      />
                    </div>
                  </td>

                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button
                        style={styles.btnSuccess}
                        onClick={() => setPlayingRow(r)}
                        disabled={busy || !r.videos?.length}
                        title="Play videos"
                      >
                        ▶️ Play
                      </button>

                      <button
                        style={{ ...styles.btnInfo, background: "#8b5cf6" }}
                        onClick={() => setGridLayoutDevice(r)}
                        disabled={busy || !r.videos?.length}
                        title="Grid layout editor"
                      >
                        📐 Grid
                      </button>

                      <button
                        style={styles.btnWarning}
                        onClick={() => setReportDevice(r.mobile_id)}
                        title="Temperature report"
                      >
                        📊 Report
                      </button>

                      <button
                        style={styles.btnInfo}
                        onClick={() => setUptimeDevice(r.mobile_id)}
                        title="Uptime report"
                      >
                        ⏱️ Uptime
                      </button>

                      <button onClick={() => setEditing(r)} disabled={busy} style={styles.btn} title="Edit videos and images">
                        ✏️ Content
                      </button>

                      <button onClick={() => deleteGroup(r)} disabled={busy} style={styles.btnDanger}>
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {msg && (
        <div
          style={{
            margin: 16,
            padding: 14,
            borderRadius: 12,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontSize: 14,
          }}
        >
          ⚠️ {msg}
        </div>
      )}

      <EditContentModal
        open={!!editing}
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
      <VideoPlayerModal
        open={!!playingRow}
        onClose={() => setPlayingRow(null)}
        deviceId={playingRow?.mobile_id}
        videos={playingRow?.videos || []}
      />
      <TemperatureReportModal
        open={!!reportDevice}
        onClose={() => setReportDevice(null)}
        deviceId={reportDevice}
      />
      <UptimeReportModal
        open={!!uptimeDevice}
        onClose={() => setUptimeDevice(null)}
        deviceId={uptimeDevice}
      />
      <GridLayoutEditor
        open={!!gridLayoutDevice}
        onClose={() => setGridLayoutDevice(null)}
        deviceId={gridLayoutDevice?.mobile_id}
        videos={gridLayoutDevice?.originals || []}
        groupName={gridLayoutDevice?.gname}
        allGroupDevices={gridLayoutDevice?.gname 
          ? rowsGrouped.filter(r => r.gname === gridLayoutDevice.gname)
          : []
        }
        onSaved={() => {
          setGridLayoutDevice(null);
          setLayoutRefreshKey(k => k + 1); // Force layout info refresh
          load();
        }}
      />
      
      {/* Device Rename Modal */}
      {renamingDevice && (
        <DeviceRenameModal
          open={!!renamingDevice}
          mobile_id={renamingDevice.mobile_id}
          currentName={renamingDevice.device_name}
          onClose={() => setRenamingDevice(null)}
          onSaved={() => {
            setRenamingDevice(null);
            load();
          }}
        />
      )}
    </div>
  );
}
