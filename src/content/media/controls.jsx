// Small form controls shared by the upload and edit modals: rotation degree
// chips and the fit-mode select (with the legacy option descriptions).
import { Field, Select } from "../../ui/Field";
import { ROTATIONS, FIT_OPTIONS } from "./lib";
import "./media.css";

export function RotationChips({ value, onChange, label = "Rotation", disabled }) {
  return (
    <Field label={label}>
      <div className="media-rot-chips" role="group" aria-label={label}>
        {ROTATIONS.map((r) => (
          <button
            key={r}
            type="button"
            className="media-rot-chip"
            aria-pressed={value === r}
            disabled={disabled}
            onClick={() => onChange(r)}
          >
            {r}°
          </button>
        ))}
      </div>
    </Field>
  );
}

export function FitModeSelect({ id, value, onChange, disabled }) {
  const active = FIT_OPTIONS.find((o) => o.value === value);
  return (
    <Field label="Fit mode" htmlFor={id} hint={active ? active.desc : undefined}>
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        options={FIT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      />
    </Field>
  );
}
