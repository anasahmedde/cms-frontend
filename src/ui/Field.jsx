// Field family — labeled form controls. All named exports; every control
// forwards standard props (+ id) and a ref so Field htmlFor/id wiring works.
// <Field label hint error required htmlFor>{control}</Field>
import { forwardRef } from "react";
import "./kit-overlays.css";

export function Field({ label, hint, error, required, htmlFor, children }) {
  return (
    <div className="ui-field">
      {label ? (
        <label className="ui-field-label" htmlFor={htmlFor}>
          {label}
          {required ? (
            <span className="ui-field-required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <div className="ui-field-error" role="alert">
          {error}
        </div>
      ) : hint ? (
        <div className="ui-field-hint">{hint}</div>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = "", ...props }, ref) {
  return <input ref={ref} className={`ui-input ${className}`.trim()} {...props} />;
});

export const Select = forwardRef(function Select(
  { options = [], placeholder, className = "", children, ...props },
  ref
) {
  return (
    <select ref={ref} className={`ui-input ui-select ${className}`.trim()} {...props}>
      {placeholder != null ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea({ className = "", ...props }, ref) {
  return <textarea ref={ref} className={`ui-input ui-textarea ${className}`.trim()} {...props} />;
});

export const Checkbox = forwardRef(function Checkbox(
  { label, checked, onChange, disabled, className = "", ...props },
  ref
) {
  return (
    <label className={`ui-checkbox ${disabled ? "ui-is-disabled " : ""}${className}`.trim()}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
});

export const Switch = forwardRef(function Switch(
  { label, checked, onChange, disabled, className = "", ...props },
  ref
) {
  return (
    <label className={`ui-switch ${disabled ? "ui-is-disabled " : ""}${className}`.trim()}>
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
      <span className="ui-switch-track" aria-hidden="true">
        <span className="ui-switch-knob" />
      </span>
      {label ? <span className="ui-switch-label">{label}</span> : null}
    </label>
  );
});
