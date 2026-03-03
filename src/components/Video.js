// src/components/Video.js
// Updated with: rotation display, video preview, fixed upload with rotation/fit_mode
import React, { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";

// Video API - consolidated backend
const VIDEO_BASE = process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_VIDEO_API_URL || 
  `${window.location.protocol}//${window.location.hostname}:8005`;

// DVSG API (same backend)
const DVSG_BASE = process.env.REACT_APP_API_BASE_URL || 
  `${window.location.protocol}//${window.location.hostname}:8005`;

const videoApi = axios.create({
  baseURL: VIDEO_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});
videoApi.interceptors.request.use((c) => { const t = localStorage.getItem("digix_token") || localStorage.getItem("token"); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });

const dvsgApi = axios.create({
  baseURL: DVSG_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});
dvsgApi.interceptors.request.use((c) => { const t = localStorage.getItem("digix_token") || localStorage.getItem("token"); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });

function Modal({ open, title, onClose, children, footer, width = "720px" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: open ? "grid" : "none", placeItems: "center", zIndex: 2000 };
  const card = { width: `min(92vw, ${width})`, background: "#fff", borderRadius: 14, boxShadow: "0 20px 50px rgba(0,0,0,.2)", overflow: "hidden" };
  const header = { padding: "12px 16px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 600 };
  const body = { padding: 16, maxHeight: "70vh", overflowY: "auto" };
  const footerBox = { padding: 16, borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: 8 };
  const closeBtn = { border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <span>{title}</span>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={body}>{children}</div>
        {footer && <div style={footerBox}>{footer}</div>}
      </div>
    </div>
  );
}

// Rotation button component
function RotationSelector({ value, onChange }) {
  const rotations = [0, 90, 180, 270];
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {rotations.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          style={{
            padding: "4px 8px",
            borderRadius: 4,
            border: value === r ? "2px solid #4f46e5" : "1px solid #e5e7eb",
            background: value === r ? "#eef2ff" : "#fff",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: value === r ? 600 : 400,
          }}
        >
          {r}°
        </button>
      ))}
    </div>
  );
}

// Rotation badge for display
function RotationBadge({ rotation }) {
  const colors = {
    0: { bg: "#f3f4f6", text: "#374151" },
    90: { bg: "#dbeafe", text: "#1e40af" },
    180: { bg: "#fef3c7", text: "#92400e" },
    270: { bg: "#fce7f3", text: "#9d174d" },
  };
  const c = colors[rotation] || colors[0];
  
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "4px 10px",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      background: c.bg,
      color: c.text,
    }}>
      <span style={{ transform: `rotate(${rotation}deg)`, display: "inline-block" }}>↻</span>
      {rotation}°
    </span>
  );
}

// Fit mode selector
function FitModeSelector({ value, onChange }) {
  const modes = [
    { value: "cover", label: "Cover (fill screen)", desc: "Video fills screen, may crop edges" },
    { value: "contain", label: "Contain (show all)", desc: "Shows full video, may have black bars" },
    { value: "fill", label: "Fill (stretch)", desc: "Stretches to fill, may distort" },
    { value: "none", label: "Original size", desc: "No scaling applied" },
  ];
  
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {modes.map((m) => (
        <label
          key={m.value}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 8,
            borderRadius: 8,
            border: value === m.value ? "2px solid #4f46e5" : "1px solid #e5e7eb",
            background: value === m.value ? "#eef2ff" : "#fff",
            cursor: "pointer",
          }}
        >
          <input
            type="radio"
            name="fitMode"
            value={m.value}
            checked={value === m.value}
            onChange={() => onChange(m.value)}
          />
          <div>
            <div style={{ fontWeight: 500 }}>{m.label}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{m.desc}</div>
          </div>
        </label>
      ))}
    </div>
  );
}

// Content type badge
function ContentTypeBadge({ type }) {
  const colors = {
    video: { bg: "#dbeafe", text: "#1e40af" },
    image: { bg: "#dcfce7", text: "#166534" },
    html: { bg: "#fef3c7", text: "#92400e" },
    pdf: { bg: "#fee2e2", text: "#991b1b" },
  };
  const c = colors[type] || colors.video;
  
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 6px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      background: c.bg,
      color: c.text,
      textTransform: "uppercase",
    }}>
      {type}
    </span>
  );
}

// Video Preview Modal
function VideoPreviewModal({ open, onClose, video }) {
  const videoRef = useRef(null);
  const [presignedUrl, setPresignedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !video?.s3_link) {
      setPresignedUrl(null);
      return;
    }
    
    // Get presigned URL for the video
    const fetchPresignedUrl = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try to get presigned URL from the downloads endpoint
        const res = await dvsgApi.get(`/video/${encodeURIComponent(video.video_name)}/presign`);
        setPresignedUrl(res.data?.url || res.data?.presigned_url);
      } catch (e) {
        // If no presign endpoint, try using the s3_link directly if it's an HTTP URL
        if (video.s3_link?.startsWith('http')) {
          setPresignedUrl(video.s3_link);
        } else {
          setError("Could not load video preview");
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchPresignedUrl();
  }, [open, video]);

  useEffect(() => {
    if (!open && videoRef.current) {
      videoRef.current.pause();
    }
  }, [open]);

  const rotation = video?.rotation || 0;
  
  return (
    <Modal
      open={open}
      title={`🎬 Preview: ${video?.video_name || "Video"}`}
      onClose={onClose}
      width="900px"
      footer={
        <button 
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
          onClick={onClose}
        >
          Close
        </button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Video Info */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: 12, background: "#f8fafc", borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Type</div>
            <ContentTypeBadge type={video?.content_type || "video"} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Rotation</div>
            <RotationBadge rotation={rotation} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Fit Mode</div>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{video?.fit_mode || "cover"}</span>
          </div>
          {video?.display_duration && (
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Duration</div>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{video.display_duration}s</span>
            </div>
          )}
        </div>

        {/* Video Player */}
        <div style={{ 
          background: "#000", 
          borderRadius: 8, 
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}>
          {loading ? (
            <div style={{ color: "#fff", padding: 40 }}>Loading video...</div>
          ) : error ? (
            <div style={{ color: "#ef4444", padding: 40 }}>{error}</div>
          ) : presignedUrl ? (
            <video
              ref={videoRef}
              src={presignedUrl}
              controls
              autoPlay
              style={{
                maxWidth: "100%",
                maxHeight: 500,
                transform: `rotate(${rotation}deg)`,
                transition: "transform 0.3s",
              }}
            />
          ) : (
            <div style={{ color: "#6b7280", padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
              <div>Video preview not available</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>S3 Link: {video?.s3_link || "Not set"}</div>
            </div>
          )}
        </div>

        {/* Rotation Preview Note */}
        {rotation !== 0 && (
          <div style={{ 
            padding: 10, 
            background: "#fef3c7", 
            borderRadius: 8, 
            fontSize: 13, 
            color: "#92400e",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span>⚠️</span>
            <span>This video is set to rotate {rotation}° on the Android player</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Video() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit modal
  const [edit, setEdit] = useState(null);

  // Preview modal
  const [preview, setPreview] = useState(null);

  // Expanded row to show linked groups
  const [expandedVideo, setExpandedVideo] = useState(null);
  const [linkedGroups, setLinkedGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Upload state
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [overwrite, setOverwrite] = useState(true);
  const [uploadRotation, setUploadRotation] = useState(0);
  const [uploadFitMode, setUploadFitMode] = useState("cover");
  const [uploadDuration, setUploadDuration] = useState(10);
  const [pct, setPct] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadedInfo, setUploadedInfo] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await videoApi.get("/videos", { params: { q, limit: 50, offset: 0 } });
      const data = res.data;
      // Handle both array and {items: [...]} response formats
      const videoItems = Array.isArray(data) ? data : data.items || data.data || [];
      // Filter out images - only show videos
      const videosOnly = videoItems.filter(it => (it.content_type || "video") !== "image");
      setItems(videosOnly);
    } catch (e) {
      console.error("Failed to load videos:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Load linked groups when video is expanded
  const toggleExpand = async (videoName) => {
    if (expandedVideo === videoName) {
      setExpandedVideo(null);
      setLinkedGroups([]);
      return;
    }
    
    setExpandedVideo(videoName);
    setLoadingGroups(true);
    try {
      // Use dvsgApi (port 8005) for the groups endpoint
      const res = await dvsgApi.get(`/video/${encodeURIComponent(videoName)}/groups`);
      setLinkedGroups(res.data?.groups || []);
    } catch (e) {
      console.error("Failed to load linked groups:", e);
      setLinkedGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  };

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const search = q.toLowerCase();
    return items.filter((it) => 
      (it.video_name || "").toLowerCase().includes(search) ||
      (it.content_type || "").toLowerCase().includes(search)
    );
  }, [items, q]);

  const openEdit = (it) => {
    setEdit({
      ...it,
      newName: it.video_name,
      newLink: it.s3_link,
      newRotation: it.rotation || 0,
      newFitMode: it.fit_mode || "cover",
      newDuration: it.display_duration || 10,
    });
  };

  const saveEdit = async () => {
    if (!edit) return;
    
    const patch = {};
    if (edit.newName && edit.newName !== edit.video_name) patch.video_name = edit.newName.trim();
    if (edit.newLink && edit.newLink !== edit.s3_link) patch.s3_link = edit.newLink.trim();
    if (edit.newRotation !== edit.rotation) patch.rotation = edit.newRotation;
    if (edit.newFitMode !== edit.fit_mode) patch.fit_mode = edit.newFitMode;
    if (edit.newDuration !== edit.display_duration) patch.display_duration = edit.newDuration;
    
    if (!Object.keys(patch).length) {
      setEdit(null);
      return;
    }
    
    try {
      await videoApi.put(`/video/${encodeURIComponent(edit.video_name)}`, patch);
      setEdit(null);
      load();
    } catch (e) {
      alert(e?.response?.data?.detail || "Update failed");
    }
  };

  const remove = async (name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await videoApi.delete(`/video/${encodeURIComponent(name)}`);
      load();
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      if (status === 409 && detail?.linked) {
        const parts = Object.entries(detail.linked).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`);
        if (window.confirm(`Video "${name}" is linked to: ${parts.join(', ')}.\n\nUnlink everything and delete?`)) {
          try {
            await videoApi.delete(`/video/${encodeURIComponent(name)}?force=true`);
            load();
          } catch (e2) {
            alert(e2?.response?.data?.detail || "Force delete failed");
          }
        }
      } else {
        alert(typeof detail === 'string' ? detail : detail?.message || "Delete failed");
      }
    }
  };

  // Update rotation via DVSG API (port 8005)
  const setRotation = async (videoName, rotation) => {
    try {
      await dvsgApi.post(`/video/${encodeURIComponent(videoName)}/rotation`, { rotation });
      // Also update locally
      setItems(prev => prev.map(it => 
        it.video_name === videoName ? { ...it, rotation } : it
      ));
    } catch (e) {
      console.error("Failed to set rotation via DVSG:", e);
      // Fallback to video API
      try {
        await videoApi.put(`/video/${encodeURIComponent(videoName)}`, { rotation });
        load();
      } catch (e2) {
        alert(e2?.response?.data?.detail || "Failed to set rotation");
      }
    }
  };

  // Update fit_mode via DVSG API (port 8005)
  const setFitMode = async (videoName, fitMode) => {
    try {
      await dvsgApi.post(`/video/${encodeURIComponent(videoName)}/fit_mode`, { fit_mode: fitMode });
      // Also update locally
      setItems(prev => prev.map(it => 
        it.video_name === videoName ? { ...it, fit_mode: fitMode } : it
      ));
    } catch (e) {
      console.error("Failed to set fit_mode via DVSG:", e);
      // Fallback to video API
      try {
        await videoApi.put(`/video/${encodeURIComponent(videoName)}`, { fit_mode: fitMode });
        load();
      } catch (e2) {
        alert(e2?.response?.data?.detail || "Failed to set fit mode");
      }
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      alert("Please select a file");
      return;
    }
    
    const name = uploadName.trim() || uploadFile.name.replace(/\.[^/.]+$/, "");
    
    setUploading(true);
    setPct(0);
    setUploadedInfo(null);
    
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("video_name", name);
      formData.append("overwrite", overwrite ? "true" : "false");
      formData.append("rotation", uploadRotation.toString());
      formData.append("fit_mode", uploadFitMode);
      formData.append("display_duration", uploadDuration.toString());
      
      // Upload to video service
      const res = await videoApi.post("/upload_video", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setPct(percent);
          }
        },
      });
      
      // After upload, update rotation/fit_mode in DVSG service (port 8005)
      try {
        if (uploadRotation !== 0) {
          await dvsgApi.post(`/video/${encodeURIComponent(name)}/rotation`, { rotation: uploadRotation });
        }
        if (uploadFitMode !== "cover") {
          await dvsgApi.post(`/video/${encodeURIComponent(name)}/fit_mode`, { fit_mode: uploadFitMode });
        }
      } catch (dvsgErr) {
        console.warn("Could not update rotation/fit_mode in DVSG:", dvsgErr);
      }
      
      setUploadedInfo({ ...res.data, rotation: uploadRotation, fit_mode: uploadFitMode });
      setUploadName("");
      setUploadFile(null);
      setUploadRotation(0);
      setUploadFitMode("cover");
      if (fileInputRef.current) fileInputRef.current.value = "";
      load();
    } catch (e) {
      alert(e?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Styles
  const input = { border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 14 };
  const btn = { padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 };
  const btnPrimary = { ...btn, background: "#4f46e5", color: "#fff", borderColor: "#4f46e5" };
  const btnSuccess = { ...btn, background: "#10b981", color: "#fff", borderColor: "#10b981" };
  const btnDanger = { ...btn, background: "#dc2626", color: "#fff", borderColor: "#dc2626" };
  const barWrap = { height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" };
  const bar = { height: "100%", background: "#4f46e5", width: `${pct}%`, transition: "width 0.2s" };

  return (
    <div>
      <h2 style={{ fontSize: 28, margin: "0 0 12px" }}>Content Library</h2>
      
      {/* Upload Section */}
      <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16, marginBottom: 20, border: "1px solid #e5e7eb" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Upload Content</h3>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
          Supports: Video (MP4, WebM, MOV), Images (JPG, PNG, GIF, WebP), HTML, PDF
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Content Name</div>
            <input
              style={{ ...input, width: "100%" }}
              placeholder="e.g. promo_video_summer"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>File</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*,.html,.htm,.pdf"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Rotation</div>
            <RotationSelector value={uploadRotation} onChange={setUploadRotation} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Fit Mode</div>
            <select
              style={{ ...input, width: "100%" }}
              value={uploadFitMode}
              onChange={(e) => setUploadFitMode(e.target.value)}
            >
              <option value="cover">Cover (fill screen)</option>
              <option value="contain">Contain (show all)</option>
              <option value="fill">Fill (stretch)</option>
              <option value="none">Original size</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Duration (for images)</div>
            <input
              style={{ ...input, width: "100%" }}
              type="number"
              min="1"
              max="300"
              value={uploadDuration}
              onChange={(e) => setUploadDuration(parseInt(e.target.value) || 10)}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
            Overwrite if exists
          </label>
          <button style={btnPrimary} disabled={uploading} onClick={handleUpload}>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>

        {uploading && (
          <div style={{ marginTop: 10 }}>
            <div style={barWrap}><div style={bar} /></div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{pct}%</div>
          </div>
        )}

        {uploadedInfo && (
          <div style={{ marginTop: 10, padding: 10, background: "#ecfdf5", borderRadius: 8, border: "1px solid #a7f3d0" }}>
            <div style={{ fontWeight: 600, color: "#065f46", marginBottom: 4 }}>✓ Upload successful</div>
            <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <ContentTypeBadge type={uploadedInfo.content_type || "video"} />
              <span>{uploadedInfo.video_name}</span>
              {uploadedInfo.rotation !== 0 && <RotationBadge rotation={uploadedInfo.rotation} />}
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input 
          style={{ ...input, minWidth: 220 }} 
          placeholder="Search content..." 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
        />
        <button style={btn} onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Search"}
        </button>
      </div>

      {/* Content List */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Name</th>
              <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee", width: 80 }}>Type</th>
              <th style={{ textAlign: "center", padding: 12, borderBottom: "1px solid #eee", width: 120 }}>Rotation</th>
              <th style={{ textAlign: "center", padding: 12, borderBottom: "1px solid #eee", width: 100 }}>Fit Mode</th>
              <th style={{ textAlign: "right", padding: 12, borderBottom: "1px solid #eee", width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
                  No content found
                </td>
              </tr>
            )}
            {filtered.map((it) => (
              <React.Fragment key={it.id}>
                <tr 
                  style={{ 
                    borderBottom: expandedVideo === it.video_name ? "none" : "1px solid #f1f5f9",
                    cursor: "pointer",
                    background: expandedVideo === it.video_name ? "#f0f9ff" : "transparent",
                  }}
                  onClick={() => toggleExpand(it.video_name)}
                >
                  <td style={{ padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ 
                        fontSize: 12, 
                        color: "#6b7280",
                        transform: expandedVideo === it.video_name ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}>▶</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{it.video_name}</div>
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                          ID: {it.id}
                          {it.company_name && <span style={{ marginLeft: 8, background: "#dbeafe", color: "#1e40af", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{it.company_name}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: 12 }} onClick={(e) => e.stopPropagation()}>
                    <ContentTypeBadge type={it.content_type || "video"} />
                  </td>
                  <td style={{ padding: 12, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <RotationBadge rotation={it.rotation || 0} />
                      <select
                        style={{ ...input, padding: "4px 8px", fontSize: 11, width: 70 }}
                        value={it.rotation || 0}
                        onChange={(e) => setRotation(it.video_name, parseInt(e.target.value))}
                      >
                        <option value={0}>0°</option>
                        <option value={90}>90°</option>
                        <option value={180}>180°</option>
                        <option value={270}>270°</option>
                      </select>
                    </div>
                  </td>
                  <td style={{ padding: 12, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                    <select
                      style={{ ...input, padding: "4px 8px", fontSize: 12 }}
                      value={it.fit_mode || "cover"}
                      onChange={(e) => setFitMode(it.video_name, e.target.value)}
                    >
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="fill">Fill</option>
                      <option value="none">None</option>
                    </select>
                  </td>
                  <td style={{ padding: 12, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button 
                        style={{ ...btnSuccess, padding: "4px 8px" }} 
                        onClick={() => setPreview(it)}
                        title="Preview video"
                      >
                        ▶️ Play
                      </button>
                      <button style={{ ...btn, padding: "4px 8px" }} onClick={() => openEdit(it)}>
                        Edit
                      </button>
                      <button style={{ ...btnDanger, padding: "4px 8px" }} onClick={() => remove(it.video_name)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {/* Expanded row showing linked groups */}
                {expandedVideo === it.video_name && (
                  <tr>
                    <td colSpan={5} style={{ 
                      padding: "0 12px 12px 40px", 
                      background: "#f0f9ff",
                      borderBottom: "1px solid #bae6fd",
                    }}>
                      <div style={{ 
                        padding: 12, 
                        background: "#fff", 
                        borderRadius: 8,
                        border: "1px solid #e0f2fe",
                      }}>
                        <div style={{ 
                          fontSize: 12, 
                          fontWeight: 600, 
                          color: "#0369a1", 
                          marginBottom: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}>
                          📁 Linked Groups
                        </div>
                        {loadingGroups ? (
                          <div style={{ color: "#6b7280", fontSize: 12 }}>Loading...</div>
                        ) : linkedGroups.length === 0 ? (
                          <div style={{ color: "#9ca3af", fontSize: 12 }}>
                            This video is not linked to any groups
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {linkedGroups.map((g) => (
                              <span
                                key={g.id}
                                style={{
                                  padding: "4px 10px",
                                  background: "#dbeafe",
                                  color: "#1e40af",
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 500,
                                }}
                              >
                                {g.gname}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Video Preview Modal */}
      <VideoPreviewModal
        open={!!preview}
        onClose={() => setPreview(null)}
        video={preview}
      />

      {/* Edit Modal */}
      <Modal
        open={!!edit}
        title="Edit Content"
        onClose={() => setEdit(null)}
        footer={
          <>
            <button style={btn} onClick={() => setEdit(null)}>Cancel</button>
            <button style={btnPrimary} onClick={saveEdit}>Save Changes</button>
          </>
        }
      >
        {edit && (
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Content Name</label>
              <input
                style={{ ...input, width: "100%" }}
                value={edit.newName}
                onChange={(e) => setEdit((x) => ({ ...x, newName: e.target.value }))}
              />
            </div>
            
            <div>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>S3 Link</label>
              <input
                style={{ ...input, width: "100%" }}
                value={edit.newLink}
                onChange={(e) => setEdit((x) => ({ ...x, newLink: e.target.value }))}
              />
            </div>
            
            <div>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Rotation</label>
              <RotationSelector 
                value={edit.newRotation} 
                onChange={(r) => setEdit((x) => ({ ...x, newRotation: r }))} 
              />
            </div>
            
            <div>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Fit Mode</label>
              <FitModeSelector
                value={edit.newFitMode}
                onChange={(m) => setEdit((x) => ({ ...x, newFitMode: m }))}
              />
            </div>
            
            {edit.content_type !== "video" && (
              <div>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                  Display Duration (seconds)
                </label>
                <input
                  type="number"
                  style={{ ...input, width: 100 }}
                  min="1"
                  max="300"
                  value={edit.newDuration}
                  onChange={(e) => setEdit((x) => ({ ...x, newDuration: parseInt(e.target.value) || 10 }))}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
