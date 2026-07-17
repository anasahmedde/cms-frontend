// Shared "pick from the media library" <select>. Reads /videos + /advertisements
// once and returns the chosen item ({ name, s3_link, media_type }) via onPick.
// Used by the designer background control and (later) the content editors.
import React, { useEffect, useState } from "react";
import { apiGet, normalizeList } from "../../lib/api";

export default function MediaLibraryPicker({ id, value, onPick, imagesOnly = false, style, disabled }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiGet("/videos", { params: { limit: 500, offset: 0 } }),
      apiGet("/advertisements", { params: { limit: 500, offset: 0 } }),
    ]).then(([v, a]) => {
      if (!alive) return;
      if (!v.ok && !a.ok) { setError(v.message || a.message); setItems([]); return; }
      const vids = (v.ok ? normalizeList(v.data, "items").items : []).map((x) => ({
        name: x.video_name, s3_link: x.s3_link,
        media_type: x.content_type === "image" ? "image" : "video",
      }));
      const ads = (a.ok ? normalizeList(a.data, "items").items : []).map((x) => ({
        name: x.ad_name, s3_link: x.s3_link, media_type: "image",
      }));
      let all = [...vids, ...ads].filter((i) => i.s3_link);
      if (imagesOnly) all = all.filter((i) => i.media_type === "image");
      setItems(all);
    });
    return () => { alive = false; };
  }, [imagesOnly]);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <select
        id={id}
        value={value || ""}
        disabled={disabled || items === null}
        onChange={(e) => {
          const it = (items || []).find((i) => i.s3_link === e.target.value);
          if (it) onPick(it);
        }}
        style={style}
      >
        <option value="">{items === null ? "Loading library…" : "Select from media…"}</option>
        {(items || []).map((i) => (
          <option key={i.s3_link} value={i.s3_link}>
            {i.media_type === "video" ? "🎬 " : "🖼 "}{i.name}
          </option>
        ))}
      </select>
      {error && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>Couldn't load library: {error}</div>}
      {items && items.length === 0 && !error && (
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Your media library is empty — upload media first.</div>
      )}
    </div>
  );
}
