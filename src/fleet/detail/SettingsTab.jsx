// Settings tab — THE §7 defect fix: every section fetches its own current
// value independently, and a section whose GET failed shows an ErrorState
// with saving disabled. Nothing here ever writes a default over config it
// failed to load (the legacy edit modal's silent-overwrite P0).
import { useCallback, useEffect, useId, useState } from "react";
import { apiGet, apiPost } from "../../lib/api";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import { Field, Input, Switch } from "../../ui/Field";
import Skeleton from "../../ui/Skeleton";
import ErrorState from "../../ui/ErrorState";
import { useToast } from "../../ui/Toast";
import ResolutionSection from "./ResolutionSection";
import ExpirationSection from "./ExpirationSection";
import StorageLimitSection from "./StorageLimitSection";

function BleSection({ mobileId }) {
  const toast = useToast();
  const id = useId();
  const [load, setLoad] = useState({ loading: true, error: null });
  const [value, setValue] = useState("");
  const [conflict, setConflict] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCurrent = useCallback(async () => {
    setLoad({ loading: true, error: null });
    const res = await apiGet(`/device/${encodeURIComponent(mobileId)}/ble-id`);
    if (res.ok) {
      setValue(res.data?.ble_device_id || "");
      setLoad({ loading: false, error: null });
    } else {
      setLoad({ loading: false, error: res.message });
    }
  }, [mobileId]);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  const save = async () => {
    setSaving(true);
    setConflict("");
    const res = await apiPost(`/device/${encodeURIComponent(mobileId)}/ble-id`, {
      ble_device_id: value.trim() || null,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(value.trim() ? `BLE ID set to "${value.trim()}"` : "BLE pairing disabled");
    } else if (res.status === 409) {
      setConflict(typeof res.detail === "string" ? res.detail : res.message); // backend text verbatim
    } else {
      toast.error(res.message || "Could not save the BLE ID");
    }
  };

  return (
    <Card title="BLE ID">
      {load.loading ? (
        <Skeleton height={64} />
      ) : load.error ? (
        <ErrorState
          message={`Couldn't load the current BLE ID — saving is disabled. ${load.error}`}
          onRetry={fetchCurrent}
        />
      ) : (
        <div style={{ display: "grid", gap: 12, maxWidth: 460 }}>
          <Field
            label="BLE Device ID"
            htmlFor={id}
            error={conflict || undefined}
            hint="Must match the ID hardcoded in the ESP32 firmware. Leave empty if no ESP32 is used."
          >
            <Input
              id={id}
              value={value}
              maxLength={50}
              placeholder="e.g. 01, 02 — leave empty to skip pairing"
              onChange={(e) => {
                setValue(e.target.value);
                if (conflict) setConflict("");
              }}
            />
          </Field>
          <div>
            <Button onClick={save} loading={saving}>
              Save BLE ID
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function GenderSection({ mobileId }) {
  const toast = useToast();
  const [load, setLoad] = useState({ loading: true, error: null });
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchCurrent = useCallback(async () => {
    setLoad({ loading: true, error: null });
    const res = await apiGet(`/webapp/device/${encodeURIComponent(mobileId)}/config`);
    if (res.ok) {
      setEnabled(!!res.data?.gender_counting_enabled);
      setLoad({ loading: false, error: null });
    } else {
      setLoad({ loading: false, error: res.message });
    }
  }, [mobileId]);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  const toggle = async (next) => {
    setSaving(true);
    const res = await apiPost(`/webapp/device/${encodeURIComponent(mobileId)}/gender-enabled`, {
      enabled: next,
    });
    setSaving(false);
    if (res.ok) {
      setEnabled(next);
      toast.success(next ? "Gender counting enabled" : "Gender counting disabled");
    } else {
      toast.error(res.message || "Could not change gender counting");
    }
  };

  return (
    <Card title="Gender counting">
      {load.loading ? (
        <Skeleton height={40} />
      ) : load.error ? (
        // Never write a default over a config we couldn't read (the legacy P0).
        <ErrorState
          message={`Couldn't load the current setting — the toggle is disabled. ${load.error}`}
          onRetry={fetchCurrent}
        />
      ) : (
        <div style={{ display: "grid", gap: 8, maxWidth: 460 }}>
          <Switch
            label="Count viewers by gender using the camera"
            checked={enabled}
            disabled={saving}
            onChange={(e) => toggle(e.target.checked)}
          />
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Only for Linux web-player screens with a camera. The AI model runs locally and sends
            only counts.
          </p>
        </div>
      )}
    </Card>
  );
}

export default function SettingsTab({ device, onDeviceReload }) {
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))" }}>
      <ResolutionSection mobileId={device.mobile_id} onDeviceReload={onDeviceReload} />
      <BleSection mobileId={device.mobile_id} />
      <GenderSection mobileId={device.mobile_id} />
      <ExpirationSection mobileId={device.mobile_id} deviceId={device.id} />
      <StorageLimitSection mobileId={device.mobile_id} />
    </div>
  );
}
