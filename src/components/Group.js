// src/components/Group.js - Enhanced with Videos/Devices Display
import React, { useEffect, useState } from "react";
import { insertGroup, listGroups, updateGroup, deleteGroup, getGroupAttachments, unassignDevicesFromGroup,
         getGroupHeaderFooter, setGroupHeaderFooter, uploadGroupFooterImage } from "../api/group";
import HeaderFooterEditor, { DEFAULT_HEADER_STYLE, DEFAULT_FOOTER_STYLE } from "./HeaderFooterEditor";

/* ======================== Styles ======================== */
const styles = {
  input: {
    padding: "12px 16px",
    borderRadius: 10,
    border: "2px solid #e5e7eb",
    fontSize: 14,
    outline: "none",
    width: "100%",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  btn: {
    padding: "12px 20px",
    borderRadius: 10,
    border: "none",
    background: "#f1f5f9",
    color: "#475569",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    transition: "all 0.2s",
  },
  btnPrimary: {
    padding: "12px 20px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    boxShadow: "0 2px 8px rgba(102, 126, 234, 0.3)",
    transition: "all 0.2s",
  },
  btnDanger: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    background: "#fee2e2",
    color: "#dc2626",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    transition: "all 0.2s",
  },
  btnWarning: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#fef3c7",
    color: "#d97706",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    transition: "all 0.2s",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
};

/* ======================== Modal ======================== */
function Modal({ open, title, onClose, children, footer, width = 480 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(95vw, ${width}px)`,
          maxHeight: "90vh",
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 600 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "none",
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ======================== Main Component ======================== */
export default function Group() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [gname, setGname] = useState("");
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [attachments, setAttachments] = useState({});
  const [loadingAttachments, setLoadingAttachments] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Header/footer is configured on the GROUP; devices inherit it.
  const [newHeaderEnabled, setNewHeaderEnabled] = useState(false);
  const [newFooterEnabled, setNewFooterEnabled] = useState(false);

  // Header/footer fields, edited inside the group's Edit modal
  const [hfSaving, setHfSaving] = useState(false);
  const [hfError, setHfError] = useState("");
  const [hfHeaderEnabled, setHfHeaderEnabled] = useState(false);
  const [hfHeaderText, setHfHeaderText] = useState("");
  const [hfFooterEnabled, setHfFooterEnabled] = useState(false);
  const [hfFooterImageUrl, setHfFooterImageUrl] = useState("");
  const [hfFooterFile, setHfFooterFile] = useState(null);
  const [hfHeaderStyle, setHfHeaderStyle] = useState({ ...DEFAULT_HEADER_STYLE });
  const [hfFooterStyle, setHfFooterStyle] = useState({ ...DEFAULT_FOOTER_STYLE });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listGroups(50, 0);
      setItems(res.items || []);
    } catch (e) {
      console.error("Failed to load groups:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const add = async () => {
    const name = gname.trim();
    if (!name) return;
    await insertGroup({ gname: name });

    // Persist the header/footer choices made at creation time. insertGroup doesn't
    // return the new id, so re-read the list and find it by name.
    if (newHeaderEnabled || newFooterEnabled) {
      try {
        const res = await listGroups(200, 0);
        const created = (res.items || []).find((g) => g.gname === name);
        if (created?.id) {
          await setGroupHeaderFooter(created.id, {
            header_enabled: newHeaderEnabled,
            footer_enabled: newFooterEnabled,
          });
        }
      } catch (_) { /* non-fatal */ }
    }

    setGname("");
    setNewHeaderEnabled(false);
    setNewFooterEnabled(false);
    load();
  };

  // Edit a group = rename + its header/footer (which all its devices inherit)
  const openEdit = async (g) => {
    setEdit({ id: g.id, current: g.gname, newName: g.gname });
    setHfError("");

    setHfHeaderEnabled(false); setHfFooterEnabled(false);
    setHfHeaderText(""); setHfFooterImageUrl(""); setHfFooterFile(null);
    setHfHeaderStyle({ ...DEFAULT_HEADER_STYLE });
    setHfFooterStyle({ ...DEFAULT_FOOTER_STYLE });

    const res = await getGroupHeaderFooter(g.id);
    if (res.ok) {
      const d = res.data || {};
      setHfHeaderEnabled(!!d.header_enabled);
      setHfFooterEnabled(!!d.footer_enabled);
      setHfHeaderText(d.header_text || "");
      setHfFooterImageUrl(d.footer_image_url || "");
      const st = d.style || {};
      setHfHeaderStyle({ ...DEFAULT_HEADER_STYLE, ...(st.header || {}) });
      setHfFooterStyle({ ...DEFAULT_FOOTER_STYLE, ...(st.footer || {}) });
    }
  };

  const saveEdit = async () => {
    if (!edit || !edit.newName.trim()) return;
    setHfSaving(true);
    setHfError("");

    if (edit.newName.trim() !== edit.current) {
      await updateGroup(edit.current, { gname: edit.newName.trim() });
    }

    if (!edit.id) {
      setHfError("Cannot save header/footer: this group has no id.");
      setHfSaving(false);
      return;
    }

    // Surface failures instead of silently doing nothing.
    const res = await setGroupHeaderFooter(edit.id, {
      header_enabled: hfHeaderEnabled,
      footer_enabled: hfFooterEnabled,
      header_text: hfHeaderText || null,
      style: { header: hfHeaderStyle, footer: hfFooterStyle },
    });
    if (!res.ok) {
      setHfError(`Failed to save header/footer: ${res.error}`);
      setHfSaving(false);
      return;
    }

    if (hfFooterFile) {
      const up = await uploadGroupFooterImage(edit.id, hfFooterFile);
      if (!up.ok) {
        setHfError(`Header/footer saved, but the footer image upload failed: ${up.error}`);
        setHfSaving(false);
        return;
      }
    }

    setHfSaving(false);
    setEdit(null);
    load();
  };

  const loadAttachments = async (groupName, forceRefresh = false) => {
    if (!forceRefresh && attachments[groupName] && !loadingAttachments[groupName]) {
      return attachments[groupName];
    }
    
    setLoadingAttachments((prev) => ({ ...prev, [groupName]: true }));
    try {
      const res = await getGroupAttachments(groupName);
      if (res.ok) {
        setAttachments((prev) => ({ ...prev, [groupName]: res.data }));
        return res.data;
      }
    } catch (e) {
      console.error("Failed to load attachments:", e);
    } finally {
      setLoadingAttachments((prev) => ({ ...prev, [groupName]: false }));
    }
    return null;
  };

  const toggleExpand = async (groupName) => {
    if (expandedGroup === groupName) {
      setExpandedGroup(null);
    } else {
      setExpandedGroup(groupName);
      // Always force refresh when expanding to get latest data
      await loadAttachments(groupName, true);
    }
  };

  const remove = async (name) => {
    // First check for attachments
    const att = await loadAttachments(name);
    
    if (att && att.device_count > 0) {
      // Show delete confirmation modal with device info
      setDeleteConfirm({
        groupName: name,
        devices: att.devices || [],
        videos: att.videos || [],
        device_count: att.device_count,
        video_count: att.video_count,
      });
      return;
    }
    
    // No devices attached, proceed with simple delete
    if (!window.confirm(`Delete group "${name}"?`)) return;
    const res = await deleteGroup(name);
    if (!res.ok) {
      // Handle linked resources (new 409 format)
      if (res.error === "has_linked_resources" && res.linked) {
        const parts = Object.entries(res.linked).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`);
        if (window.confirm(`Group "${name}" has linked resources:\n${parts.join('\n')}\n\nUnlink everything and force delete?`)) {
          const res2 = await deleteGroup(name, true);
          if (!res2.ok) alert(`Force delete failed: ${res2.error || res2.message}`);
          load();
          return;
        }
        return;
      }
      // Handle legacy devices_attached format
      if (res.error === "devices_attached") {
        setDeleteConfirm({ groupName: name });
        return;
      }
      alert(`Failed to delete: ${res.message || res.error}`);
    }
    load();
  };

  const handleForceDelete = async () => {
    if (!deleteConfirm) return;
    
    const res = await deleteGroup(deleteConfirm.groupName, true);
    if (res.ok) {
      setDeleteConfirm(null);
      // Clear cached attachments
      setAttachments((prev) => {
        const newAtt = { ...prev };
        delete newAtt[deleteConfirm.groupName];
        return newAtt;
      });
      load();
    } else {
      alert(`Failed to delete: ${res.error || res.message}`);
    }
  };

  const handleUnassignOnly = async () => {
    if (!deleteConfirm) return;
    
    const res = await unassignDevicesFromGroup(deleteConfirm.groupName);
    if (res.ok) {
      alert(`Unassigned ${res.data.unassigned_count} device(s) from group "${deleteConfirm.groupName}"`);
      setDeleteConfirm(null);
      // Clear cached attachments
      setAttachments((prev) => {
        const newAtt = { ...prev };
        delete newAtt[deleteConfirm.groupName];
        return newAtt;
      });
      load();
    } else {
      alert(`Failed to unassign: ${res.error}`);
    }
  };

  const filteredItems = items.filter((it) =>
    (it.gname || "").toLowerCase().includes((q || "").toLowerCase())
  );

  return (
    <div>
      {/* Add New Group */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
          padding: 20,
          background: "#f8fafc",
          borderRadius: 16,
        }}
      >
        <input
          style={{ ...styles.input, flex: 1 }}
          placeholder="Enter new group name..."
          value={gname}
          onChange={(e) => setGname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        {/* Header/footer is a GROUP setting — devices in the group inherit it */}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={newHeaderEnabled}
            onChange={(e) => setNewHeaderEnabled(e.target.checked)} style={{ width: 16, height: 16 }} />
          Enable Header <span style={{ color: "#9ca3af" }}>(text)</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={newFooterEnabled}
            onChange={(e) => setNewFooterEnabled(e.target.checked)} style={{ width: 16, height: 16 }} />
          Enable Footer <span style={{ color: "#9ca3af" }}>(image)</span>
        </label>
        <button style={styles.btnPrimary} onClick={add}>
          ➕ Add Group
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          style={styles.input}
          placeholder="🔍 Search groups..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Groups List */}
      <div style={{ display: "grid", gap: 12 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
            Loading groups...
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
            <div style={{ color: "#64748b" }}>No groups found</div>
          </div>
        ) : (
          filteredItems.map((it) => {
            const isExpanded = expandedGroup === it.gname;
            const att = attachments[it.gname];
            const isLoadingAtt = loadingAttachments[it.gname];
            
            return (
              <div
                key={it.id}
                style={{
                  background: "#fff",
                  border: isExpanded ? "2px solid #667eea" : "2px solid #f1f5f9",
                  borderRadius: 12,
                  transition: "all 0.2s",
                  overflow: "hidden",
                }}
              >
                {/* Group Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleExpand(it.gname)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 20 }}>{isExpanded ? "📂" : "📁"}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16, color: "#1e293b" }}>
                        {it.gname}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                        ID: {it.id} • Click to {isExpanded ? "collapse" : "view details"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {/* Quick badges if we have attachment data */}
                    {att && (
                      <>
                        <span style={{ ...styles.badge, background: "#dbeafe", color: "#2563eb" }}>
                          🎬 {att.video_count}
                        </span>
                        <span style={{ ...styles.badge, background: "#dcfce7", color: "#16a34a" }}>
                          📱 {att.device_count}
                        </span>
                      </>
                    )}
                    <button
                      style={styles.btn}
                      title="Rename + set this group's header/footer"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(it);
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      style={styles.btnDanger}
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(it.gname);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div
                    style={{
                      padding: "0 20px 20px",
                      borderTop: "1px solid #f1f5f9",
                      background: "#fafbfc",
                    }}
                  >
                    {isLoadingAtt ? (
                      <div style={{ padding: 20, textAlign: "center", color: "#64748b" }}>
                        Loading attachments...
                      </div>
                    ) : att ? (
                      <div style={{ display: "grid", gap: 16, paddingTop: 16 }}>
                        {/* Videos Section */}
                        <div>
                          <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#475569", display: "flex", alignItems: "center", gap: 8 }}>
                            🎬 Videos ({att.video_count})
                          </h4>
                          {att.videos.length === 0 ? (
                            <div style={{ padding: "12px 16px", background: "#fff", borderRadius: 8, color: "#94a3b8", fontSize: 13 }}>
                              No videos linked to this group
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {att.videos.map((v) => (
                                <span
                                  key={v.id}
                                  style={{
                                    padding: "8px 14px",
                                    background: "#fff",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 8,
                                    fontSize: 13,
                                    color: "#374151",
                                  }}
                                >
                                  🎥 {v.video_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Advertisements/Images Section */}
                        <div>
                          <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#166534", display: "flex", alignItems: "center", gap: 8 }}>
                            🖼️ Images ({att.advertisement_count || 0})
                          </h4>
                          {(!att.advertisements || att.advertisements.length === 0) ? (
                            <div style={{ padding: "12px 16px", background: "#f0fdf4", borderRadius: 8, color: "#94a3b8", fontSize: 13 }}>
                              No images linked to this group
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {att.advertisements.map((a) => (
                                <span
                                  key={a.id}
                                  style={{
                                    padding: "8px 14px",
                                    background: "#f0fdf4",
                                    border: "1px solid #bbf7d0",
                                    borderRadius: 8,
                                    fontSize: 13,
                                    color: "#166534",
                                  }}
                                >
                                  🖼️ {a.ad_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Devices Section */}
                        <div>
                          <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#475569", display: "flex", alignItems: "center", gap: 8 }}>
                            📱 Devices ({att.device_count})
                          </h4>
                          {att.devices.length === 0 ? (
                            <div style={{ padding: "12px 16px", background: "#fff", borderRadius: 8, color: "#94a3b8", fontSize: 13 }}>
                              No devices assigned to this group
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {att.devices.map((d) => (
                                <span
                                  key={d.id}
                                  style={{
                                    padding: "8px 14px",
                                    background: "#fff",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 8,
                                    fontSize: 13,
                                    color: "#374151",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2,
                                  }}
                                >
                                  <span style={{ fontWeight: 600 }}>
                                    📱 {d.device_name || "Unnamed Device"}
                                  </span>
                                  <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
                                    ID: {d.mobile_id}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 20, textAlign: "center", color: "#ef4444" }}>
                        Failed to load attachments
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit Group Modal — rename + header/footer (all its devices inherit it) */}
      <Modal
        open={!!edit}
        title={`✏️ Edit Group${edit?.current ? " — " + edit.current : ""}`}
        onClose={() => setEdit(null)}
        footer={
          <>
            <button style={styles.btn} onClick={() => setEdit(null)} disabled={hfSaving}>
              Cancel
            </button>
            <button style={styles.btnPrimary} onClick={saveEdit} disabled={hfSaving}>
              {hfSaving ? "Saving..." : "Save Changes"}
            </button>
          </>
        }
      >
        {edit && (
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: 13, color: "#374151" }}>
                Group Name
              </label>
              <input
                autoFocus
                style={styles.input}
                value={edit.newName}
                onChange={(e) => setEdit((x) => ({ ...x, newName: e.target.value }))}
                placeholder="e.g. North Region"
              />
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Header &amp; Footer</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                Applies to <strong>every device in this group</strong>. A device can opt out via
                “Override group settings” in its Edit screen.
              </div>
              {hfError && (
                <div style={{
                  padding: "10px 12px", background: "#fee2e2", border: "1px solid #fecaca",
                  borderRadius: 8, color: "#dc2626", fontSize: 13, marginBottom: 12,
                }}>
                  {hfError}
                </div>
              )}
              <HeaderFooterEditor
                headerEnabled={hfHeaderEnabled} setHeaderEnabled={setHfHeaderEnabled}
                headerText={hfHeaderText} setHeaderText={setHfHeaderText}
                footerEnabled={hfFooterEnabled} setFooterEnabled={setHfFooterEnabled}
                footerImageUrl={hfFooterImageUrl}
                footerFile={hfFooterFile} setFooterFile={setHfFooterFile}
                headerStyle={hfHeaderStyle} setHeaderStyle={setHfHeaderStyle}
                footerStyle={hfFooterStyle} setFooterStyle={setHfFooterStyle}
              />
            </div>
          </div>
        )}
      </Modal>


      {/* Delete Confirmation Modal (for groups with devices) */}
      <Modal
        open={!!deleteConfirm}
        title="⚠️ Cannot Delete Group"
        onClose={() => setDeleteConfirm(null)}
        width={560}
        footer={
          <>
            <button style={styles.btn} onClick={() => setDeleteConfirm(null)}>
              Cancel
            </button>
            <button style={styles.btnWarning} onClick={handleUnassignOnly}>
              Unassign Devices Only
            </button>
            <button style={styles.btnDanger} onClick={handleForceDelete}>
              Unassign & Delete Group
            </button>
          </>
        }
      >
        {deleteConfirm && (
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                padding: 16,
                background: "#fef3c7",
                borderRadius: 12,
                border: "1px solid #fcd34d",
              }}
            >
              <p style={{ margin: 0, color: "#92400e", fontWeight: 500 }}>
                This group has <strong>{deleteConfirm.device_count} device(s)</strong> attached.
                You must unassign them before deleting.
              </p>
            </div>

            {/* Attached Devices */}
            {deleteConfirm.devices.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#475569" }}>
                  📱 Attached Devices ({deleteConfirm.device_count})
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {deleteConfirm.devices.map((d) => (
                    <span
                      key={d.id}
                      style={{
                        padding: "8px 12px",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "#dc2626",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        📱 {d.device_name || "Unnamed Device"}
                      </span>
                      <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>
                        {d.mobile_id}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Attached Videos */}
            {deleteConfirm.videos.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#475569" }}>
                  🎬 Linked Videos ({deleteConfirm.video_count})
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {deleteConfirm.videos.map((v) => (
                    <span
                      key={v.id}
                      style={{
                        padding: "8px 14px",
                        background: "#f0f9ff",
                        border: "1px solid #bae6fd",
                        borderRadius: 8,
                        fontSize: 13,
                        color: "#0369a1",
                      }}
                    >
                      🎥 {v.video_name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>
              <strong>Options:</strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                <li><strong>Unassign Devices Only</strong> — Removes devices from this group but keeps the group</li>
                <li><strong>Unassign & Delete</strong> — Removes devices and deletes the group</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
