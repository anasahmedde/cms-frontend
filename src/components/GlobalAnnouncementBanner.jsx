// src/components/GlobalAnnouncementBanner.jsx
// Displays platform-wide announcements to ALL logged-in users
// Real-time via WebSocket + 10s fallback polling
// Dismiss re-shows after 15 minutes

import React, { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;
const WS_BASE = process.env.REACT_APP_WS_BASE_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8005`;
const REDISMISS_DELAY_MS = 15 * 60 * 1000; // 15 minutes

function authHeaders() {
  const token = localStorage.getItem("digix_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// Format seconds into "Xh Ym Zs" or "Ym Zs" or "Zs"
function formatTimeLeft(seconds) {
  if (seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function AnnouncementCountdown({ expiresAt }) {
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = Math.floor((new Date(expiresAt) - Date.now()) / 1000);
      setSecondsLeft(diff > 0 ? diff : 0);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (!expiresAt || secondsLeft === null || secondsLeft <= 0) return null;
  const label = formatTimeLeft(secondsLeft);
  if (!label) return null;

  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      opacity: 0.85,
      marginLeft: 10,
      fontFamily: "monospace",
      background: "rgba(0,0,0,0.15)",
      padding: "2px 7px",
      borderRadius: 4,
      flexShrink: 0,
    }}>
      ⏱ {label}
    </span>
  );
}

export default function GlobalAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const redismissTimerRef = useRef(null);

  // Check if this announcement was dismissed and if the 15-min window has passed
  const isDismissed = useCallback((id) => {
    const key = `dismissed_announcement_${id}`;
    const ts = sessionStorage.getItem(key);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < REDISMISS_DELAY_MS;
  }, []);

  const applyAnnouncement = useCallback((ann) => {
    if (!ann) { setAnnouncement(null); setDismissed(false); return; }
    if (isDismissed(ann.id)) {
      setDismissed(true);
      setAnnouncement(ann);
      // Schedule re-show when the 15-min window expires
      const key = `dismissed_announcement_${ann.id}`;
      const ts = parseInt(sessionStorage.getItem(key) || "0", 10);
      const remaining = REDISMISS_DELAY_MS - (Date.now() - ts);
      if (remaining > 0) {
        clearTimeout(redismissTimerRef.current);
        redismissTimerRef.current = setTimeout(() => {
          setDismissed(false);
        }, remaining);
      }
    } else {
      setDismissed(false);
      setAnnouncement(ann);
    }
  }, [isDismissed]);

  const fetchAnnouncement = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/announcement/active`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        applyAnnouncement(data.announcement || null);
      }
    } catch (err) {
      console.error("Failed to fetch announcement:", err);
    }
  }, [applyAnnouncement]);

  // WebSocket connection for real-time announcements
  const connectWebSocket = useCallback(() => {
    const token = localStorage.getItem("digix_token");
    if (!token) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(`${WS_BASE}/ws/devices?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "announcement") {
            applyAnnouncement(data.data);
          } else if (data.type === "announcement_cleared") {
            setAnnouncement(null);
            setDismissed(false);
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      };
    } catch (err) {
      console.error("[Announcement WS] Connection error:", err);
    }
  }, [applyAnnouncement]);

  useEffect(() => {
    fetchAnnouncement();
    connectWebSocket();
    // 10s fallback poll in case WebSocket is unavailable
    const interval = setInterval(fetchAnnouncement, 10000);
    return () => {
      clearInterval(interval);
      clearTimeout(reconnectTimeoutRef.current);
      clearTimeout(redismissTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [fetchAnnouncement, connectWebSocket]);

  // Auto-expire: hide when expires_at passes
  useEffect(() => {
    if (!announcement?.expires_at) return;
    const ms = new Date(announcement.expires_at) - Date.now();
    if (ms <= 0) { setAnnouncement(null); return; }
    const t = setTimeout(() => setAnnouncement(null), ms);
    return () => clearTimeout(t);
  }, [announcement?.expires_at]);

  const handleDismiss = () => {
    if (announcement) {
      sessionStorage.setItem(`dismissed_announcement_${announcement.id}`, String(Date.now()));
      // Re-show after 15 minutes
      clearTimeout(redismissTimerRef.current);
      redismissTimerRef.current = setTimeout(() => setDismissed(false), REDISMISS_DELAY_MS);
    }
    setDismissed(true);
  };

  if (!announcement || dismissed) return null;

  const typeColors = {
    info:     { bg: "linear-gradient(90deg, #3b82f6, #1d4ed8)", text: "#fff" },
    warning:  { bg: "linear-gradient(90deg, #f59e0b, #d97706)", text: "#0a1628" },
    critical: { bg: "linear-gradient(90deg, #dc2626, #b91c1c)", text: "#fff" },
  };
  const c = typeColors[announcement.type] || typeColors.info;

  return (
    <div style={{
      background: c.bg,
      padding: "12px 20px",
      overflow: "hidden",
      position: "relative",
      display: "flex",
      alignItems: "center",
      zIndex: 100,
    }}>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{
          display: "inline-block",
          animation: "slideTextGlobal 25s linear infinite",
          whiteSpace: "nowrap",
          color: c.text,
          fontWeight: 600,
          fontSize: 14,
          paddingLeft: "100%"
        }}>
          📢 {announcement.message} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 📢 {announcement.message}
        </div>
      </div>

      {/* Countdown until announcement expires */}
      <AnnouncementCountdown expiresAt={announcement.expires_at} />

      <button
        onClick={handleDismiss}
        style={{
          background: "rgba(255,255,255,0.2)",
          border: "none",
          color: c.text,
          padding: "4px 10px",
          borderRadius: 6,
          cursor: "pointer",
          marginLeft: 12,
          fontSize: 12,
          fontWeight: 600,
          flexShrink: 0
        }}
      >
        Dismiss
      </button>
      <style>{`
        @keyframes slideTextGlobal {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
