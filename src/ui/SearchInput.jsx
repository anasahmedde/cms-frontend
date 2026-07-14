// SearchInput — debounced text search with icon and clear button.
// <SearchInput value onChange placeholder delay={300} /> — onChange fires with
// the string after `delay` ms of idle typing; clear fires immediately.
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import "./kit-overlays.css";

export default function SearchInput({
  value = "",
  onChange,
  placeholder = "Search",
  delay = 300,
  ...props
}) {
  const [text, setText] = useState(value);
  const timerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Adopt external resets (e.g. "clear filters" elsewhere on the page).
  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleChange = (e) => {
    const next = e.target.value;
    setText(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChangeRef.current?.(next), delay);
  };

  const handleClear = () => {
    clearTimeout(timerRef.current);
    setText("");
    onChangeRef.current?.("");
  };

  return (
    <div className="ui-search">
      <Search size={16} className="ui-search-icon" aria-hidden="true" />
      <input
        type="text"
        className="ui-input ui-search-input"
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        {...props}
      />
      {text ? (
        <button type="button" className="ui-search-clear" aria-label="Clear search" onClick={handleClear}>
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}
