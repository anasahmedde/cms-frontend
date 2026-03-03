// src/components/Advertisement.js
// Advertisement/Image Management Component - Similar to Video.js but for images
import React, { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";

// DVSG API runs on port 8005
const DVSG_BASE = process.env.REACT_APP_API_BASE_URL || 
  `${window.location.protocol}//${window.location.hostname}:8005`;

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
            border: value === r ? "2px solid #10b981" : "1px solid #e5e7eb",
            background: value === r ? "#ecfdf5" : "#fff",
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
    { value: "cover", label: "Cover (fill screen)", desc: "Image fills screen, may crop edges" },
    { value: "contain", label: "Contain (show all)", desc: "Shows full image, may have black bars" },
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
            border: value === m.value ? "2px solid #10b981" : "1px solid #e5e7eb",
            background: value === m.value ? "#ecfdf5" : "#fff",
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

// Image Preview Modal
function ImagePreviewModal({ open, onClose, advertisement }) {
  const [presignedUrl, setPresignedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !advertisement?.s3_link) {
      setPresignedUrl(null);
      return;
    }
    
    const fetchPresignedUrl = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await dvsgApi.get(`/advertisement/${encodeURIComponent(advertisement.ad_name)}/presign`);
        setPresignedUrl(res.data?.url || res.data?.presigned_url);
      } catch (e) {
        if (advertisement.s3_link?.startsWith('http')) {
          setPresignedUrl(advertisement.s3_link);
        } else {
          setError("Could not load image preview");
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchPresignedUrl();
  }, [open, advertisement]);

  const rotation = advertisement?.rotation || 0;
  
  return (
    <Modal
      open={open}
      title={`🖼️ Preview: ${advertisement?.ad_name || "Advertisement"}`}
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
        {/* Image Info */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: 12, background: "#f0fdf4", borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Type</div>
            <span style={{
              display: "inline-block",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              background: "#dcfce7",
              color: "#166534",
              textTransform: "uppercase",
            }}>
              IMAGE
            </span>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Rotation</div>
            <RotationBadge rotation={rotation} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Fit Mode</div>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{advertisement?.fit_mode || "cover"}</span>
          </div>
        </div>

        {/* Image Display */}
        <div style={{ 
          background: "#f0fdf4", 
          borderRadius: 8, 
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
          border: "2px solid #bbf7d0",
        }}>
          {loading ? (
            <div style={{ color: "#166534", padding: 40 }}>Loading image...</div>
          ) : error ? (
            <div style={{ color: "#ef4444", padding: 40 }}>{error}</div>
          ) : presignedUrl ? (
            <img
              src={presignedUrl}
              alt={advertisement?.ad_name}
              style={{
                maxWidth: "100%",
                maxHeight: 500,
                transform: `rotate(${rotation}deg)`,
                transition: "transform 0.3s",
                objectFit: "contain",
              }}
            />
          ) : (
            <div style={{ color: "#6b7280", padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🖼️</div>
              <div>Image preview not available</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>S3 Link: {advertisement?.s3_link || "Not set"}</div>
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
            <span>This image is set to rotate {rotation}° on the Android player</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Advertisement() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit modal
  const [edit, setEdit] = useState(null);

  // Preview modal
  const [preview, setPreview] = useState(null);

  // Expanded row to show linked groups
  const [expandedAd, setExpandedAd] = useState(null);
  const [linkedGroups, setLinkedGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Upload state
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [overwrite, setOverwrite] = useState(true);
  const [uploadRotation, setUploadRotation] = useState(0);
  const [uploadFitMode, setUploadFitMode] = useState("cover");
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
      const res = await dvsgApi.get("/advertisements", { params: { q, limit: 50, offset: 0 } });
      const data = res.data;
      const adItems = Array.isArray(data) ? data : data.items || data.data || [];
      setItems(adItems);
    } catch (e) {
      console.error("Failed to load advertisements:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Load linked groups when ad is expanded
  const toggleExpand = async (adName) => {
    if (expandedAd === adName) {
      setExpandedAd(null);
      setLinkedGroups([]);
      return;
    }
    
    setExpandedAd(adName);
    setLoadingGroups(true);
    try {
      const res = await dvsgApi.get(`/advertisement/${encodeURIComponent(adName)}/groups`);
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
      (it.ad_name || "").toLowerCase().includes(search)
    );
  }, [items, q]);

  const openEdit = (it) => {
    setEdit({
      ...it,
      newName: it.ad_name,
      newLink: it.s3_link,
      newRotation: it.rotation || 0,
      newFitMode: it.fit_mode || "cover",
    });
  };

  const saveEdit = async () => {
    if (!edit) return;
    
    const patch = {};
    if (edit.newName && edit.newName !== edit.ad_name) patch.ad_name = edit.newName.trim();
    if (edit.newLink && edit.newLink !== edit.s3_link) patch.s3_link = edit.newLink.trim();
    if (edit.newRotation !== edit.rotation) patch.rotation = edit.newRotation;
    if (edit.newFitMode !== edit.fit_mode) patch.fit_mode = edit.newFitMode;
    
    if (!Object.keys(patch).length) {
      setEdit(null);
      return;
    }
    
    try {
      await dvsgApi.put(`/advertisement/${encodeURIComponent(edit.ad_name)}`, patch);
      setEdit(null);
      load();
    } catch (e) {
      alert(e?.response?.data?.detail || "Update failed");
    }
  };

  const remove = async (name) => {
    if (!window.confirm(`Delete advertisement "${name}"?`)) return;
    try {
      await dvsgApi.delete(`/advertisement/${encodeURIComponent(name)}`);
      load();
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      if (status === 409 && detail?.linked) {
        const parts = Object.entries(detail.linked).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`);
        if (window.confirm(`Advertisement "${name}" is linked to: ${parts.join(', ')}.\n\nUnlink everything and delete?`)) {
          try {
            await dvsgApi.delete(`/advertisement/${encodeURIComponent(name)}?force=true`);
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

  // Update rotation
  const setRotation = async (adName, rotation) => {
    try {
      await dvsgApi.post(`/advertisement/${encodeURIComponent(adName)}/rotation`, { rotation });
      setItems(prev => prev.map(it => 
        it.ad_name === adName ? { ...it, rotation } : it
      ));
    } catch (e) {
      console.error("Failed to set rotation:", e);
      alert(e?.response?.data?.detail || "Failed to set rotation");
    }
  };

  // Update fit_mode
  const setFitMode = async (adName, fitMode) => {
    try {
      await dvsgApi.post(`/advertisement/${encodeURIComponent(adName)}/fit_mode`, { fit_mode: fitMode });
      setItems(prev => prev.map(it => 
        it.ad_name === adName ? { ...it, fit_mode: fitMode } : it
      ));
    } catch (e) {
      console.error("Failed to set fit_mode:", e);
      alert(e?.response?.data?.detail || "Failed to set fit mode");
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      alert("Please select an image file");
      return;
    }
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(uploadFile.type)) {
      alert("Please select a valid image file (JPG, PNG, GIF, or WebP)");
      return;
    }
    
    const name = uploadName.trim() || uploadFile.name.replace(/\.[^/.]+$/, "");
    
    setUploading(true);
    setPct(0);
    setUploadedInfo(null);
    
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("ad_name", name);
      formData.append("overwrite", overwrite ? "true" : "false");
      formData.append("rotation", uploadRotation.toString());
      formData.append("fit_mode", uploadFitMode);
      
      const res = await dvsgApi.post("/upload_advertisement", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setPct(percent);
          }
        },
      });
      
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
  const btnPrimary = { ...btn, background: "#10b981", color: "#fff", borderColor: "#10b981" };
  const btnSuccess = { ...btn, background: "#059669", color: "#fff", borderColor: "#059669" };
  const btnDanger = { ...btn, background: "#dc2626", color: "#fff", borderColor: "#dc2626" };
  const barWrap = { height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" };
  const bar = { height: "100%", background: "#10b981", width: `${pct}%`, transition: "width 0.2s" };

  return (
    <div>
      <h2 style={{ fontSize: 28, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ 
          width: 40, 
          height: 40, 
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", 
          borderRadius: 10, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          fontSize: 20,
        }}>🖼️</span>
        Advertisement Library
      </h2>
      
      {/* Upload Section */}
      <div style={{ background: "#f0fdf4", borderRadius: 12, padding: 16, marginBottom: 20, border: "1px solid #bbf7d0" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "#166534" }}>📤 Upload Image Advertisement</h3>
        <div style={{ fontSize: 12, color: "#15803d", marginBottom: 12 }}>
          Supports: JPG, PNG, GIF, WebP (Images only - for videos use the Videos section)
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Advertisement Name</div>
            <input
              style={{ ...input, width: "100%" }}
              placeholder="e.g. summer_promo_banner"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Image File</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
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
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
            Overwrite if exists
          </label>
          <button style={btnPrimary} disabled={uploading} onClick={handleUpload}>
            {uploading ? "Uploading..." : "Upload Image"}
          </button>
        </div>

        {uploading && (
          <div style={{ marginTop: 10 }}>
            <div style={barWrap}><div style={bar} /></div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{pct}%</div>
          </div>
        )}

        {uploadedInfo && (
          <div style={{ marginTop: 10, padding: 10, background: "#dcfce7", borderRadius: 8, border: "1px solid #86efac" }}>
            <div style={{ fontWeight: 600, color: "#166534", marginBottom: 4 }}>✓ Upload successful</div>
            <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                display: "inline-block",
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                background: "#bbf7d0",
                color: "#166534",
              }}>IMAGE</span>
              <span>{uploadedInfo.ad_name}</span>
              {uploadedInfo.rotation !== 0 && <RotationBadge rotation={uploadedInfo.rotation} />}
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input 
          style={{ ...input, minWidth: 220 }} 
          placeholder="Search advertisements..." 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
        />
        <button style={btn} onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Search"}
        </button>
      </div>

      {/* Advertisement List */}
      <div style={{ border: "1px solid #bbf7d0", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f0fdf4" }}>
              <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #bbf7d0", color: "#166534" }}>Name</th>
              <th style={{ textAlign: "center", padding: 12, borderBottom: "1px solid #bbf7d0", width: 120, color: "#166534" }}>Rotation</th>
              <th style={{ textAlign: "center", padding: 12, borderBottom: "1px solid #bbf7d0", width: 100, color: "#166534" }}>Fit Mode</th>
              <th style={{ textAlign: "right", padding: 12, borderBottom: "1px solid #bbf7d0", width: 200, color: "#166534" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
                  No advertisements found. Upload your first image above!
                </td>
              </tr>
            )}
            {filtered.map((it) => (
              <React.Fragment key={it.id}>
                <tr 
                  style={{ 
                    borderBottom: expandedAd === it.ad_name ? "none" : "1px solid #dcfce7",
                    cursor: "pointer",
                    background: expandedAd === it.ad_name ? "#ecfdf5" : "transparent",
                  }}
                  onClick={() => toggleExpand(it.ad_name)}
                >
                  <td style={{ padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ 
                        fontSize: 12, 
                        color: "#166534",
                        transform: expandedAd === it.ad_name ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}>▶</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{it.ad_name}</div>
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                          ID: {it.id}
                          {it.company_name && <span style={{ marginLeft: 8, background: "#dbeafe", color: "#1e40af", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{it.company_name}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: 12, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <RotationBadge rotation={it.rotation || 0} />
                      <select
                        style={{ ...input, padding: "4px 8px", fontSize: 11, width: 70 }}
                        value={it.rotation || 0}
                        onChange={(e) => setRotation(it.ad_name, parseInt(e.target.value))}
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
                      onChange={(e) => setFitMode(it.ad_name, e.target.value)}
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
                        title="Preview image"
                      >
                        👁️ View
                      </button>
                      <button style={{ ...btn, padding: "4px 8px" }} onClick={() => openEdit(it)}>
                        Edit
                      </button>
                      <button style={{ ...btnDanger, padding: "4px 8px" }} onClick={() => remove(it.ad_name)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {/* Expanded row showing linked groups */}
                {expandedAd === it.ad_name && (
                  <tr>
                    <td colSpan={4} style={{ 
                      padding: "0 12px 12px 40px", 
                      background: "#ecfdf5",
                      borderBottom: "1px solid #86efac",
                    }}>
                      <div style={{ 
                        padding: 12, 
                        background: "#fff", 
                        borderRadius: 8,
                        border: "1px solid #bbf7d0",
                      }}>
                        <div style={{ 
                          fontSize: 12, 
                          fontWeight: 600, 
                          color: "#166534", 
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
                            This image is not linked to any groups
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {linkedGroups.map((g) => (
                              <span
                                key={g.id}
                                style={{
                                  padding: "4px 10px",
                                  background: "#dcfce7",
                                  color: "#166534",
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

      {/* Image Preview Modal */}
      <ImagePreviewModal
        open={!!preview}
        onClose={() => setPreview(null)}
        advertisement={preview}
      />

      {/* Edit Modal */}
      <Modal
        open={!!edit}
        title="Edit Advertisement"
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
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Advertisement Name</label>
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
          </div>
        )}
      </Modal>
    </div>
  );
}
