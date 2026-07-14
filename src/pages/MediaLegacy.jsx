// Interim Media Library: unifies the old Videos and Advertisements pages under
// one route with tabs, per the naming glossary (Videos / Images). Replaced by
// the rebuilt Media Library in the content wave.
import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Tabs from "../ui/Tabs";
import Video from "../components/Video";
import Advertisement from "../components/Advertisement";

export default function MediaLegacy() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("kind") === "image" ? "images" : "videos");

  const switchTab = (key) => {
    setTab(key);
    setParams(key === "images" ? { kind: "image" } : {}, { replace: true });
  };

  return (
    <div>
      <Tabs
        tabs={[
          { key: "videos", label: "Videos" },
          { key: "images", label: "Images" },
        ]}
        active={tab}
        onChange={switchTab}
      />
      <div className="legacy-page" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, marginTop: 12 }}>
        {tab === "videos" ? <Video /> : <Advertisement />}
      </div>
    </div>
  );
}
