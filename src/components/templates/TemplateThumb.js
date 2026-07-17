// Miniature render of a template's zones — used for list cards and previews.
import React from "react";
import { zoneColor } from "./zoneTypes";
import { zonePreviewText } from "./ZoneBox";

export default function TemplateThumb({ template, height = 120, showLabels = false }) {
  const ratio = (template.design_width || 1920) / (template.design_height || 1080);
  const width = Math.round(height * ratio);
  return (
    <div
      aria-label={`Preview of template ${template.name}`}
      style={{
        width, height,
        maxWidth: "100%",
        position: "relative",
        background: "#0b0f1a",
        borderRadius: 6,
        overflow: "hidden",
        flexShrink: 0,
        border: "1px solid rgba(128,128,128,0.35)",
      }}
    >
      {(template.zones || []).map((z, i) => (
        <div
          key={z.key || i}
          style={{
            position: "absolute",
            left: `${z.x}%`, top: `${z.y}%`,
            width: `${z.w}%`, height: `${z.h}%`,
            background: z.style?.bg_color || zoneColor(i),
            zIndex: z.z || 1,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: z.style?.text_color || "#fff",
            fontSize: showLabels ? 11 : 7,
            overflow: "hidden",
            border: "0.5px solid rgba(255,255,255,0.25)",
          }}
        >
          {showLabels ? zonePreviewText(z) : null}
        </div>
      ))}
      {!(template.zones || []).length && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 11 }}>
          empty
        </div>
      )}
    </div>
  );
}
