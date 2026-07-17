// A to-scale WYSIWYG preview of the resolved template — mirrors what a screen
// actually renders. Fed by GET /company/template/preview (resolved + presigned
// zones), so images/videos/text appear as they do on the device.
import React, { useEffect, useState } from "react";

function bgStyle(c = {}, st = {}) {
  const s = {};
  if (c.bg_image) {
    s.backgroundImage = `url('${String(c.bg_image).replace(/'/g, "%27")}')`;
    s.backgroundSize = "cover";
    s.backgroundPosition = "center";
  } else if (c.bg_gradient?.stops) {
    s.background = `linear-gradient(${c.bg_gradient.angle ?? 135}deg, ${c.bg_gradient.stops.join(", ")})`;
  } else {
    const col = c.bg_color || st.bg_color;
    if (col) s.background = col;
  }
  return s;
}

function Clock({ fmt }) {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      setT(fmt === "HH:mm:ss" ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [fmt]);
  return t;
}

// font_size_vh is a % of the ZONE height everywhere (same contract as the
// players); cqh/cqw resolve against the zone box (container-type: size below).
function ZoneContent({ z }) {
  const c = z.content || {};
  const st = z.style || {};
  const fit = st.fit_mode === "contain" ? "contain" : "cover";
  const textColor = c.text_color || st.text_color || "#fff";
  const fontSize = `min(${st.font_size_vh || 45}cqh, 40cqw)`;

  if ((z.type === "text" || z.type === "ticker") && Array.isArray(c.runs) && c.runs.length) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {c.runs.map((r, i) => (
          <div key={i} style={{
            position: "absolute", left: `${r.x || 0}%`, top: `${r.y || 0}%`,
            width: `${typeof r.w === "number" ? r.w : 100 - (r.x || 0)}%`,
            color: r.text_color || "#fff", fontSize: `min(${r.font_size_vh || 20}cqh, 40cqw)`,
            fontWeight: r.bold ? 700 : 400, textAlign: r.align || "left", lineHeight: 1.1,
            whiteSpace: "pre-wrap", overflow: "hidden",
          }}>{r.text}</div>
        ))}
      </div>
    );
  }

  switch (z.type) {
    case "media":
    case "qr": {
      if (!c.media_url) return z.type === "qr" ? <span style={{ opacity: 0.7, fontSize: 10, color: "#888" }}>QR</span> : null;
      const objFit = z.type === "qr" ? "contain" : fit;
      return c.media_type === "video"
        ? <video src={c.media_url} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: objFit }} />
        : <img src={c.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: objFit }} />;
    }
    case "clock":
      return <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: textColor, fontSize }}><Clock fmt={st.format} /></div>;
    case "ticker":
      return <div style={{ width: "100%", height: "100%", overflow: "hidden", whiteSpace: "nowrap", display: "flex", alignItems: "center", color: textColor, fontSize: `min(${st.font_size_vh || 60}cqh, 12cqw)` }}>{c.text || ""}</div>;
    case "text":
      return <div style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: st.valign === "top" ? "flex-start" : st.valign === "bottom" ? "flex-end" : "center",
        justifyContent: st.align === "left" ? "flex-start" : st.align === "right" ? "flex-end" : "center",
        padding: "0 2%", color: textColor, fontSize, fontWeight: st.bold ? 700 : 400, textAlign: "center",
        lineHeight: 1.15, direction: st.direction === "rtl" ? "rtl" : "ltr", wordBreak: "break-word", overflow: "hidden",
      }}>{c.text || ""}</div>;
    case "playlist":
      return <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.55)", fontSize: 11, background: "#000" }}>▶ plays the rotation</div>;
    default:
      return null;
  }
}

// Whether the RESOLVED zone shows anything at this scope — drives the
// "set per screen" explainer chip for boxes that only have deeper-level content.
function hasVisibleContent(z) {
  const c = z.content || {};
  switch (z.type) {
    case "media":
    case "qr":
      return !!c.media_url;
    case "text":
    case "ticker":
      return !!(c.text || (Array.isArray(c.runs) && c.runs.length));
    default:
      return true; // clock / playlist always render something
  }
}

export default function TemplatePreview({ template, zones, overrides = {} }) {
  const dw = template?.design_width || 1920;
  const dh = template?.design_height || 1080;
  const landscape = dw >= dh;
  const boardW = landscape ? 520 : 300;
  const boardH = Math.round((boardW * dh) / dw);
  const sorted = (zones || []).slice().sort((a, b) => (a.z || 1) - (b.z || 1));

  return (
    <div style={{
      position: "relative", width: boardW, height: boardH, flexShrink: 0,
      background: "#000", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)",
    }}>
      {sorted.map((z) => {
        const pin = overrides[z.key];
        const pinCount = pin ? (pin.shops?.length || 0) + (pin.devices?.length || 0) + (pin.groups?.length || 0) : 0;
        const pinnedOnly = pinCount > 0 && !hasVisibleContent(z);
        return (
        <div key={z.key} style={{
          position: "absolute", left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%`,
          overflow: "hidden", containerType: "size",
          display: "flex", alignItems: "center", justifyContent: "center",
          ...bgStyle(z.content, z.style),
        }}>
          <ZoneContent z={z} />
          {pinnedOnly && (
            <span
              title={`Nothing set at this level — this box has its own content on ${pinCount} screen/group/location(s) (e.g. from an Excel upload), so it's NOT empty there.`}
              style={{
                position: "absolute", fontSize: 10, fontWeight: 600, lineHeight: 1,
                padding: "3px 7px", borderRadius: 10, whiteSpace: "nowrap",
                background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.9)",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              set on {pinCount} screen{pinCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        );
      })}
      {(!zones || zones.length === 0) && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          Nothing to preview yet
        </div>
      )}
    </div>
  );
}
