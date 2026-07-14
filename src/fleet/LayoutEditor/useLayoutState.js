// All editor state + slot manipulation for LayoutEditor (extracted from
// index.jsx for the ≤300-line rule): initialization from the loaded device
// state, mode changes, assignment via click or drag, rotation, sequential
// playback. Pure state — no HTTP in here.
import { useEffect, useRef, useState } from "react";
import { LAYOUT_PRESETS, restoreSlots } from "./presets";

export default function useLayoutState(data, { onAllSlotsFull } = {}) {
  const [layoutMode, setLayoutMode] = useState("single");
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [contentTab, setContentTab] = useState("video");
  const [playAllSequential, setPlayAllSequential] = useState(false);
  const [sequentialVideos, setSequentialVideos] = useState([]);
  const [dragItem, setDragItem] = useState(null); // {type:'video'|'ad', item}
  const initializedRef = useRef(false);

  // Initialize once per successful load: restore mode, sequence and slots
  // from the saved layout_config (legacy restore semantics — see restoreSlots).
  useEffect(() => {
    if (data.loading || data.error) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    const mode = data.layoutMode && LAYOUT_PRESETS[data.layoutMode] ? data.layoutMode : "single";
    setLayoutMode(mode);
    const slot1 = (data.savedConfig || []).find((s) => s.position === 1);
    if (slot1?.play_all_sequential) {
      setPlayAllSequential(true);
      setSequentialVideos(
        (slot1.sequential_videos || []).map((name, i) => ({ video_name: name, order: i + 1 }))
      );
    } else {
      setPlayAllSequential(false);
      setSequentialVideos([]);
    }
    setSlots(
      restoreSlots({
        preset: LAYOUT_PRESETS[mode],
        savedConfig: data.savedConfig,
        videos: data.videos,
        ads: data.ads,
      })
    );
    setSelectedSlot(null);
  }, [data.loading, data.error, data.layoutMode, data.savedConfig, data.videos, data.ads]);

  const changeMode = (mode) => {
    if (mode === layoutMode) return;
    setLayoutMode(mode);
    const preset = LAYOUT_PRESETS[mode];
    // Same slot count (e.g. 2×2 Grid ↔ 1×4 Grid) keeps assignments untouched.
    setSlots((prev) =>
      prev.length === preset.slots
        ? prev
        : restoreSlots({
            preset,
            savedConfig: data.savedConfig,
            videos: data.videos,
            ads: data.ads,
            prevSlots: prev,
          })
    );
    setSelectedSlot(null);
  };

  const assignVideo = (index, video) => {
    setSlots((prev) => {
      const next = prev.map((s) =>
        s.video?.video_name === video.video_name ? { ...s, video: null, content_type: "video" } : s
      );
      next[index] = {
        ...next[index],
        video: { ...video },
        advertisement: null,
        content_type: "video",
        rotation: video.device_rotation ?? video.rotation ?? null,
      };
      return next;
    });
  };

  const assignAd = (index, ad) => {
    setSlots((prev) => {
      const next = prev.map((s) =>
        s.advertisement?.ad_name === ad.ad_name
          ? { ...s, advertisement: null, content_type: "video" }
          : s
      );
      next[index] = {
        ...next[index],
        advertisement: { ...ad },
        video: null,
        content_type: "image",
        rotation: ad.rotation ?? null,
      };
      return next;
    });
  };

  // Click-to-assign target: the selected slot, else the first empty one.
  const handlePick = (type, item) => {
    let target = selectedSlot != null && selectedSlot < slots.length ? selectedSlot : null;
    if (target == null) {
      const empty = slots.findIndex((s) => !s.video && !s.advertisement);
      target = empty === -1 ? null : empty;
    }
    if (target == null) {
      onAllSlotsFull?.();
      return;
    }
    if (type === "video") assignVideo(target, item);
    else assignAd(target, item);
    setSelectedSlot(target);
  };

  const handleDrop = (index) => {
    if (!dragItem) return;
    if (dragItem.type === "video") assignVideo(index, dragItem.item);
    else assignAd(index, dragItem.item);
    setDragItem(null);
  };

  const removeFromSlot = (index) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], video: null, advertisement: null, content_type: "video" };
      return next;
    });
  };

  const setRotation = (index, rotation) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], rotation };
      return next;
    });
  };

  const toggleSequential = (next) => {
    setPlayAllSequential(next);
    if (next && sequentialVideos.length === 0) {
      // Pre-populate with every video on the screen, in current order.
      setSequentialVideos(data.videos.map((v, i) => ({ video_name: v.video_name, order: i + 1 })));
    }
  };

  return {
    layoutMode,
    slots,
    selectedSlot,
    setSelectedSlot,
    contentTab,
    setContentTab,
    playAllSequential,
    sequentialVideos,
    setSequentialVideos,
    setDragItem,
    changeMode,
    handlePick,
    handleDrop,
    removeFromSlot,
    setRotation,
    toggleSequential,
  };
}
