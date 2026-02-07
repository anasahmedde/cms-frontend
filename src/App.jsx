// App.jsx — 4 buttons with popups (no extra libraries)
import React, { useState, useEffect } from "react";
import Device from "./components/Device";
import Group from "./components/Group";
import Shop from "./components/Shop";
import Video from "./components/Video";

function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "grid",
    placeItems: "center",
    zIndex: 1000,
  };
  const card = {
    width: "min(92vw, 720px)",
    maxHeight: "80vh",
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 20px 50px rgba(0,0,0,.2)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };
  const header = {
    padding: "12px 16px",
    borderBottom: "1px solid #eee",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };
  const body = { padding: 16, overflow: "auto" };
  const closeBtn = {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <strong>{title}</strong>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={body}>{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [open, setOpen] = useState(null); // 'device' | 'group' | 'shop' | 'video' | null

  const btn = {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  };
  const toolbar = { display: "flex", gap: 12, flexWrap: "wrap" };

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 12 }}>FastAPI Admin</h1>

      <div style={toolbar}>
        <button style={btn} onClick={() => setOpen("device")}>Device</button>
        <button style={btn} onClick={() => setOpen("group")}>Group</button>
        <button style={btn} onClick={() => setOpen("shop")}>Shop</button>
        <button style={btn} onClick={() => setOpen("video")}>Video</button>
      </div>

      <Modal open={open === "device"} title="Device Management" onClose={() => setOpen(null)}>
        {/* Key forces fresh mount when reopened */}
        <Device key="device" />
      </Modal>

      <Modal open={open === "group"} title="Groups" onClose={() => setOpen(null)}>
        <Group key="group" />
      </Modal>

      <Modal open={open === "shop"} title="Shops" onClose={() => setOpen(null)}>
        <Shop key="shop" />
      </Modal>

      <Modal open={open === "video"} title="Videos" onClose={() => setOpen(null)}>
        <Video key="video" />
      </Modal>
    </div>
  );
}

