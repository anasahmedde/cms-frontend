// src/components/GlobalAnnouncementBanner.jsx
// Displays platform-wide announcements to ALL logged-in users
// Now with WebSocket support for real-time updates!

import React, { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;
const WS_BASE = process.env.REACT_APP_WS_BASE_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8005`;

function authHeaders() {
  const token = localStorage.getItem("digix_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function GlobalAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const fetchAnnouncement = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/announcement/active`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.announcement) {
          const dismissedId = sessionStorage.getItem("dismissed_announcement_id");
          if (dismissedId === String(data.announcement.id)) {
            setDismissed(true);
          } else {
            setDismissed(false);
            setAnnouncement(data.announcement);
          }
        } else {
          setAnnouncement(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch announcement:", err);
    }
  }, []);

  // WebSocket connection for real-time announcements
  const connectWebSocket = useCallback(() => {
    const token = localStorage.getItem("digix_token");
    if (!token) return;

    // Close existing connection if any
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(`${WS_BASE}/ws/devices?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Announcement WS] Connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle announcement messages
          if (data.type === "announcement") {
            console.log("[Announcement WS] New announcement received:", data.data);
            const newAnnouncement = data.data;
            const dismissedId = sessionStorage.getItem("dismissed_announcement_id");
            if (dismissedId !== String(newAnnouncement.id)) {
              setDismissed(false);
              setAnnouncement(newAnnouncement);
            }
          } else if (data.type === "announcement_cleared") {
            console.log("[Announcement WS] Announcement cleared");
            setAnnouncement(null);
            setDismissed(false);
            sessionStorage.removeItem("dismissed_announcement_id");
          }
        } catch (err) {
          // Ignore non-JSON messages or other message types
        }
      };

      ws.onclose = () => {
        console.log("[Announcement WS] Disconnected, will reconnect...");
        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (err) => {
        console.error("[Announcement WS] Error:", err);
      };
    } catch (err) {
      console.error("[Announcement WS] Connection error:", err);
    }
  }, []);

  useEffect(() => {
    // Fetch immediately on mount
    fetchAnnouncement();
    
    // Connect to WebSocket for real-time updates
    connectWebSocket();
    
    // Fallback: Poll every 60 seconds in case WebSocket fails
    const interval = setInterval(fetchAnnouncement, 60000);
    
    return () => {
      clearInterval(interval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [fetchAnnouncement, connectWebSocket]);

  const handleDismiss = () => {
    if (announcement) {
      sessionStorage.setItem("dismissed_announcement_id", String(announcement.id));
    }
    setDismissed(true);
  };

  // Don't show if no announcement or dismissed
  if (!announcement || dismissed) return null;

  const typeColors = {
    info: { bg: "linear-gradient(90deg, #3b82f6, #1d4ed8)", text: "#fff" },
    warning: { bg: "linear-gradient(90deg, #f59e0b, #d97706)", text: "#0a1628" },
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
