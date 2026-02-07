// src/components/GroupLinkedVideo.js - Enhanced UI with Videos and Advertisements
import React, { useEffect, useMemo, useState } from "react";
import { listVideoNames } from "../api/video";
import { listGroupNames } from "../api/group";
import { setGroupVideosByNames, listGroupVideoNames } from "../api/dvsg";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;

const NO_GROUP_LABEL = "— No group —";
const NO_GROUP_VALUE = "_none";

// Helper to ensure we get an array
function ensureArray(data) {
  if (Array.isArray(data)) return data;
  if (data?.items) return data.items;
  if (data?.data) return data.data;
  return [];
}

export default function GroupLinkedVideo({ onDone }) {
  const [groups, setGroups] = useState([]);
  const [videos, setVideos] = useState([]);
  const [advertisements, setAdvertisements] = useState([]);
  const [gname, setGname] = useState("");

  // Content type tab
  const [contentType, setContentType] = useState("video"); // "video" or "advertisement"

  const [typedVideo, setTypedVideo] = useState("");
  const [selectedVideos, setSelectedVideos] = useState([]);

  const [typedAd, setTypedAd] = useState("");
  const [selectedAds, setSelectedAds] = useState([]);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Load groups, videos, and advertisements
  useEffect(() => {
    (async () => {
      setInitialLoading(true);
      try {
        const [gnResult, vnResult, adResult] = await Promise.all([
          listGroupNames().catch((e) => { console.error("listGroupNames error:", e); return []; }),
          listVideoNames().catch((e) => { console.error("listVideoNames error:", e); return []; }),
          axios.get(`${API_BASE}/advertisement_names`).then(r => r.data).catch((e) => { console.error("listAdNames error:", e); return []; }),
        ]);
        
        let groupNames = ensureArray(gnResult);
        let videoNames = ensureArray(vnResult);
        let adNames = ensureArray(adResult);
        
        if (groupNames.length > 0 && typeof groupNames[0] === "object") {
          groupNames = groupNames.map(g => g.gname || g.name || String(g)).filter(Boolean);
        }
        if (videoNames.length > 0 && typeof videoNames[0] === "object") {
          videoNames = videoNames.map(v => v.video_name || v.name || String(v)).filter(Boolean);
        }
        
        const uniqGroups = Array.from(new Set(groupNames));
        setGroups(uniqGroups);
        setVideos(videoNames);
        setAdvertisements(adNames);
      } catch (e) {
        console.error("Failed to load lists:", e);
        setMessage("Failed to load groups/videos/advertisements");
      } finally {
        setInitialLoading(false);
      }
    })();
  }, []);

  const gvalue = useMemo(() => {
    if (!gname) return "";
    return gname === NO_GROUP_LABEL ? NO_GROUP_VALUE : gname;
  }, [gname]);

  // When group changes, fetch current videos and advertisements
  useEffect(() => {
    if (!gvalue) {
      setSelectedVideos([]);
      setSelectedAds([]);
      return;
    }
    (async () => {
      setMessage("Loading content for this group...");
      try {
        // Fetch videos
        const videoRes = await listGroupVideoNames(gvalue);
        const videoNames = videoRes?.data?.video_names || videoRes?.video_names || ensureArray(videoRes);
        setSelectedVideos(Array.isArray(videoNames) ? videoNames : []);
        
        // Fetch advertisements
        try {
          const adRes = await axios.get(`${API_BASE}/group/${encodeURIComponent(gvalue)}/advertisements`);
          const adNames = adRes?.data?.ad_names || [];
          setSelectedAds(Array.isArray(adNames) ? adNames : []);
        } catch (adErr) {
          console.log("No advertisements linked or endpoint not ready:", adErr);
          setSelectedAds([]);
        }
        
        const hasContent = (Array.isArray(videoNames) && videoNames.length > 0);
        setMessage(hasContent ? "" : "No content linked yet. Add videos or images below!");
      } catch (e) {
        console.error("Failed to load group content:", e);
        setSelectedVideos([]);
        setSelectedAds([]);
        setMessage("No content linked yet. Add videos or images below!");
      }
    })();
  }, [gvalue]);

  const addVideo = () => {
    const v = (typedVideo || "").trim();
    if (!v) return;
    if (!videos.includes(v)) {
      setMessage(`"${v}" is not in the video list.`);
      return;
    }
    if (!selectedVideos.includes(v)) {
      setSelectedVideos((s) => [...s, v]);
      setMessage("");
    }
    setTypedVideo("");
  };

  const addAd = () => {
    const a = (typedAd || "").trim();
    if (!a) return;
    if (!advertisements.includes(a)) {
      setMessage(`"${a}" is not in the advertisement list.`);
      return;
    }
    if (!selectedAds.includes(a)) {
      setSelectedAds((s) => [...s, a]);
      setMessage("");
    }
    setTypedAd("");
  };

  const removeVideo = (name) => setSelectedVideos((s) => s.filter((x) => x !== name));
  const removeAd = (name) => setSelectedAds((s) => s.filter((x) => x !== name));
  const clearVideos = () => setSelectedVideos([]);
  const clearAds = () => setSelectedAds([]);

  const canSubmit = gvalue && (selectedVideos.length > 0 || selectedAds.length > 0) && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setMessage("");
    
    let videoMsg = "";
    let adMsg = "";
    
    try {
      // Link videos if any selected
      if (selectedVideos.length > 0) {
        const res = await setGroupVideosByNames(gvalue, selectedVideos);
        const data = res?.data || res || {};
        const okInserted = data.inserted_count ?? 0;
        const okUpdated = data.updated_count ?? 0;
        const okDeleted = data.deleted_count ?? 0;
        videoMsg = `Linked ${selectedVideos.length} video(s) (+${okInserted} new, -${okDeleted} removed)`;
      }
      
      // Link advertisements if any selected
      if (selectedAds.length > 0) {
        const adRes = await axios.post(`${API_BASE}/group/${encodeURIComponent(gvalue)}/advertisements`, {
          ad_names: selectedAds
        });
        const adData = adRes?.data || {};
        const adInserted = adData.inserted_count ?? 0;
        const adDeleted = adData.deleted_count ?? 0;
        adMsg = `Linked ${selectedAds.length} image(s) (+${adInserted} new, -${adDeleted} removed)`;
      }
      
      // Combine messages
      const combinedMsg = [videoMsg, adMsg].filter(Boolean).join(". ");
      setMessage(`✅ ${combinedMsg}`);
      
      onDone && onDone({ gname: gvalue, videos: selectedVideos, advertisements: selectedAds });
    } catch (e) {
      const err = e?.response?.data?.detail || e?.message || "Update failed.";
      setMessage(`❌ ${err}`);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 16 }}>
        <div style={{ width: 48, height: 48, border: "4px solid #e5e7eb", borderTopColor: "#667eea", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <p style={{ margin: 0, color: "#64748b" }}>Loading groups, videos and advertisements...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const inputStyle = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "2px solid #e5e7eb",
    fontSize: 15,
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Group Selection */}
      <div>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151", fontSize: 14 }}>
          Select Group
          <span style={{ marginLeft: 8, fontWeight: 400, color: "#9ca3af", fontSize: 13 }}>({groups.length} available)</span>
        </label>
        <select
          value={gname}
          onChange={(e) => setGname(e.target.value)}
          style={{
            ...inputStyle,
            cursor: "pointer",
            appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
            backgroundSize: "20px",
          }}
        >
          <option value="">-- Select a group --</option>
          <option value={NO_GROUP_LABEL}>{NO_GROUP_LABEL}</option>
          {groups.map((label) => (<option key={label} value={label}>{label}</option>))}
        </select>
        {groups.length === 0 && (
          <p style={{ marginTop: 8, fontSize: 13, color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
            <span>⚠️</span> No groups found. Create groups first!
          </p>
        )}
      </div>

      {/* Content Type Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", paddingBottom: 0 }}>
        <button
          onClick={() => setContentType("video")}
          style={{
            padding: "12px 20px",
            border: "none",
            background: contentType === "video" ? "#667eea" : "transparent",
            color: contentType === "video" ? "#fff" : "#6b7280",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            borderRadius: "8px 8px 0 0",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          🎬 Videos ({videos.length})
        </button>
        <button
          onClick={() => setContentType("advertisement")}
          style={{
            padding: "12px 20px",
            border: "none",
            background: contentType === "advertisement" ? "#10b981" : "transparent",
            color: contentType === "advertisement" ? "#fff" : "#6b7280",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            borderRadius: "8px 8px 0 0",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          🖼️ Advertisements ({advertisements.length})
        </button>
      </div>

      {/* Video Selection */}
      {contentType === "video" && (
        <div>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151", fontSize: 14 }}>
            Videos
            <span style={{ marginLeft: 8, fontWeight: 400, color: "#9ca3af", fontSize: 13 }}>
              ({videos.length} available, {selectedVideos.length} selected)
            </span>
          </label>
          <div style={{ minHeight: 60, padding: 12, borderRadius: 12, border: "2px solid #e5e7eb", background: "#fafafa", display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {selectedVideos.length === 0 ? (
              <span style={{ color: "#9ca3af", fontSize: 14 }}>No videos selected. Add videos below.</span>
            ) : (
              selectedVideos.map((v) => (
                <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 20, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", fontSize: 13, fontWeight: 500, boxShadow: "0 2px 4px rgba(102, 126, 234, 0.3)" }}>
                  🎬 {v}
                  <button type="button" onClick={() => removeVideo(v)} style={{ border: "none", background: "rgba(255,255,255,0.2)", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", color: "#fff", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 4 }} title="Remove">×</button>
                </span>
              ))
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <input list="video-list" value={typedVideo} onChange={(e) => setTypedVideo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVideo(); } }} placeholder={videos.length > 0 ? "Type to search videos..." : "No videos available"} disabled={videos.length === 0} style={inputStyle} />
              <datalist id="video-list">{videos.map((v) => (<option key={v} value={v} />))}</datalist>
            </div>
            <button type="button" onClick={addVideo} disabled={!typedVideo} style={{ padding: "14px 24px", borderRadius: 12, border: "none", background: typedVideo ? "#667eea" : "#e5e7eb", color: typedVideo ? "#fff" : "#9ca3af", fontSize: 14, fontWeight: 600, cursor: typedVideo ? "pointer" : "not-allowed", transition: "all 0.2s" }}>Add</button>
            <button type="button" onClick={clearVideos} disabled={selectedVideos.length === 0} style={{ padding: "14px 24px", borderRadius: 12, border: "2px solid #e5e7eb", background: "#fff", color: selectedVideos.length > 0 ? "#64748b" : "#d1d5db", fontSize: 14, fontWeight: 600, cursor: selectedVideos.length > 0 ? "pointer" : "not-allowed", transition: "all 0.2s" }}>Clear</button>
          </div>
        </div>
      )}

      {/* Advertisement Selection */}
      {contentType === "advertisement" && (
        <div>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151", fontSize: 14 }}>
            Advertisements
            <span style={{ marginLeft: 8, fontWeight: 400, color: "#9ca3af", fontSize: 13 }}>
              ({advertisements.length} available, {selectedAds.length} selected)
            </span>
          </label>
          <div style={{ minHeight: 60, padding: 12, borderRadius: 12, border: "2px solid #bbf7d0", background: "#f0fdf4", display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {selectedAds.length === 0 ? (
              <span style={{ color: "#9ca3af", fontSize: 14 }}>No advertisements selected. Add advertisements below.</span>
            ) : (
              selectedAds.map((a) => (
                <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 20, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", fontSize: 13, fontWeight: 500, boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)" }}>
                  🖼️ {a}
                  <button type="button" onClick={() => removeAd(a)} style={{ border: "none", background: "rgba(255,255,255,0.2)", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", color: "#fff", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 4 }} title="Remove">×</button>
                </span>
              ))
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <input list="ad-list" value={typedAd} onChange={(e) => setTypedAd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAd(); } }} placeholder={advertisements.length > 0 ? "Type to search advertisements..." : "No advertisements available"} disabled={advertisements.length === 0} style={inputStyle} />
              <datalist id="ad-list">{advertisements.map((a) => (<option key={a} value={a} />))}</datalist>
            </div>
            <button type="button" onClick={addAd} disabled={!typedAd} style={{ padding: "14px 24px", borderRadius: 12, border: "none", background: typedAd ? "#10b981" : "#e5e7eb", color: typedAd ? "#fff" : "#9ca3af", fontSize: 14, fontWeight: 600, cursor: typedAd ? "pointer" : "not-allowed", transition: "all 0.2s" }}>Add</button>
            <button type="button" onClick={clearAds} disabled={selectedAds.length === 0} style={{ padding: "14px 24px", borderRadius: 12, border: "2px solid #e5e7eb", background: "#fff", color: selectedAds.length > 0 ? "#64748b" : "#d1d5db", fontSize: 14, fontWeight: 600, cursor: selectedAds.length > 0 ? "pointer" : "not-allowed", transition: "all 0.2s" }}>Clear</button>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{
            padding: "16px 32px",
            borderRadius: 12,
            border: "none",
            background: canSubmit ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "#e5e7eb",
            color: canSubmit ? "#fff" : "#9ca3af",
            fontSize: 16,
            fontWeight: 600,
            cursor: canSubmit ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            boxShadow: canSubmit ? "0 4px 14px 0 rgba(102, 126, 234, 0.4)" : "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {loading ? (
            <>
              <span style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              Saving...
            </>
          ) : (
            <>🔗 Link Content</>
          )}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: "14px 18px",
          borderRadius: 12,
          background: message.startsWith("✅") ? "#ecfdf5" : message.startsWith("❌") ? "#fef2f2" : "#f0f9ff",
          border: `1px solid ${message.startsWith("✅") ? "#a7f3d0" : message.startsWith("❌") ? "#fecaca" : "#bae6fd"}`,
          color: message.startsWith("✅") ? "#065f46" : message.startsWith("❌") ? "#991b1b" : "#0369a1",
          fontSize: 14,
          lineHeight: 1.5,
        }}>
          {message}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
