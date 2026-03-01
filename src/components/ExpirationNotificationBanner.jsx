// src/components/ExpirationNotificationBanner.jsx
// Shows expiration warning banner and notifications to company users
// Features: 
// - Banner at top of page when company is expiring soon
// - Countdown timer
// - Bell icon with notification dropdown
// - Dismissable but reappears on login

import React, { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;

function authHeaders() {
  const token = localStorage.getItem("digix_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// ─── Countdown Timer Component ───
function CountdownTimer({ expiresAt, compact = false }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);
  
  useEffect(() => {
    if (!expiresAt) return;
    
    const updateTimer = () => {
      const now = new Date();
      const expires = new Date(expiresAt);
      const diff = expires - now;
      
      if (diff <= 0) {
        setExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      
      setExpired(false);
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      });
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);
  
  if (!expiresAt) return null;
  
  if (expired) {
    return (
      <span style={{ 
        color: "#dc2626", 
        fontWeight: 700,
        fontSize: compact ? 12 : 16
      }}>
        EXPIRED
      </span>
    );
  }
  
  const { days, hours, minutes, seconds } = timeLeft;
  
  if (compact) {
    return (
      <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 12 }}>
        {days > 0 && `${days}d `}{hours}h {minutes}m
      </span>
    );
  }
  
  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
      {days > 0 && (
        <TimeUnit value={days} label="Days" />
      )}
      <TimeUnit value={hours} label="Hours" />
      <TimeUnit value={minutes} label="Minutes" />
      <TimeUnit value={seconds} label="Seconds" />
    </div>
  );
}

function TimeUnit({ value, label }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ 
        fontSize: 28, 
        fontWeight: 700, 
        fontFamily: "monospace",
        background: "rgba(0,0,0,0.2)",
        padding: "8px 12px",
        borderRadius: 8,
        minWidth: 50
      }}>
        {String(value).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 10, marginTop: 4, textTransform: "uppercase", opacity: 0.8 }}>
        {label}
      </div>
    </div>
  );
}

// ─── Expiration Warning Banner ───
export function ExpirationBanner({ companyStatus, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);
  
  // Don't show if no expiration info
  if (!companyStatus || !companyStatus.expires_at) return null;
  
  // Don't show if dismissed this session
  const dismissKey = `expiration_dismissed_${new Date().toDateString()}`;
  if (dismissed || sessionStorage.getItem(dismissKey)) return null;
  
  const { expires_at, expiration_status, days_until_expiration, grace_period_days } = companyStatus;
  
  // Only show if expiring within 30 days or already expired/grace
  if (expiration_status === 'active' && days_until_expiration > 30) return null;
  
  // Determine severity and styling
  let bgColor, textColor, borderColor, icon, message;
  
  if (expiration_status === 'expired') {
    bgColor = "#dc2626";
    textColor = "#fff";
    borderColor = "#b91c1c";
    icon = "🚫";
    message = "Your subscription has expired. Please contact support to renew.";
  } else if (expiration_status === 'suspended') {
    bgColor = "#7f1d1d";
    textColor = "#fff";
    borderColor = "#450a0a";
    icon = "⛔";
    message = "Your account has been suspended. Please contact support.";
  } else if (expiration_status === 'grace_period') {
    bgColor = "#f59e0b";
    textColor = "#0a1628";
    borderColor = "#d97706";
    icon = "⏳";
    message = `Grace period active. You have ${grace_period_days} days to renew before full suspension.`;
  } else if (days_until_expiration <= 7) {
    bgColor = "#fef2f2";
    textColor = "#dc2626";
    borderColor = "#fecaca";
    icon = "🔴";
    message = `Your subscription expires in ${days_until_expiration} days. Please renew soon!`;
  } else if (days_until_expiration <= 14) {
    bgColor = "#fef3c7";
    textColor = "#92400e";
    borderColor = "#fcd34d";
    icon = "🟡";
    message = `Your subscription expires in ${days_until_expiration} days.`;
  } else {
    bgColor = "#f0fdf4";
    textColor = "#166534";
    borderColor = "#86efac";
    icon = "🟢";
    message = `Your subscription expires in ${days_until_expiration} days.`;
  }
  
  const handleDismiss = () => {
    sessionStorage.setItem(dismissKey, "true");
    setDismissed(true);
    if (onDismiss) onDismiss();
  };
  
  return (
    <div style={{
      background: bgColor,
      color: textColor,
      padding: "12px 20px",
      borderBottom: `2px solid ${borderColor}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: 14,
      position: "relative"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div>
          <strong>{message}</strong>
          {expires_at && expiration_status !== 'expired' && expiration_status !== 'suspended' && (
            <span style={{ marginLeft: 12, opacity: 0.8 }}>
              Expires: {new Date(expires_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {expires_at && expiration_status !== 'expired' && expiration_status !== 'suspended' && (
          <CountdownTimer expiresAt={expires_at} compact />
        )}
        <button
          onClick={handleDismiss}
          style={{
            background: "transparent",
            border: "none",
            color: textColor,
            cursor: "pointer",
            fontSize: 18,
            padding: 4,
            opacity: 0.7
          }}
          title="Dismiss for today"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Notification Bell Component ───
export function NotificationBell({ companyStatus }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);
  
  useEffect(() => {
    if (!companyStatus) return;
    
    const notifs = [];
    const { expires_at, expiration_status, days_until_expiration } = companyStatus;
    
    if (expiration_status === 'expired') {
      notifs.push({
        type: 'error',
        title: 'Subscription Expired',
        message: 'Your subscription has expired. Please contact support to renew.',
        time: 'Now'
      });
    } else if (expiration_status === 'suspended') {
      notifs.push({
        type: 'error',
        title: 'Account Suspended',
        message: 'Your account has been suspended. Please contact support.',
        time: 'Now'
      });
    } else if (expiration_status === 'grace_period') {
      notifs.push({
        type: 'warning',
        title: 'Grace Period Active',
        message: 'Your subscription is in grace period. Renew soon to avoid suspension.',
        time: 'Active'
      });
    } else if (expires_at && days_until_expiration <= 30) {
      notifs.push({
        type: days_until_expiration <= 7 ? 'warning' : 'info',
        title: 'Subscription Expiring Soon',
        message: `Your subscription expires in ${days_until_expiration} days on ${new Date(expires_at).toLocaleDateString()}.`,
        time: `${days_until_expiration} days`
      });
    }
    
    setNotifications(notifs);
  }, [companyStatus]);
  
  const hasUrgent = notifications.some(n => n.type === 'error' || n.type === 'warning');
  
  if (notifications.length === 0) {
    return (
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 20,
            padding: 8,
            borderRadius: 8,
            color: "#6b7280"
          }}
        >
          🔔
        </button>
      </div>
    );
  }
  
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 20,
          padding: 8,
          borderRadius: 8,
          position: "relative"
        }}
      >
        🔔
        {notifications.length > 0 && (
          <span style={{
            position: "absolute",
            top: 4,
            right: 4,
            background: hasUrgent ? "#dc2626" : "#f59e0b",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            borderRadius: "50%",
            width: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: hasUrgent ? "pulse 2s infinite" : "none"
          }}>
            {notifications.length}
          </span>
        )}
      </button>
      
      {showDropdown && (
        <>
          <div 
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onClick={() => setShowDropdown(false)}
          />
          <div style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
            width: 320,
            maxHeight: 400,
            overflow: "auto",
            zIndex: 100,
            border: "1px solid #e5e7eb"
          }}>
            <div style={{ 
              padding: "12px 16px", 
              borderBottom: "1px solid #e5e7eb",
              fontWeight: 600,
              fontSize: 14,
              color: "#0a1628"
            }}>
              Notifications
            </div>
            
            {notifications.map((n, i) => (
              <div 
                key={i}
                style={{
                  padding: 16,
                  borderBottom: i < notifications.length - 1 ? "1px solid #f3f4f6" : "none",
                  background: n.type === 'error' ? "#fef2f2" : n.type === 'warning' ? "#fef3c7" : "#fff"
                }}
              >
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 4
                }}>
                  <div style={{ 
                    fontWeight: 600, 
                    fontSize: 13,
                    color: n.type === 'error' ? "#dc2626" : n.type === 'warning' ? "#92400e" : "#0a1628"
                  }}>
                    {n.type === 'error' && "🔴 "}
                    {n.type === 'warning' && "🟡 "}
                    {n.type === 'info' && "🔵 "}
                    {n.title}
                  </div>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{n.time}</span>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>
                  {n.message}
                </div>
              </div>
            ))}
            
            <div style={{ 
              padding: 12, 
              textAlign: "center", 
              borderTop: "1px solid #e5e7eb",
              fontSize: 12,
              color: "#6b7280"
            }}>
              Contact support to renew your subscription
            </div>
          </div>
        </>
      )}
      
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

// ─── Company Status Timer Widget ───
export function CompanyStatusTimer({ companyStatus }) {
  if (!companyStatus || !companyStatus.expires_at) {
    return null;
  }
  
  const { expires_at, expiration_status, days_until_expiration } = companyStatus;
  
  // Determine color based on days remaining
  let color;
  if (expiration_status === 'expired' || expiration_status === 'suspended') {
    color = "#dc2626";
  } else if (expiration_status === 'grace_period' || days_until_expiration <= 7) {
    color = "#dc2626";
  } else if (days_until_expiration <= 30) {
    color = "#f59e0b";
  } else {
    color = "#16a34a";
  }
  
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px",
      background: "#f9fafb",
      borderRadius: 8,
      border: `1px solid ${color}30`
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color
      }} />
      <div style={{ fontSize: 12 }}>
        <span style={{ color: "#6b7280" }}>Expires: </span>
        <CountdownTimer expiresAt={expires_at} compact />
      </div>
    </div>
  );
}

// ─── Hook to fetch company status ───
export function useCompanyStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/platform/my-company`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setStatus({
          expires_at: data.expires_at,
          expiration_status: data.expiration_status || 'active',
          days_until_expiration: data.days_until_expiration,
          grace_period_days: data.grace_period_days || 7
        });
      }
    } catch (err) {
      console.error("Failed to fetch company status:", err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);
  
  return { status, loading, refetch: fetchStatus };
}

// ─── Main Export: Wrapper for App.js ───
export default function ExpirationNotifications({ children }) {
  const { status, loading } = useCompanyStatus();
  
  // Get user type from localStorage
  const userStr = localStorage.getItem("digix_user");
  const user = userStr ? JSON.parse(userStr) : null;
  
  // Only show for company users, not platform users
  if (!user || user.user_type === 'platform') {
    return children;
  }
  
  return (
    <div>
      {!loading && <ExpirationBanner companyStatus={status} />}
      {children}
    </div>
  );
}
