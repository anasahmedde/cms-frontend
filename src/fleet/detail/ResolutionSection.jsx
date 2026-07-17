// Resolution setting — fetches its own current value (GET /device/{id}/
// resolution) and the auto-detected value; save is disabled until the
// authoritative GET succeeded (fixes the legacy blind re-POST that could
// blank a stored resolution — frontend-quality P0).
import { useCallback, useEffect, useId, useState } from "react";
import { apiGet, apiPost } from "../../lib/api";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import { Field, Input, Select } from "../../ui/Field";
import Skeleton from "../../ui/Skeleton";
import ErrorState from "../../ui/ErrorState";
import { useToast } from "../../ui/Toast";

export const RESOLUTION_OPTIONS = [
  { value: "", label: "Auto (device default)" },
  { value: "1920x1080", label: "1920×1080 (Full HD landscape)" },
  { value: "1280x720", label: "1280×720 (HD landscape)" },
  { value: "1366x768", label: "1366×768 (common display)" },
  { value: "1600x900", label: "1600×900 (HD+ landscape)" },
  { value: "2560x1440", label: "2560×1440 (QHD landscape)" },
  { value: "3840x2160", label: "3840×2160 (4K UHD landscape)" },
  { value: "2560x1080", label: "2560×1080 (ultrawide)" },
  { value: "3440x1440", label: "3440×1440 (ultrawide QHD)" },
  { value: "1080x1920", label: "1080×1920 (Full HD portrait)" },
  { value: "720x1280", label: "720×1280 (HD portrait)" },
  { value: "768x1366", label: "768×1366 (common portrait)" },
  { value: "900x1600", label: "900×1600 (HD+ portrait)" },
  { value: "1440x2560", label: "1440×2560 (QHD portrait)" },
  { value: "2160x3840", label: "2160×3840 (4K UHD portrait)" },
  { value: "1080x1080", label: "1080×1080 (square HD)" },
  { value: "1920x1920", label: "1920×1920 (square Full HD)" },
  { value: "800x480", label: "800×480 (small display)" },
  { value: "480x800", label: "480×800 (small portrait)" },
  { value: "1024x600", label: "1024×600 (netbook)" },
  { value: "600x1024", label: "600×1024 (netbook portrait)" },
  { value: "custom", label: "Custom resolution…" },
];

const isPreset = (res) => RESOLUTION_OPTIONS.some((o) => o.value === res && o.value !== "custom");

export default function ResolutionSection({ mobileId, onDeviceReload }) {
  const toast = useToast();
  const ids = useId();
  const [load, setLoad] = useState({ loading: true, error: null });
  const [value, setValue] = useState("");
  const [custom, setCustom] = useState(false);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [detected, setDetected] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchCurrent = useCallback(async () => {
    setLoad({ loading: true, error: null });
    const [cur, det] = await Promise.all([
      apiGet(`/device/${encodeURIComponent(mobileId)}/resolution`),
      apiGet(`/device/${encodeURIComponent(mobileId)}/detected-resolution`),
    ]);
    if (!cur.ok) {
      setLoad({ loading: false, error: cur.message });
      return;
    }
    const res = cur.data?.resolution || "";
    setValue(res);
    if (res && !isPreset(res)) {
      setCustom(true);
      const [w, h] = res.split("x");
      setWidth(w || "");
      setHeight(h || "");
    } else {
      setCustom(false);
      setWidth("");
      setHeight("");
    }
    setDetected(det.ok ? det.data?.resolution || null : null); // detection is best-effort
    setLoad({ loading: false, error: null });
  }, [mobileId]);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  const onSelect = (v) => {
    if (v === "custom") {
      setCustom(true);
      setValue("");
    } else {
      setCustom(false);
      setWidth("");
      setHeight("");
      setValue(v);
    }
  };

  const useDetected = () => {
    if (!detected) return;
    if (isPreset(detected)) {
      onSelect(detected);
    } else {
      const [w, h] = detected.split("x");
      setCustom(true);
      setWidth(w || "");
      setHeight(h || "");
      setValue(detected);
    }
  };

  const onCustom = (w, h) => {
    setWidth(w);
    setHeight(h);
    if (w && h && parseInt(w, 10) > 0 && parseInt(h, 10) > 0) setValue(`${w}x${h}`);
    else setValue("");
  };

  const save = async () => {
    setSaving(true);
    const res = await apiPost(
      `/device/${encodeURIComponent(mobileId)}/resolution?resolution=${encodeURIComponent(value || "")}`
    );
    setSaving(false);
    if (res.ok) {
      toast.success(value ? `Resolution set to ${value}` : "Resolution set to auto");
      onDeviceReload();
    } else {
      toast.error(res.message || "Could not save the resolution");
    }
  };

  const orientation =
    width && height
      ? parseInt(width, 10) > parseInt(height, 10)
        ? "Landscape"
        : parseInt(width, 10) < parseInt(height, 10)
          ? "Portrait"
          : "Square"
      : null;

  return (
    <Card title="Resolution">
      {load.loading ? (
        <Skeleton height={64} />
      ) : load.error ? (
        // Failed to load the current value → never offer a save over it.
        <ErrorState message={`Couldn't load the current resolution — saving is disabled. ${load.error}`} onRetry={fetchCurrent} />
      ) : (
        <div style={{ display: "grid", gap: 12, maxWidth: 460 }}>
          {detected && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Badge tone="success">Detected: {detected}</Badge>
              {detected !== value && (
                <Button size="sm" variant="ghost" onClick={useDetected}>
                  Use detected
                </Button>
              )}
            </div>
          )}
          <Field
            label="Screen resolution"
            htmlFor={`${ids}-res`}
            hint="Used for layout positioning and media scaling."
          >
            <Select
              id={`${ids}-res`}
              value={custom ? "custom" : isPreset(value) || value === "" ? value : "custom"}
              onChange={(e) => onSelect(e.target.value)}
              options={RESOLUTION_OPTIONS}
            />
          </Field>
          {custom && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <Field label="Width (px)" htmlFor={`${ids}-w`}>
                <Input
                  id={`${ids}-w`}
                  type="number"
                  min="100"
                  max="7680"
                  value={width}
                  onChange={(e) => onCustom(e.target.value, height)}
                />
              </Field>
              <Field label="Height (px)" htmlFor={`${ids}-h`}>
                <Input
                  id={`${ids}-h`}
                  type="number"
                  min="100"
                  max="4320"
                  value={height}
                  onChange={(e) => onCustom(width, e.target.value)}
                />
              </Field>
              {orientation && <Badge tone="neutral">{`${width}×${height} ${orientation}`}</Badge>}
            </div>
          )}
          <div>
            <Button onClick={save} loading={saving} disabled={custom && !value}>
              Save resolution
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
