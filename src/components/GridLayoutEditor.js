// src/components/GridLayoutEditor.js
// Professional Grid Layout Editor for multi-video collage display
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8005`;

const LAYOUT_PRESETS = {
  single: { name: "Single", slots: 1, icon: "▢", grid: [[100]] },
  split_h: { name: "2 Horizontal", slots: 2, icon: "▥", grid: [[50, 50]] },
  split_v: { name: "2 Vertical", slots: 2, icon: "▤", grid: [[100], [100]] },
  grid_3: { name: "3 Videos", slots: 3, icon: "⊞", grid: [[50, 50], [100]] },
  grid_4: { name: "4 Grid (2×2)", slots: 4, icon: "⊞", grid: [[50, 50], [50, 50]] },
  grid_1x4: { name: "4 Grid (1×4)", slots: 4, icon: "▤▤", grid: [[100], [100], [100], [100]] },
};

const ROTATIONS = [
  { value: null, label: "Default" },
  { value: 0, label: "0°" },
  { value: 90, label: "90°" },
  { value: 180, label: "180°" },
  { value: 270, label: "270°" },
];

const CONTENT_TYPES = [
  { value: "video", label: "🎬 Video", color: "#3b82f6" },
  { value: "image", label: "🖼️ Image", color: "#10b981" },
];

function GridLayoutEditor({ open, onClose, deviceId, videos = [], advertisements = [], onSaved, groupName, allGroupDevices = [] }) {
  const [layoutMode, setLayoutMode] = useState("single");
  const [slots, setSlots] = useState([]);
  const [deviceResolution, setDeviceResolution] = useState(null);
  const [draggedVideo, setDraggedVideo] = useState(null);
  const [draggedAd, setDraggedAd] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [error, setError] = useState("");
  const [loadingState, setLoadingState] = useState(true);
  const [confirmGroupApply, setConfirmGroupApply] = useState(false);
  const [groupApplyProgress, setGroupApplyProgress] = useState({ current: 0, total: 0 });
  const [contentTab, setContentTab] = useState("video"); // "video" or "image"
  const [loadedAds, setLoadedAds] = useState([]); // Advertisements loaded from group
  const [savedConfig, setSavedConfig] = useState(null); // Saved layout_config from backend

  // Parse resolution string to width/height
  const parseResolution = (resStr) => {
    if (!resStr) return { width: 1920, height: 1080 };
    const parts = resStr.split("x");
    return { width: parseInt(parts[0]) || 1920, height: parseInt(parts[1]) || 1080 };
  };

  // Load device resolution and existing layout
  useEffect(() => {
    if (!open || !deviceId) return;
    
    const loadDeviceState = async () => {
      setLoadingState(true);
      try {
        // Load resolution
        try {
          const resRes = await axios.get(`${API_BASE}/device/${deviceId}/resolution`);
          setDeviceResolution(resRes.data.resolution);
        } catch (err) {
          console.log("Could not load device resolution, using default");
          setDeviceResolution(null);
        }
        
        // Load existing layout mode and config
        let savedLayoutConfig = null;
        try {
          const layoutRes = await axios.get(`${API_BASE}/device/${deviceId}/layout`);
          const savedMode = layoutRes.data?.layout_mode;
          if (savedMode && LAYOUT_PRESETS[savedMode]) {
            setLayoutMode(savedMode);
          }
          // Parse layout_config to restore slots
          if (layoutRes.data?.layout_config) {
            try {
              const parsed = typeof layoutRes.data.layout_config === 'string' 
                ? JSON.parse(layoutRes.data.layout_config) 
                : layoutRes.data.layout_config;
              // Ensure savedLayoutConfig is always an array
              savedLayoutConfig = Array.isArray(parsed) ? parsed : [];
              setSavedConfig(savedLayoutConfig);
            } catch (e) {
              console.log("Could not parse layout_config");
            }
          }
        } catch (err) {
          console.log("No existing layout, using single");
        }
        
        // Load advertisements from group if available
        if (groupName) {
          try {
            const adRes = await axios.get(`${API_BASE}/group/${encodeURIComponent(groupName)}/advertisements`);
            const ads = adRes.data?.advertisements || [];
            setLoadedAds(ads);
            console.log("Loaded advertisements for group:", ads.length);
          } catch (err) {
            console.log("Could not load group advertisements:", err);
            setLoadedAds([]);
          }
        } else {
          setLoadedAds([]);
        }
      } catch (err) {
        console.error("Failed to load device state:", err);
      } finally {
        setLoadingState(false);
      }
    };
    
    loadDeviceState();
  }, [open, deviceId, groupName]);

  // Combine passed advertisements with loaded ones - memoize to prevent infinite loops
  const allAdvertisements = useMemo(() => {
    return [...(advertisements || []), ...loadedAds].filter((ad, index, self) => 
      index === self.findIndex(a => a.ad_name === ad.ad_name)
    );
  }, [advertisements, loadedAds]);

  // Filter out images from videos - memoize to prevent infinite loops
  const videosOnlyFiltered = useMemo(() => {
    return videos.filter(v => (v.content_type || "video") !== "image");
  }, [videos]);

  // Track if slots have been initialized to prevent re-initialization
  const slotsInitialized = useRef(false);

  // Initialize slots when layout changes - use saved config to restore both videos and images
  useEffect(() => {
    if (!open || loadingState) {
      slotsInitialized.current = false;
      return;
    }
    
    // Only initialize once per open, unless layout mode changes
    if (slotsInitialized.current) return;
    slotsInitialized.current = true;
    
    const preset = LAYOUT_PRESETS[layoutMode] || LAYOUT_PRESETS.single;
    const numSlots = preset.slots;
    const newSlots = [];
    
    // Sort videos by grid_position if available (only actual videos, not images)
    const sortedVideos = [...videosOnlyFiltered].sort((a, b) => (a.grid_position || 0) - (b.grid_position || 0));
    
    for (let i = 0; i < numSlots; i++) {
      const position = i + 1;
      
      // Check savedConfig for this slot (ensure it's an array)
      const configArray = Array.isArray(savedConfig) ? savedConfig : [];
      const savedSlot = configArray.find(s => s.position === position);
      
      if (savedSlot?.ad_name && savedSlot?.content_type === "image") {
        // This slot has an image - find the advertisement data
        const adData = allAdvertisements.find(a => a.ad_name === savedSlot.ad_name);
        newSlots.push({
          position: position,
          video: null,
          advertisement: adData || { ad_name: savedSlot.ad_name },
          content_type: "image",
          rotation: savedSlot.rotation ?? null,
        });
      } else if (savedSlot?.video_name) {
        // This slot has a video from saved config
        const videoData = sortedVideos.find(v => v.video_name === savedSlot.video_name);
        const effectiveRotation = savedSlot.rotation ?? videoData?.device_rotation ?? videoData?.rotation ?? null;
        newSlots.push({
          position: position,
          video: videoData || { video_name: savedSlot.video_name },
          advertisement: null,
          content_type: "video",
          rotation: effectiveRotation,
        });
      } else {
        // Fall back to videos by index (for backwards compatibility)
        const existingVideo = sortedVideos[i] || null;
        const effectiveRotation = existingVideo?.device_rotation ?? existingVideo?.rotation ?? null;
        newSlots.push({
          position: position,
          video: existingVideo,
          advertisement: null,
          content_type: existingVideo ? "video" : "video",
          rotation: effectiveRotation,
        });
      }
    }
    setSlots(newSlots);
  }, [open, loadingState]); // Only depend on open and loadingState

  // Re-initialize slots when layout mode changes
  useEffect(() => {
    if (!open || loadingState) return;
    
    const preset = LAYOUT_PRESETS[layoutMode] || LAYOUT_PRESETS.single;
    const numSlots = preset.slots;
    
    // If slot count changed, reinitialize
    if (slots.length !== numSlots) {
      const newSlots = [];
      const sortedVideos = [...videosOnlyFiltered].sort((a, b) => (a.grid_position || 0) - (b.grid_position || 0));
      
      for (let i = 0; i < numSlots; i++) {
        // Try to keep existing slot data if available
        const existingSlot = slots[i];
        if (existingSlot) {
          newSlots.push({ ...existingSlot, position: i + 1 });
        } else {
          const existingVideo = sortedVideos[i] || null;
          const effectiveRotation = existingVideo?.device_rotation ?? existingVideo?.rotation ?? null;
          newSlots.push({
            position: i + 1,
            video: existingVideo,
            advertisement: null,
            content_type: existingVideo ? "video" : "video",
            rotation: effectiveRotation,
          });
        }
      }
      setSlots(newSlots);
    }
  }, [layoutMode]); // Only re-run when layout mode changes

  const handleDragStart = (e, video) => {
    setDraggedVideo(video);
    setDraggedAd(null);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleAdDragStart = (e, ad) => {
    setDraggedAd(ad);
    setDraggedVideo(null);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e, slotIndex) => {
    e.preventDefault();
    
    if (draggedVideo) {
      setSlots(prev => {
        const newSlots = [...prev];
        // Remove video from old slot if exists
        newSlots.forEach((slot, i) => {
          if (slot.video?.video_name === draggedVideo.video_name) {
            newSlots[i] = { ...slot, video: null, content_type: "video" };
          }
        });
        // Add to new slot
        const effectiveRotation = draggedVideo.device_rotation ?? draggedVideo.rotation ?? null;
        newSlots[slotIndex] = { 
          ...newSlots[slotIndex], 
          video: { ...draggedVideo },
          advertisement: null,
          content_type: "video",
          rotation: effectiveRotation,
        };
        return newSlots;
      });
      setDraggedVideo(null);
    } else if (draggedAd) {
      setSlots(prev => {
        const newSlots = [...prev];
        // Remove ad from old slot if exists
        newSlots.forEach((slot, i) => {
          if (slot.advertisement?.ad_name === draggedAd.ad_name) {
            newSlots[i] = { ...slot, advertisement: null, content_type: "video" };
          }
        });
        // Add to new slot
        const effectiveRotation = draggedAd.rotation ?? null;
        newSlots[slotIndex] = { 
          ...newSlots[slotIndex], 
          advertisement: { ...draggedAd },
          video: null,
          content_type: "image",
          rotation: effectiveRotation,
        };
        return newSlots;
      });
      setDraggedAd(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const removeFromSlot = (slotIndex) => {
    setSlots(prev => {
      const newSlots = [...prev];
      newSlots[slotIndex] = { ...newSlots[slotIndex], video: null, advertisement: null, content_type: "video" };
      return newSlots;
    });
  };

  const updateSlotRotation = (slotIndex, rotation) => {
    setSlots(prev => {
      const newSlots = [...prev];
      newSlots[slotIndex] = { ...newSlots[slotIndex], rotation };
      return newSlots;
    });
  };

  // Save layout for a single device
  const saveLayoutForDevice = async (targetDeviceId, targetVideos) => {
    // Build layout config with content type support
    const layoutConfig = slots.map((slot, idx) => ({
      position: idx + 1,
      video_name: slot.video?.video_name || null,
      ad_name: slot.advertisement?.ad_name || null,
      content_type: slot.content_type || "video",
      rotation: slot.rotation,
    }));

    // Save layout - uses POST with layout_config as JSON string
    await axios.post(`${API_BASE}/device/${targetDeviceId}/layout`, {
      layout_mode: layoutMode,
      layout_config: JSON.stringify(layoutConfig),
    });

    // Update each link with grid_position and rotation using PUT
    // For the target device, we need to find the correct link_ids
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot.video?.video_name) {
        // Find the link for this video on the target device
        const targetVideo = targetVideos.find(v => v.video_name === slot.video.video_name);
        const linkId = targetVideo?.link_id || targetVideo?.id;
        if (linkId) {
          try {
            await axios.put(`${API_BASE}/link/${linkId}/settings`, {
              grid_position: i + 1,
              device_rotation: slot.rotation,
            });
          } catch (err) {
            console.warn(`Failed to update link ${linkId}:`, err);
          }
        }
      }
      // TODO: Handle advertisement links when backend supports it
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    
    try {
      await saveLayoutForDevice(deviceId, videos);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Save error:", err);
      // Handle different error formats
      let errorMsg = "Failed to save layout";
      if (err?.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === "string") {
          errorMsg = detail;
        } else if (Array.isArray(detail)) {
          errorMsg = detail.map(d => d.msg || JSON.stringify(d)).join(", ");
        } else if (typeof detail === "object") {
          errorMsg = detail.msg || JSON.stringify(detail);
        }
      }
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  // Apply layout to all devices in the group - also syncs videos
  const handleApplyToGroup = async () => {
    if (!confirmGroupApply) {
      setConfirmGroupApply(true);
      return;
    }

    setSavingGroup(true);
    setError("");
    setGroupApplyProgress({ current: 0, total: allGroupDevices.length });

    try {
      // First save the current device's layout
      await saveLayoutForDevice(deviceId, videos);
      
      // Get current layout config
      const layoutConfig = slots.map((slot, index) => ({
        position: index + 1,
        video_name: slot.video?.video_name || null,
        rotation: slot.rotation,
      }));

      // Use the new sync endpoint to apply videos + settings to all devices
      if (groupName) {
        try {
          const syncResponse = await axios.post(`${API_BASE}/group/${encodeURIComponent(groupName)}/sync-to-devices`, {
            source_mobile_id: deviceId,
            layout_mode: layoutMode,
            layout_config: JSON.stringify(layoutConfig),
          });
          
          const result = syncResponse.data;
          console.log("Group sync result:", result);
          
          if (result.devices_updated > 0) {
            setGroupApplyProgress({ current: result.devices_updated, total: result.devices_updated });
          }
          
          onSaved?.();
          onClose();
          return;
        } catch (syncErr) {
          console.warn("Group sync endpoint failed, falling back to individual updates:", syncErr);
          // Fall back to individual device updates
        }
      }

      // Fallback: Apply to each device individually
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < allGroupDevices.length; i++) {
        const device = allGroupDevices[i];
        setGroupApplyProgress({ current: i + 1, total: allGroupDevices.length });
        
        try {
          await saveLayoutForDevice(device.mobile_id, device.originals || []);
          successCount++;
        } catch (err) {
          console.warn(`Failed to apply layout to device ${device.mobile_id}:`, err);
          failCount++;
        }
      }

      if (failCount > 0) {
        setError(`Applied to ${successCount} devices, failed on ${failCount} devices`);
      }
      
      onSaved?.();
      if (failCount === 0) {
        onClose();
      }
    } catch (err) {
      console.error("Group apply error:", err);
      setError("Failed to apply layout to group");
    } finally {
      setSavingGroup(false);
      setConfirmGroupApply(false);
      setGroupApplyProgress({ current: 0, total: 0 });
    }
  };

  const handleLayoutModeChange = useCallback((newMode) => {
    setLayoutMode(newMode);
  }, []);

  // Reset confirmation when closing
  useEffect(() => {
    if (!open) {
      setConfirmGroupApply(false);
    }
  }, [open]);

  if (!open) return null;

  const assignedVideoNames = new Set(slots.filter(s => s.video).map(s => s.video.video_name));
  const assignedAdNames = new Set(slots.filter(s => s.advertisement).map(s => s.advertisement.ad_name));
  const availableVideos = videosOnlyFiltered.filter(v => !assignedVideoNames.has(v.video_name));
  const availableAds = allAdvertisements.filter(a => !assignedAdNames.has(a.ad_name));
  const { width: resW, height: resH } = parseResolution(deviceResolution);
  const aspectRatio = resW / resH;
  const preset = LAYOUT_PRESETS[layoutMode] || LAYOUT_PRESETS.single;
  const numSlots = preset.slots;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.6)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10000,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        width: "95%",
        maxWidth: 1100,
        maxHeight: "95vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>📐 Grid Layout Editor</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.9 }}>
              Device: {deviceId} {groupName && `• Group: ${groupName}`}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              borderRadius: 8,
              width: 36,
              height: 36,
              cursor: "pointer",
              color: "#fff",
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {loadingState ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
              Loading device settings...
            </div>
          ) : (
            <div style={{ display: "flex", gap: 24 }}>
              {/* Left Panel - Layout Selection & Preview */}
              <div style={{ flex: 1 }}>
                {/* Layout Mode Selection */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                    SELECT LAYOUT
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {Object.entries(LAYOUT_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => handleLayoutModeChange(key)}
                        style={{
                          padding: "12px 8px",
                          borderRadius: 10,
                          border: layoutMode === key ? "2px solid #3b82f6" : "2px solid #e5e7eb",
                          background: layoutMode === key ? "#eff6ff" : "#fff",
                          cursor: "pointer",
                          textAlign: "center",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ fontSize: 24, marginBottom: 4 }}>{preset.icon}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{preset.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid Preview */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                    PREVIEW (Drag videos here)
                  </div>
                  <div
                    style={{
                      background: "#1f2937",
                      borderRadius: 12,
                      padding: 8,
                      aspectRatio: aspectRatio,
                      maxHeight: 350,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {renderGridPreview()}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8, textAlign: "center" }}>
                    Resolution: {resW} × {resH} ({aspectRatio > 1 ? "Landscape" : aspectRatio < 1 ? "Portrait" : "Square"})
                  </div>
                </div>

                {error && (
                  <div style={{
                    padding: "12px 16px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    color: "#dc2626",
                    fontSize: 13,
                    marginBottom: 16,
                  }}>
                    {error}
                  </div>
                )}
              </div>

              {/* Right Panel - Video List & Rotation Controls */}
              <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Content Type Tabs */}
                <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb" }}>
                  <button
                    onClick={() => setContentTab("video")}
                    style={{
                      padding: "10px 16px",
                      border: "none",
                      background: contentTab === "video" ? "#3b82f6" : "transparent",
                      color: contentTab === "video" ? "#fff" : "#6b7280",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      borderRadius: "6px 6px 0 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    🎬 Videos ({availableVideos.length})
                  </button>
                  <button
                    onClick={() => setContentTab("image")}
                    style={{
                      padding: "10px 16px",
                      border: "none",
                      background: contentTab === "image" ? "#10b981" : "transparent",
                      color: contentTab === "image" ? "#fff" : "#6b7280",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      borderRadius: "6px 6px 0 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    🖼️ Images ({availableAds.length})
                  </button>
                </div>

                {/* Available Videos */}
                {contentTab === "video" && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                      AVAILABLE VIDEOS ({availableVideos.length})
                    </div>
                    <div style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      maxHeight: 200,
                      overflowY: "auto",
                    }}>
                      {availableVideos.length === 0 ? (
                        <div style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
                          All videos assigned to slots
                        </div>
                      ) : (
                        availableVideos.map((video, idx) => (
                          <div
                            key={video.video_name || idx}
                            draggable
                            onDragStart={(e) => handleDragStart(e, video)}
                            style={{
                              padding: "10px 12px",
                              borderBottom: "1px solid #f3f4f6",
                              cursor: "grab",
                              background: "#fff",
                              transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
                          >
                            <div style={{ 
                              fontSize: 12, 
                              fontWeight: 600, 
                              color: "#374151",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }} title={video.video_name}>
                              🎬 {video.video_name}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Available Advertisements/Images */}
                {contentTab === "image" && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#166534", marginBottom: 10 }}>
                      AVAILABLE IMAGES ({availableAds.length})
                    </div>
                    <div style={{
                      border: "1px solid #bbf7d0",
                      borderRadius: 8,
                      maxHeight: 200,
                      overflowY: "auto",
                      background: "#f0fdf4",
                    }}>
                      {availableAds.length === 0 ? (
                        <div style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
                          No advertisements available. Upload images in the Advertisements section.
                        </div>
                      ) : (
                        availableAds.map((ad, idx) => (
                          <div
                            key={ad.ad_name || idx}
                            draggable
                            onDragStart={(e) => handleAdDragStart(e, ad)}
                            style={{
                              padding: "10px 12px",
                              borderBottom: "1px solid #dcfce7",
                              cursor: "grab",
                              background: "#f0fdf4",
                              transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#dcfce7"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "#f0fdf4"}
                          >
                            <div style={{ 
                              fontSize: 12, 
                              fontWeight: 600, 
                              color: "#166534",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }} title={ad.ad_name}>
                              🖼️ {ad.ad_name}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Slot rotation controls */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                    SLOT SETTINGS ({numSlots} slots)
                  </div>
                  <div style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    maxHeight: 250,
                    overflowY: "auto",
                  }}>
                    {slots.map((slot, idx) => {
                      const hasContent = slot.video || slot.advertisement;
                      const contentName = slot.video?.video_name || slot.advertisement?.ad_name || "(empty)";
                      const isImage = slot.content_type === "image" || slot.advertisement;
                      
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: "10px 12px",
                            borderBottom: "1px solid #f3f4f6",
                            background: hasContent ? (isImage ? "#f0fdf4" : "#eff6ff") : "#f9fafb",
                          }}
                        >
                          <div style={{ 
                            fontSize: 12, 
                            fontWeight: 600, 
                            color: "#374151", 
                            marginBottom: 6,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}>
                            <span style={{
                              background: hasContent ? (isImage ? "#22c55e" : "#3b82f6") : "#d1d5db",
                              color: "#fff",
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}>
                              S{idx + 1}
                            </span>
                            <span style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: isImage ? "#dcfce7" : "#dbeafe",
                              color: isImage ? "#166534" : "#1e40af",
                              flexShrink: 0,
                            }}>
                              {isImage ? "🖼️" : "🎬"}
                            </span>
                            <span style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                              minWidth: 0,
                            }} title={contentName}>
                              {contentName}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>Rotation:</span>
                            <select
                              value={slot.rotation ?? ""}
                              onChange={(e) => updateSlotRotation(idx, e.target.value === "" ? null : parseInt(e.target.value))}
                              disabled={!hasContent}
                              style={{
                                flex: 1,
                                padding: "4px 8px",
                                borderRadius: 6,
                                border: "1px solid #e5e7eb",
                                fontSize: 12,
                                background: hasContent ? "#fff" : "#f3f4f6",
                                minWidth: 0,
                              }}
                            >
                              {ROTATIONS.map(r => (
                                <option key={r.label} value={r.value ?? ""}>{r.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}>
          {/* Left side - Group apply button */}
          <div>
            {allGroupDevices.length > 1 && (
              confirmGroupApply ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
                    Apply to {allGroupDevices.length} devices?
                  </span>
                  <button
                    onClick={handleApplyToGroup}
                    disabled={savingGroup}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: "#dc2626",
                      color: "#fff",
                      cursor: savingGroup ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                      opacity: savingGroup ? 0.7 : 1,
                    }}
                  >
                    {savingGroup 
                      ? `Applying ${groupApplyProgress.current}/${groupApplyProgress.total}...` 
                      : "Yes, Apply to All"}
                  </button>
                  <button
                    onClick={() => setConfirmGroupApply(false)}
                    disabled={savingGroup}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmGroupApply(true)}
                  disabled={saving || savingGroup}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "2px solid #f97316",
                    background: "#fff7ed",
                    color: "#ea580c",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  title={`Apply this layout to all ${allGroupDevices.length} devices in the group`}
                >
                  📋 Apply to Group ({allGroupDevices.length} devices)
                </button>
              )
            )}
          </div>

          {/* Right side - Cancel and Save buttons */}
          <div style={{ display: "flex", gap: 12 }}>
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
              disabled={saving || savingGroup}
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
              {saving ? "Saving..." : "Save Layout"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  function renderGridPreview() {
    const preset = LAYOUT_PRESETS[layoutMode] || LAYOUT_PRESETS.single;
    
    switch (layoutMode) {
      case "single":
        return <SlotBox slot={slots[0]} index={0} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />;
      
      case "split_h":
        return (
          <div style={{ flex: 1, display: "flex", gap: 4 }}>
            <SlotBox slot={slots[0]} index={0} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
            <SlotBox slot={slots[1]} index={1} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
          </div>
        );
      
      case "split_v":
        return (
          <>
            <SlotBox slot={slots[0]} index={0} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
            <SlotBox slot={slots[1]} index={1} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
          </>
        );
      
      case "grid_3":
        return (
          <>
            <div style={{ flex: 1, display: "flex", gap: 4 }}>
              <SlotBox slot={slots[0]} index={0} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
              <SlotBox slot={slots[1]} index={1} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
            </div>
            <SlotBox slot={slots[2]} index={2} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
          </>
        );
      
      case "grid_4":
        return (
          <>
            <div style={{ flex: 1, display: "flex", gap: 4 }}>
              <SlotBox slot={slots[0]} index={0} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
              <SlotBox slot={slots[1]} index={1} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
            </div>
            <div style={{ flex: 1, display: "flex", gap: 4 }}>
              <SlotBox slot={slots[2]} index={2} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
              <SlotBox slot={slots[3]} index={3} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
            </div>
          </>
        );
      
      case "grid_1x4":
        return (
          <>
            <SlotBox slot={slots[0]} index={0} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
            <SlotBox slot={slots[1]} index={1} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
            <SlotBox slot={slots[2]} index={2} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
            <SlotBox slot={slots[3]} index={3} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />
          </>
        );
      
      default:
        return <SlotBox slot={slots[0]} index={0} onDrop={handleDrop} onDragOver={handleDragOver} onRemove={removeFromSlot} />;
    }
  }
}

// Slot component for grid preview
function SlotBox({ slot, index, onDrop, onDragOver, onRemove }) {
  const hasContent = slot?.video || slot?.advertisement;
  const contentName = slot?.video?.video_name || slot?.advertisement?.ad_name;
  const isImage = slot?.content_type === "image" || slot?.advertisement;
  
  return (
    <div
      onDrop={(e) => onDrop(e, index)}
      onDragOver={onDragOver}
      style={{
        flex: 1,
        background: hasContent 
          ? (isImage 
              ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" 
              : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)")
          : "#374151",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: 11,
        padding: 8,
        position: "relative",
        transition: "all 0.2s",
        minHeight: 60,
        overflow: "hidden",
      }}
    >
      {hasContent ? (
        <>
          <div style={{ 
            fontSize: 16, 
            marginBottom: 4,
          }}>
            {isImage ? "🖼️" : "🎬"}
          </div>
          <div style={{ 
            fontWeight: 700, 
            textAlign: "center", 
            fontSize: 10,
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            padding: "0 20px",
          }} title={contentName}>
            {contentName}
          </div>
          <div style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>
            {slot.rotation != null ? `${slot.rotation}°` : "Default"}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(index); }}
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              background: "rgba(0,0,0,0.4)",
              border: "none",
              color: "#fff",
              width: 18,
              height: 18,
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </>
      ) : (
        <div style={{ opacity: 0.5, textAlign: "center" }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>+</div>
          <div>Slot {index + 1}</div>
        </div>
      )}
    </div>
  );
}

export default GridLayoutEditor;
