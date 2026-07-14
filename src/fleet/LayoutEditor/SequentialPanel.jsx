// "Play all videos in sequence" — Single layout only. Persisted inside slot 1
// of layout_config as { play_all_sequential: true, sequential_videos: [names] }
// exactly like the legacy editor. Reordering works by drag AND by the
// move-up/move-down buttons (keyboard path the legacy drag-only list lacked).
import { useState } from "react";
import { ChevronDown, ChevronUp, Film, GripVertical, Repeat } from "lucide-react";
import Badge from "../../ui/Badge";
import IconButton from "../../ui/IconButton";
import { Checkbox, Switch } from "../../ui/Field";

export default function SequentialPanel({ enabled, onToggle, videos, sequence, onChange }) {
  const [dragIndex, setDragIndex] = useState(null);
  const ordered = [...sequence].sort((a, b) => a.order - b.order);

  const toggleVideo = (videoName, checked) => {
    if (checked) {
      onChange([...sequence, { video_name: videoName, order: sequence.length + 1 }]);
    } else {
      onChange(
        sequence
          .filter((s) => s.video_name !== videoName)
          .map((s, i) => ({ ...s, order: i + 1 }))
      );
    }
  };

  const moveTo = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= ordered.length || fromIdx === toIdx) return;
    const next = [...ordered];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onChange(next.map((s, i) => ({ ...s, order: i + 1 })));
  };

  return (
    <div className={`le-seq${enabled ? " le-seq-on" : ""}`}>
      <div className="le-seq-toggle">
        <Switch
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          label={
            <span className="le-seq-toggle-label">
              <Repeat size={14} aria-hidden="true" /> Play all videos in sequence
            </span>
          }
        />
        <p className="le-seq-hint">
          {enabled
            ? "The screen plays the selected videos one by one in order, looping forever."
            : "Only the video assigned to the single slot will play."}
        </p>
      </div>

      {enabled && (
        <div className="le-seq-body">
          <h4 className="le-section-title">
            Select videos to play ({sequence.length} selected)
          </h4>
          <div className="le-seq-picker">
            {videos.length === 0 ? (
              <p className="le-list-empty">No videos on this screen yet.</p>
            ) : (
              videos.map((v) => {
                const inSeq = sequence.find((s) => s.video_name === v.video_name);
                return (
                  <div key={v.video_name} className={`le-seq-pick${inSeq ? " le-seq-pick-on" : ""}`}>
                    <Checkbox
                      checked={Boolean(inSeq)}
                      onChange={(e) => toggleVideo(v.video_name, e.target.checked)}
                      label={
                        <span className="le-seq-pick-label">
                          <Film size={13} aria-hidden="true" />
                          <span className="le-seq-pick-name" title={v.video_name}>
                            {v.video_name}
                          </span>
                        </span>
                      }
                    />
                    {inSeq ? <Badge tone="info">#{inSeq.order}</Badge> : null}
                  </div>
                );
              })
            )}
          </div>

          {ordered.length > 0 && (
            <>
              <h4 className="le-section-title">Playback order — drag or use the arrows</h4>
              <ol className="le-seq-order">
                {ordered.map((sv, idx) => (
                  <li
                    key={sv.video_name}
                    className={`le-seq-item${dragIndex === idx ? " le-seq-item-drag" : ""}`}
                    draggable
                    onDragStart={() => setDragIndex(idx)}
                    onDragEnd={() => setDragIndex(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndex != null) moveTo(dragIndex, idx);
                      setDragIndex(null);
                    }}
                  >
                    <GripVertical size={14} className="le-item-grip" aria-hidden="true" />
                    <Badge tone="info">{sv.order}</Badge>
                    <span className="le-seq-item-name" title={sv.video_name}>
                      {sv.video_name}
                    </span>
                    <span className="le-seq-item-actions">
                      <IconButton
                        size="sm"
                        icon={ChevronUp}
                        label={`Move ${sv.video_name} earlier`}
                        disabled={idx === 0}
                        onClick={() => moveTo(idx, idx - 1)}
                      />
                      <IconButton
                        size="sm"
                        icon={ChevronDown}
                        label={`Move ${sv.video_name} later`}
                        disabled={idx === ordered.length - 1}
                        onClick={() => moveTo(idx, idx + 1)}
                      />
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}
