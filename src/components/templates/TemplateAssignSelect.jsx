// Pick which screen template a group/screen renders. Applies immediately —
// screens refetch on their next heartbeat (~30s). "Inherited" clears the
// override (screen > group > company default, same precedence as content).
import { useEffect, useState } from "react";
import { Field, Select } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import {
  getCompanyTemplates,
  getGroupTemplate, setGroupTemplate,
  getDeviceTemplate, setDeviceTemplate,
} from "./api";

export default function TemplateAssignSelect({ scope, targetId, inheritLabel, onChanged }) {
  const toast = useToast();
  const [choices, setChoices] = useState(null); // null = loading
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      getCompanyTemplates(),
      scope === "group" ? getGroupTemplate(targetId) : getDeviceTemplate(targetId),
    ]).then(([cs, cur]) => {
      if (!alive) return;
      if (!cs.ok || !cur.ok) {
        setError(cs.ok ? cur.message : cs.message);
        setChoices([]);
        return;
      }
      setChoices(cs.data?.items || []);
      setValue(cur.data?.template_id ? String(cur.data.template_id) : "");
    });
    return () => { alive = false; };
  }, [scope, targetId]);

  const apply = async (v) => {
    const prev = value;
    setValue(v);
    setBusy(true);
    const id = v ? Number(v) : null;
    const res = scope === "group"
      ? await setGroupTemplate(targetId, id)
      : await setDeviceTemplate(targetId, id);
    setBusy(false);
    if (!res.ok) {
      setValue(prev); // keep the real state on failure — no silent lies
      toast.error(`Couldn't change the template: ${res.message}`);
      return;
    }
    toast.success(id
      ? `Template set to “${res.data?.template_name}” — screens refresh within ~30s`
      : `Override cleared — back to ${inheritLabel?.toLowerCase() || "the inherited template"}`);
    onChanged?.();
  };

  if (error) {
    return <p style={{ color: "var(--danger)", margin: 0, fontSize: 13 }}>Couldn't load templates: {error}</p>;
  }
  if (choices === null) return <p className="u-muted" style={{ margin: 0 }}>Loading templates…</p>;
  if (choices.length < 2 && !value) {
    return (
      <p className="u-muted" style={{ margin: 0 }}>
        Your company has {choices.length === 1 ? "only one template" : "no templates yet"} — the platform
        admin can link more so mixed screens (e.g. portrait totems) get their own layout.
      </p>
    );
  }
  return (
    <Field
      label="Screen template"
      hint="Applies within ~30s. Boxes with the same name share their content across templates."
      htmlFor={`tpl-${scope}-${targetId}`}
    >
      <Select
        id={`tpl-${scope}-${targetId}`}
        value={value}
        disabled={busy}
        onChange={(e) => apply(e.target.value)}
        options={[
          { value: "", label: inheritLabel || "Inherited" },
          ...choices.map((t) => ({
            value: String(t.id),
            label: `${t.name} — ${t.orientation} ${t.design_width}×${t.design_height}${t.is_default ? " (company default)" : ""}`,
          })),
        ]}
      />
    </Field>
  );
}
