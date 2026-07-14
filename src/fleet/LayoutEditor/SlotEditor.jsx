// Right-hand panel: the per-slot content picker (Videos / Images tabs) and
// per-slot settings (rotation chips + read-only fit mode). Items can be
// dragged onto a slot or clicked to assign to the selected/first-empty slot.
import { Film, GripVertical, Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import Badge from "../../ui/Badge";
import ErrorState from "../../ui/ErrorState";
import Tabs from "../../ui/Tabs";
import { ROTATION_OPTIONS } from "./presets";

export default function SlotEditor({
  tab,
  onTabChange,
  videos,
  ads,
  adsError,
  onRetryAds,
  slots,
  gname,
  onPickVideo,
  onPickAd,
  onDragStartVideo,
  onDragStartAd,
  onSetRotation,
}) {
  const assignedVideoNames = new Set(slots.filter((s) => s.video).map((s) => s.video.video_name));
  const assignedAdNames = new Set(
    slots.filter((s) => s.advertisement).map((s) => s.advertisement.ad_name)
  );
  const availableVideos = videos.filter((v) => !assignedVideoNames.has(v.video_name));
  const availableAds = ads.filter((a) => !assignedAdNames.has(a.ad_name));

  return (
    <div className="le-side">
      <Tabs
        tabs={[
          { key: "video", label: "Videos", icon: Film, badge: String(availableVideos.length) },
          { key: "image", label: "Images", icon: ImageIcon, badge: String(availableAds.length) },
        ]}
        active={tab}
        onChange={onTabChange}
      />

      {tab === "video" ? (
        <div className="le-available">
          <h4 className="le-section-title">Available videos ({availableVideos.length})</h4>
          <div className="le-item-list">
            {videos.length === 0 ? (
              <p className="le-list-empty">
                No videos on this screen yet. Assign videos to its group's playlist first.
              </p>
            ) : availableVideos.length === 0 ? (
              <p className="le-list-empty">All videos are assigned to slots.</p>
            ) : (
              availableVideos.map((video) => (
                <PickItem
                  key={video.video_name}
                  icon={Film}
                  name={video.video_name}
                  onPick={() => onPickVideo(video)}
                  onDragStart={() => onDragStartVideo(video)}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="le-available">
          <h4 className="le-section-title">Available images ({availableAds.length})</h4>
          {adsError ? (
            <ErrorState
              message={`Couldn't load the group's images — ${adsError}`}
              onRetry={onRetryAds}
            />
          ) : (
            <div className="le-item-list">
              {ads.length === 0 ? (
                <p className="le-list-empty">
                  {gname && gname !== "_none" ? (
                    <>
                      No images in this group yet.{" "}
                      <Link className="le-link" to="/media?kind=image">
                        Upload images in the Media Library
                      </Link>
                      , then assign them to the group.
                    </>
                  ) : (
                    "This screen isn't in a group — images come from a group's playlist."
                  )}
                </p>
              ) : availableAds.length === 0 ? (
                <p className="le-list-empty">All images are assigned to slots.</p>
              ) : (
                availableAds.map((ad) => (
                  <PickItem
                    key={ad.ad_name}
                    icon={ImageIcon}
                    name={ad.ad_name}
                    onPick={() => onPickAd(ad)}
                    onDragStart={() => onDragStartAd(ad)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="le-slot-settings">
        <h4 className="le-section-title">Slots ({slots.length})</h4>
        <div className="le-slot-settings-list">
          {slots.map((slot, idx) => (
            <SlotRow key={idx} slot={slot} index={idx} onSetRotation={onSetRotation} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Click assigns to the selected (or first empty) slot; drag drops on any slot.
function PickItem({ icon: Icon, name, onPick, onDragStart }) {
  return (
    <button
      type="button"
      className="le-item"
      draggable
      onDragStart={onDragStart}
      onClick={onPick}
      title={`${name} — click to place in the selected slot, or drag onto a slot`}
    >
      <GripVertical size={14} className="le-item-grip" aria-hidden="true" />
      <Icon size={15} aria-hidden="true" />
      <span className="le-item-name">{name}</span>
    </button>
  );
}

function SlotRow({ slot, index, onSetRotation }) {
  const hasContent = Boolean(slot.video || slot.advertisement);
  const isImage = slot.content_type === "image" || Boolean(slot.advertisement);
  const contentName = slot.video?.video_name || slot.advertisement?.ad_name || "(empty)";
  const fitMode = slot.video?.fit_mode || slot.advertisement?.fit_mode || null;

  return (
    <div className={`le-slot-row${hasContent ? "" : " le-slot-row-empty"}`}>
      <div className="le-slot-row-head">
        <Badge tone={hasContent ? (isImage ? "success" : "info") : "neutral"}>S{index + 1}</Badge>
        {hasContent ? (
          isImage ? (
            <ImageIcon size={14} aria-hidden="true" />
          ) : (
            <Film size={14} aria-hidden="true" />
          )
        ) : null}
        <span className="le-slot-row-name" title={contentName}>
          {contentName}
        </span>
        {hasContent && fitMode ? <span className="le-slot-fit mono">Fit: {fitMode}</span> : null}
      </div>
      <div
        className="le-rotation"
        role="radiogroup"
        aria-label={`Rotation for slot ${index + 1}`}
      >
        <span className="le-rotation-label">Rotation</span>
        {ROTATION_OPTIONS.map((r) => {
          const active = (slot.rotation ?? null) === r.value;
          return (
            <button
              key={r.label}
              type="button"
              role="radio"
              aria-checked={active}
              className={`le-chip${active ? " le-chip-active" : ""}`}
              disabled={!hasContent}
              onClick={() => onSetRotation(index, r.value)}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
