// Type-to-search add control for library media, used by the group playlist
// editor. Only names that exist in the library can be added — unknown names
// get an inline error, exactly like the legacy Link Content page.
import { useEffect, useId, useState } from "react";
import { Plus } from "lucide-react";
import Button from "../../ui/Button";
import { Field, Input } from "../../ui/Field";
import { fetchMediaList, contentTypeOf, KINDS } from "./lib";

// typeFilter narrows a stack by real media type: "video" keeps everything that
// is NOT an image (video/html/pdf), "image" keeps only images. Used to split the
// mixed /videos rotation stack into a Videos picker and an Images picker.
export function MediaPicker({ kind, onAdd, exclude = [], label, typeFilter }) {
  const listId = useId();
  const [names, setNames] = useState([]);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchMediaList(kind).then((res) => {
      if (!alive) return;
      if (res.ok) {
        const items = typeFilter
          ? res.items.filter((it) =>
              typeFilter === "image"
                ? contentTypeOf(it) === "image"
                : contentTypeOf(it) !== "image")
          : res.items;
        setNames(items.map((it) => it.name));
      } else setLoadError(res.message);
    });
    return () => {
      alive = false;
    };
  }, [kind, typeFilter]);

  const available = names.filter((n) => !exclude.includes(n));

  const add = () => {
    const name = value.trim();
    if (!name) return;
    if (!names.includes(name)) {
      setError(`"${name}" is not in the ${KINDS[kind].plural} library.`);
      return;
    }
    if (exclude.includes(name)) {
      setError(`"${name}" is already in the playlist.`);
      return;
    }
    setError("");
    setValue("");
    onAdd(name);
  };

  return (
    <Field
      label={label || `Add ${KINDS[kind].plural}`}
      error={error || loadError}
      hint={loadError ? undefined : `${available.length} more in the library`}
      htmlFor={`${listId}-input`}
    >
      <div className="u-flex">
        <Input
          id={`${listId}-input`}
          list={listId}
          value={value}
          placeholder={
            available.length
              ? `Type to search ${KINDS[kind].plural}…`
              : names.length
                ? `All ${KINDS[kind].plural} are already in the playlist`
                : `No ${KINDS[kind].plural} in the library yet`
          }
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          style={{ flex: 1 }}
        />
        <datalist id={listId}>
          {available.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <Button variant="secondary" size="sm" icon={Plus} onClick={add} disabled={!value.trim()}>
          Add
        </Button>
      </div>
    </Field>
  );
}
