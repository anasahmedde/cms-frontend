// Six layout presets rendered as a radiogroup. The mini glyph is drawn from
// the same rows geometry the real preview uses; labels come from fleet/lib
// LAYOUT_LABELS (the one naming glossary for layouts, both editors).
import { LAYOUT_LABELS } from "../lib";
import { LAYOUT_PRESETS } from "./presets";

export default function ModePicker({ value, onChange, disabled = false }) {
  return (
    <div className="le-modes" role="radiogroup" aria-label="Layout">
      {Object.keys(LAYOUT_PRESETS).map((key) => {
        const preset = LAYOUT_PRESETS[key];
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            className={`le-mode${active ? " le-mode-active" : ""}`}
            onClick={() => onChange(key)}
            disabled={disabled}
          >
            <span className="le-mode-glyph" aria-hidden="true">
              {preset.rows.map((row, ri) => (
                <span key={ri} className="le-mode-glyph-row">
                  {row.map((slotIdx) => (
                    <span key={slotIdx} className="le-mode-glyph-cell" />
                  ))}
                </span>
              ))}
            </span>
            <span className="le-mode-label">{LAYOUT_LABELS[key] || key}</span>
          </button>
        );
      })}
    </div>
  );
}
