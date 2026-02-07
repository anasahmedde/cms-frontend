// src/components/Shop.js - Enhanced Modern UI
import React, { useEffect, useState } from "react";
import { insertShop, listShops, updateShop, deleteShop } from "../api/shop";

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
};

/* ======================== Modal ======================== */
function Modal({ open, title, onClose, children, footer }) {
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
          width: "min(95vw, 480px)",
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
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
        <div style={{ padding: 20 }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
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
export default function Shop() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState(null);
  
  // Expanded shop to show devices
  const [expandedShop, setExpandedShop] = useState(null);
  const [shopDevices, setShopDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listShops(50, 0);
      setItems(res.items || []);
    } catch (e) {
      console.error("Failed to load shops:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Load devices when shop is expanded
  const toggleExpand = async (shopName) => {
    if (expandedShop === shopName) {
      setExpandedShop(null);
      setShopDevices([]);
      return;
    }
    
    setExpandedShop(shopName);
    setLoadingDevices(true);
    try {
      // Use main API for the shop devices endpoint
      const API_BASE = process.env.REACT_APP_API_BASE_URL || "https://api-staging-cms.wizioners.com";
      const res = await fetch(
        `${API_BASE}/shop/${encodeURIComponent(shopName)}/devices`
      );
      if (res.ok) {
        const data = await res.json();
        setShopDevices(data.devices || []);
      } else {
        setShopDevices([]);
      }
    } catch (e) {
      console.error("Failed to load shop devices:", e);
      setShopDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  };

  const add = async () => {
    if (!name.trim()) return;
    await insertShop({ shop_name: name.trim() });
    setName("");
    load();
  };

  const openRename = (shop_name) => {
    setEdit({ current: shop_name, newName: shop_name });
  };

  const saveRename = async () => {
    if (!edit || !edit.newName.trim()) return;
    await updateShop(edit.current, { shop_name: edit.newName.trim() });
    setEdit(null);
    load();
  };

  const remove = async (shop_name) => {
    if (!window.confirm(`Delete shop "${shop_name}"?`)) return;
    await deleteShop(shop_name);
    load();
  };

  const filteredItems = items.filter((it) =>
    (it.shop_name || "").toLowerCase().includes((q || "").toLowerCase())
  );

  return (
    <div>
      {/* Add New Shop */}
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
          placeholder="Enter new shop name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button style={styles.btnPrimary} onClick={add}>
          ➕ Add Shop
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          style={styles.input}
          placeholder="🔍 Search shops..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Shops List */}
      <div style={{ display: "grid", gap: 12 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
            Loading shops...
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏪</div>
            <div style={{ color: "#64748b" }}>No shops found</div>
          </div>
        ) : (
          filteredItems.map((it) => (
            <div key={it.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  background: expandedShop === it.shop_name ? "#f0f9ff" : "#fff",
                  border: expandedShop === it.shop_name ? "2px solid #0ea5e9" : "2px solid #f1f5f9",
                  borderRadius: expandedShop === it.shop_name ? "12px 12px 0 0" : 12,
                  transition: "all 0.2s",
                  cursor: "pointer",
                }}
                onClick={() => toggleExpand(it.shop_name)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ 
                    fontSize: 12, 
                    color: "#64748b",
                    transform: expandedShop === it.shop_name ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}>▶</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: "#1e293b" }}>
                      🏪 {it.shop_name}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                      ID: {it.id}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                  <button style={styles.btn} onClick={() => openRename(it.shop_name)}>
                    ✏️ Edit
                  </button>
                  <button style={styles.btnDanger} onClick={() => remove(it.shop_name)}>
                    🗑️
                  </button>
                </div>
              </div>
              {/* Expanded section showing devices */}
              {expandedShop === it.shop_name && (
                <div style={{
                  padding: "16px 20px",
                  background: "#f0f9ff",
                  border: "2px solid #0ea5e9",
                  borderTop: "none",
                  borderRadius: "0 0 12px 12px",
                }}>
                  <div style={{ 
                    padding: 16, 
                    background: "#fff", 
                    borderRadius: 8,
                    border: "1px solid #e0f2fe",
                  }}>
                    <div style={{ 
                      fontSize: 13, 
                      fontWeight: 600, 
                      color: "#0369a1", 
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      📱 Associated Devices
                    </div>
                    {loadingDevices ? (
                      <div style={{ color: "#64748b", fontSize: 13 }}>Loading devices...</div>
                    ) : shopDevices.length === 0 ? (
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>
                        No devices associated with this shop
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {shopDevices.map((d) => (
                          <div
                            key={d.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 14px",
                              background: "#f8fafc",
                              borderRadius: 8,
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>
                                {d.device_name || d.mobile_id}
                              </div>
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                ID: {d.mobile_id}
                              </div>
                            </div>
                            {d.group_name && (
                              <span style={{
                                padding: "4px 10px",
                                background: "#dbeafe",
                                color: "#1e40af",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 500,
                              }}>
                                {d.group_name}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Rename Modal */}
      <Modal
        open={!!edit}
        title="✏️ Rename Shop"
        onClose={() => setEdit(null)}
        footer={
          <>
            <button style={styles.btn} onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button style={styles.btnPrimary} onClick={saveRename}>
              Save Changes
            </button>
          </>
        }
      >
        {edit && (
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: 13, color: "#64748b" }}>
                Current Name
              </label>
              <input style={{ ...styles.input, background: "#f8fafc" }} value={edit.current} disabled />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: 13, color: "#374151" }}>
                New Name
              </label>
              <input
                autoFocus
                style={styles.input}
                value={edit.newName}
                onChange={(e) => setEdit((x) => ({ ...x, newName: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && saveRename()}
                placeholder="e.g. Downtown Mart"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
