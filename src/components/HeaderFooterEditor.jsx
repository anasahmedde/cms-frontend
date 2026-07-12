import React from "react";

// Shared header/footer controls, used by BOTH the Group config modal (where
// header/footer is primarily set) and the Device edit modal (per-device override).
//   Header = TEXT, Footer = IMAGE (uploaded to S3).
// All styling is one JSON blob so new options need no DB migration.

export const DEFAULT_HEADER_STYLE = {
  bgColor: "#000000", textColor: "#FFFFFF", fontSize: 22,
  fontFamily: "sans", bold: false, align: "center", rotation: 0,
};
export const DEFAULT_FOOTER_STYLE = {
  bgColor: "#000000", heightDp: 80, rotation: 0, scaleType: "fit",
};

const GRID = { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 };
const LBL = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", fontWeight: 600 };
const NUM = { width: 64, padding: "4px 6px", border: "1px solid #d1d5db", borderRadius: 6 };
const SEL = { padding: "4px 6px", border: "1px solid #d1d5db", borderRadius: 6 };
const TXT = {
  width: "100%", padding: "8px 10px", border: "1px solid #d1d5db",
  borderRadius: 8, minHeight: 60, resize: "vertical", boxSizing: "border-box",
};

export default function HeaderFooterEditor({
  headerEnabled, setHeaderEnabled,
  headerText, setHeaderText,
  footerEnabled, setFooterEnabled,
  footerImageUrl, footerFile, setFooterFile,
  headerStyle, setHeaderStyle,
  footerStyle, setFooterStyle,
  disabled = false,
}) {
  const hs = { ...DEFAULT_HEADER_STYLE, ...(headerStyle || {}) };
  const fs = { ...DEFAULT_FOOTER_STYLE, ...(footerStyle || {}) };
  const box = disabled ? { opacity: 0.5, pointerEvents: "none" } : undefined;

  return (
    <div style={box}>
      {/* ---- HEADER (text) ---- */}
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 6 }}>
        <input type="checkbox" checked={!!headerEnabled}
          onChange={(e) => setHeaderEnabled(e.target.checked)} style={{ width: 18, height: 18 }} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>Enable Header <span style={{ color: "#9ca3af", fontWeight: 400 }}>(text)</span></span>
      </label>

      {headerEnabled && (
        <div style={{ margin: "0 0 14px 28px" }}>
          <textarea value={headerText || ""} maxLength={500} style={TXT}
            onChange={(e) => setHeaderText(e.target.value)}
            placeholder="Header text shown at the top of the screen" />
          <div style={GRID}>
            <label style={LBL}>Background
              <input type="color" value={hs.bgColor}
                onChange={(e) => setHeaderStyle({ ...hs, bgColor: e.target.value })} /></label>
            <label style={LBL}>Text
              <input type="color" value={hs.textColor}
                onChange={(e) => setHeaderStyle({ ...hs, textColor: e.target.value })} /></label>
            <label style={LBL}>Size
              <input type="number" min="8" max="120" value={hs.fontSize} style={NUM}
                onChange={(e) => setHeaderStyle({ ...hs, fontSize: Number(e.target.value) || 22 })} /></label>
            <label style={LBL}>Font
              <select value={hs.fontFamily} style={SEL}
                onChange={(e) => setHeaderStyle({ ...hs, fontFamily: e.target.value })}>
                <option value="sans">Sans</option><option value="serif">Serif</option><option value="monospace">Mono</option>
              </select></label>
            <label style={LBL}>Align
              <select value={hs.align} style={SEL}
                onChange={(e) => setHeaderStyle({ ...hs, align: e.target.value })}>
                <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
              </select></label>
            <label style={LBL}>Rotation
              <select value={hs.rotation} style={SEL}
                onChange={(e) => setHeaderStyle({ ...hs, rotation: Number(e.target.value) })}>
                <option value={0}>0°</option><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option>
              </select></label>
            <label style={LBL}>
              <input type="checkbox" checked={!!hs.bold}
                onChange={(e) => setHeaderStyle({ ...hs, bold: e.target.checked })} /> Bold</label>
          </div>
        </div>
      )}

      {/* ---- FOOTER (image) ---- */}
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 6 }}>
        <input type="checkbox" checked={!!footerEnabled}
          onChange={(e) => setFooterEnabled(e.target.checked)} style={{ width: 18, height: 18 }} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>Enable Footer <span style={{ color: "#9ca3af", fontWeight: 400 }}>(image)</span></span>
      </label>

      {footerEnabled && (
        <div style={{ margin: "0 0 4px 28px" }}>
          {footerImageUrl && !footerFile && (
            <img src={footerImageUrl} alt="footer"
              style={{ maxHeight: 60, maxWidth: "100%", borderRadius: 6, marginBottom: 6, display: "block" }} />
          )}
          <input type="file" accept="image/*"
            onChange={(e) => setFooterFile(e.target.files?.[0] || null)} />
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
            {footerFile ? `Selected: ${footerFile.name}` : "Upload a footer image (shown at the bottom of the screen)."}
          </div>
          <div style={GRID}>
            <label style={LBL}>Background
              <input type="color" value={fs.bgColor}
                onChange={(e) => setFooterStyle({ ...fs, bgColor: e.target.value })} /></label>
            <label style={LBL}>Height
              <input type="number" min="20" max="600" value={fs.heightDp} style={NUM}
                onChange={(e) => setFooterStyle({ ...fs, heightDp: Number(e.target.value) || 80 })} /></label>
            <label style={LBL}>Rotation
              <select value={fs.rotation} style={SEL}
                onChange={(e) => setFooterStyle({ ...fs, rotation: Number(e.target.value) })}>
                <option value={0}>0°</option><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option>
              </select></label>
            <label style={LBL}>Fit
              <select value={fs.scaleType} style={SEL}
                onChange={(e) => setFooterStyle({ ...fs, scaleType: e.target.value })}>
                <option value="fit">Fit</option><option value="fill">Fill</option><option value="center">Center</option>
              </select></label>
          </div>
        </div>
      )}
    </div>
  );
}
