// src/components/GlobalAnnouncementBanner.jsx
// Displays platform-wide announcements to ALL logged-in users
// Fetches from backend API, not localStorage

import React, { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;

function authHeaders() {
  const token = localStorage.getItem("digix_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function GlobalAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const fetchAnnouncement = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/announcement/active`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.announcement) {
          // Check if user dismissed this specific announcement in this session
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

  useEffect(() => {
    // Fetch immediately
    fetchAnnouncement();
    
    // Poll every 60 seconds for new announcements
    const interval = setInterval(fetchAnnouncement, 60000);
    return () => clearInterval(interval);
  }, [fetchAnnouncement]);

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
