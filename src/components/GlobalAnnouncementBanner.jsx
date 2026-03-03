// src/components/GlobalAnnouncementBanner.jsx
// Displays platform-wide announcements to ALL logged-in users
// Real-time via WebSocket (with graceful fallback) + 10s polling
// Dismiss re-shows after 15 minutes automatically

import React, { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8005`;

// WebSocket base: use same host/protocol as API, no hardcoded port
const WS_BASE = process.env.REACT_APP_WS_BASE_URL || (() => {
  const apiUrl = process.env.REACT_APP_API_BASE_URL;
  if (apiUrl) {
    return apiUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  }
  const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${window.location.hostname}:8005`;
})();

const REDISMISS_DELAY_MS = 20 * 1000; // 20 seconds

function authHeaders() {
  const token = localStorage.getItem("digix_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

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
      fontSize: 11, fontWeight: 600, opacity: 0.85, marginLeft: 10,
      fontFamily: "monospace", background: "rgba(0,0,0,0.15)",
      padding: "2px 7px", borderRadius: 4, flexShrink: 0,
    }}>
      ⏱ {label}
    </span>
  );
}

export default function GlobalAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState(null);
  // dismissedUntil: timestamp (ms) until which this announcement is hidden, or 0
  const [dismissedUntil, setDismissedUntil] = useState(0);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const wsFailedRef = useRef(false); // stop retrying if WS consistently fails

  // ── Restore dismiss state from sessionStorage on mount ──
  useEffect(() => {
    // Scan sessionStorage for any active dismiss
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("dismissed_announcement_")) {
        const ts = parseInt(sessionStorage.getItem(key) || "0", 10);
        const until = ts + REDISMISS_DELAY_MS;
        if (until > Date.now()) {
          setDismissedUntil(until);
        } else {
          sessionStorage.removeItem(key);
        }
      }
    }
  }, []);

  // ── Timer: when dismissedUntil passes, clear it so banner re-shows ──
  useEffect(() => {
    if (!dismissedUntil) return;
    const remaining = dismissedUntil - Date.now();
    if (remaining <= 0) { setDismissedUntil(0); return; }
    const t = setTimeout(() => setDismissedUntil(0), remaining);
    return () => clearTimeout(t);
  }, [dismissedUntil]);

  // ── Auto-expire: hide when announcement's own expires_at passes ──
  useEffect(() => {
    if (!announcement?.expires_at) return;
    const ms = new Date(announcement.expires_at) - Date.now();
    if (ms <= 0) { setAnnouncement(null); return; }
    const t = setTimeout(() => setAnnouncement(null), ms);
    return () => clearTimeout(t);
  }, [announcement?.expires_at]);

  // ── Fetch from REST API ──
  const fetchAnnouncement = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/announcement/active`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAnnouncement(data.announcement || null);
      }
    } catch (_) {}
  }, []);

  // ── WebSocket for instant updates ──
  const connectWebSocket = useCallback(() => {
    if (wsFailedRef.current) return; // give up after repeated failures
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
            setAnnouncement(data.data);
            // Clear any stale dismiss for a brand-new announcement
            if (data.data?.id) {
              const key = `dismissed_announcement_${data.data.id}`;
              if (!sessionStorage.getItem(key)) setDismissedUntil(0);
            }
          } else if (data.type === "announcement_cleared") {
            setAnnouncement(null);
          }
        } catch (_) {}
      };

      let failCount = 0;
      ws.onerror = () => { failCount++; };
      ws.onclose = () => {
        if (failCount >= 3) {
          wsFailedRef.current = true; // stop reconnecting, rely on polling
          return;
        }
        // Reconnect after 5s
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      };
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchAnnouncement();
    connectWebSocket();
    // 10s fallback poll — works even when WebSocket is unavailable
    const interval = setInterval(fetchAnnouncement, 10000);
    return () => {
      clearInterval(interval);
      clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [fetchAnnouncement, connectWebSocket]);

  const handleDismiss = () => {
    if (!announcement) return;
    const key = `dismissed_announcement_${announcement.id}`;
    const now = Date.now();
    sessionStorage.setItem(key, String(now));
    setDismissedUntil(now + REDISMISS_DELAY_MS);
  };

  // Hide if no announcement, or currently dismissed
  const isDismissed = dismissedUntil > Date.now();
  if (!announcement || isDismissed) return null;

  const typeColors = {
    info:     { bg: "linear-gradient(90deg, #3b82f6, #1d4ed8)", text: "#fff" },
    warning:  { bg: "linear-gradient(90deg, #f59e0b, #d97706)", text: "#0a1628" },
    critical: { bg: "linear-gradient(90deg, #dc2626, #b91c1c)", text: "#fff" },
  };
  const c = typeColors[announcement.type] || typeColors.info;

  return (
    <div style={{
      background: c.bg, padding: "12px 20px", overflow: "hidden",
      position: "relative", display: "flex", alignItems: "center", zIndex: 100,
    }}>
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{
          display: "inline-flex",
          animation: "slideTextGlobal 30s linear infinite",
          whiteSpace: "nowrap", color: c.text, fontWeight: 600, fontSize: 14,
          willChange: "transform",
        }}>
          {/* Two identical copies — when the first scrolls out, the second seamlessly takes over */}
          <span style={{ paddingRight: 80 }}>📢 &nbsp;{announcement.message}</span>
          <span style={{ paddingRight: 80 }}>📢 &nbsp;{announcement.message}</span>
        </div>
      </div>

      <AnnouncementCountdown expiresAt={announcement.expires_at} />

      <button
        onClick={handleDismiss}
        title="Dismiss — will reappear in 20 seconds"
        style={{
          background: "rgba(255,255,255,0.2)", border: "none", color: c.text,
          padding: "4px 10px", borderRadius: 6, cursor: "pointer",
          marginLeft: 12, fontSize: 12, fontWeight: 600, flexShrink: 0
        }}
      >
        Dismiss
      </button>
      <style>{`
        @keyframes slideTextGlobal {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
