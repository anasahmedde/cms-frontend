// Route-change + session telemetry (ports the old App.js /track/* semantics
// onto react-router). Fire-and-forget by design: the backend swallows tracking
// failures and so do we — telemetry must never affect UX.
//
// NOTE: payload field names match the backend's PageTrackIn model exactly
// (page, session_id, prev_page, prev_duration_sec) — API payloads must not
// change during the revamp.
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { apiPost, getToken } from "./api";
import { API_BASE_URL } from "./config";

const SESSION_KEY = "digix_session_id";

function sessionId() {
  const raw = localStorage.getItem(SESSION_KEY);
  const n = Number(raw);
  return raw != null && raw !== "" && Number.isFinite(n) ? n : null;
}

export default function usePageTracking() {
  const { pathname } = useLocation();
  const prevRef = useRef({ page: null, since: Date.now() });

  // Page visits: report the new page plus how long the previous one was open.
  useEffect(() => {
    const prev = prevRef.current;
    const body = { page: pathname, session_id: sessionId() };
    if (prev.page && prev.page !== pathname) {
      body.prev_page = prev.page;
      body.prev_duration_sec = Math.max(0, Math.round((Date.now() - prev.since) / 1000));
    }
    prevRef.current = { page: pathname, since: Date.now() };
    apiPost("/track/page", body).catch(() => {});
  }, [pathname]);

  // Session heartbeat: immediately on mount, then every 60s.
  useEffect(() => {
    const beat = () => apiPost("/track/heartbeat", { session_id: sessionId() }).catch(() => {});
    beat();
    const id = setInterval(beat, 60000);
    return () => clearInterval(id);
  }, []);

  // Tab close: keepalive fetch (axios requests don't survive page unload).
  useEffect(() => {
    const onUnload = () => {
      try {
        fetch(`${API_BASE_URL}/track/unload`, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ session_id: sessionId() }),
        }).catch(() => {});
      } catch {
        /* never block unload */
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);
}
