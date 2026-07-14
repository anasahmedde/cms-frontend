// Add screen — 3-step enrollment wizard with live resolution auto-detection.
// Step 1: Device ID (polls GET /device/{id}/detected-resolution every 3s)
// Step 2: name, resolution (prefilled from detection), location + group
// Step 3: review → POST /device/create (legacy POST /insert_device fallback on
// 404/405 — surfaced honestly, never silent) → success step with detail link.
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { apiGet, apiPost, normalizeList } from "../../lib/api";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import Badge from "../../ui/Badge";
import KeyValue from "../../ui/KeyValue";
import { Field, Input, Select } from "../../ui/Field";

const DEVICE_ID_RE = /^[A-Za-z0-9._:-]{1,64}$/;
const RESOLUTION_RE = /^\d{2,5}x\d{2,5}$/;
const SOURCE_NOTE = {
  device: "reported by the screen",
  cache: "reported by the screen before enrollment",
  reported: "reported by the screen",
};

const pretty = (res) => (res ? String(res).replace("x", "×") : res);

export default function AddScreenWizard({ open, onClose, onCreated, initialLocation = "", initialGroup = "" }) {
  const [step, setStep] = useState(1); // 1 | 2 | 3 | "done"
  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");
  const [resolution, setResolution] = useState("");
  const resolutionTouched = useRef(false);
  const [location, setLocation] = useState("");
  const [group, setGroup] = useState("");
  const [detection, setDetection] = useState(null); // {resolution, source}
  const [detectError, setDetectError] = useState(false);
  const [lists, setLists] = useState({ groups: [], shops: [], loading: false, error: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [createdVia, setCreatedVia] = useState("create"); // "create" | "legacy"

  // Prefill from ?location= / ?group= deep links (e.g. "Add screen here").
  useEffect(() => {
    if (!open) return;
    setLocation((prev) => prev || initialLocation);
    setGroup((prev) => prev || initialGroup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialLocation, initialGroup]);

  const reset = () => {
    setStep(1); setDeviceId(""); setName(""); setResolution("");
    resolutionTouched.current = false;
    setLocation(""); setGroup(""); setDetection(null); setDetectError(false);
    setSubmitting(false); setSubmitError(""); setCreatedVia("create");
  };

  useEffect(() => { if (open) reset(); }, [open]);

  // Live auto-detect poll (every 3s while the wizard is open and an ID is typed).
  useEffect(() => {
    if (!open) return undefined;
    const id = deviceId.trim();
    if (!id || !DEVICE_ID_RE.test(id)) { setDetection(null); return undefined; }
    let cancelled = false;
    const check = async () => {
      const res = await apiGet(`/device/${encodeURIComponent(id)}/detected-resolution`);
      if (cancelled) return;
      if (!res.ok) { setDetectError(true); return; }
      setDetectError(false);
      const found = res.data?.resolution
        ? { resolution: res.data.resolution, source: res.data.source }
        : null;
      setDetection(found);
      if (found && !resolutionTouched.current) setResolution(found.resolution);
    };
    check();
    const timer = setInterval(check, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [open, deviceId]);

  // Locations + groups for step 2.
  const loadLists = async () => {
    setLists((l) => ({ ...l, loading: true, error: "" }));
    const [g, s] = await Promise.all([
      apiGet("/groups", { params: { limit: 500 } }),
      apiGet("/shops", { params: { limit: 1000 } }),
    ]);
    const groups = g.ok ? normalizeList(g.data).items.map((x) => x.gname || x.name || x).filter(Boolean) : [];
    const shops = s.ok ? normalizeList(s.data).items.map((x) => x.shop_name || x.name || x).filter(Boolean) : [];
    setLists({
      groups, shops, loading: false,
      error: g.ok && s.ok ? "" : `Could not load ${!g.ok ? "groups" : "locations"}: ${(!g.ok ? g.message : s.message)}`,
    });
  };
  useEffect(() => { if (open) loadLists(); }, [open]);

  const id = deviceId.trim();
  const idError =
    id && !DEVICE_ID_RE.test(id) ? "Letters, digits and . _ : - only (max 64 characters)." : "";
  const resError =
    resolution.trim() && !RESOLUTION_RE.test(resolution.trim())
      ? "Use the WIDTHxHEIGHT form, e.g. 1920x1080 — or leave empty for auto."
      : "";
  const isDetected = detection && resolution.trim() === detection.resolution;

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    let via = "create";
    let res = await apiPost("/device/create", {
      mobile_id: id,
      device_name: name.trim() || null,
      resolution: resolution.trim() || null,
      group_name: group || null,
      shop_name: location || null,
    });
    if (!res.ok && (res.status === 404 || res.status === 405)) {
      via = "legacy"; // old backend without /device/create
      res = await apiPost("/insert_device", { mobile_id: id, download_status: false });
    }
    setSubmitting(false);
    if (!res.ok) { setSubmitError(res.message); return; }
    setCreatedVia(via);
    setStep("done");
    onCreated?.();
  };

  const detectionHint = id && !idError && (
    <div style={{ marginTop: 8 }} aria-live="polite">
      {detection ? (
        <span className="u-flex">
          <Badge tone="success">Auto-detected: {pretty(detection.resolution)}</Badge>
          <span className="u-faint">{SOURCE_NOTE[detection.source] || detection.source || ""}</span>
        </span>
      ) : detectError ? (
        <span className="u-danger">Could not check for the screen’s report — retrying…</span>
      ) : (
        <span className="u-muted">Waiting for the screen to report…</span>
      )}
    </div>
  );

  const footer =
    step === "done" ? (
      <>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button variant="secondary" onClick={reset}>Add another</Button>
      </>
    ) : (
      <>
        {step > 1 && <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={submitting}>Back</Button>}
        <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
        {step === 1 && <Button onClick={() => setStep(2)} disabled={!id || !!idError}>Next</Button>}
        {step === 2 && <Button onClick={() => setStep(3)} disabled={!!resError}>Next</Button>}
        {step === 3 && <Button onClick={submit} loading={submitting}>Enroll screen</Button>}
      </>
    );

  return (
    <Modal open={open} onClose={() => !submitting && onClose()} title="Add screen" size="md" closeOnOverlay={!submitting} footer={footer}>
      {step !== "done" && <p className="u-faint" style={{ marginTop: 0 }}>Step {step} of 3</p>}

      {step === 1 && (
        <Field
          label="Device ID"
          required
          htmlFor="wizard-device-id"
          error={idError}
          hint="Shown on the screen with a Copy button when the player is not yet enrolled."
        >
          <Input
            id="wizard-device-id"
            className="mono"
            autoFocus
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="e.g. c5c64c89008c530e"
            autoComplete="off"
            spellCheck={false}
          />
          {detectionHint}
        </Field>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gap: 14 }}>
          <Field label="Screen name" htmlFor="wizard-name" hint="A friendly name, e.g. “Store #1 main display”. You can change it later.">
            <Input id="wizard-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Store #1 main display" />
          </Field>
          <Field
            label="Resolution"
            htmlFor="wizard-resolution"
            error={resError}
            hint="Leave as detected unless this screen needs a forced value. Empty = auto."
          >
            <span className="u-flex">
              <Input
                id="wizard-resolution"
                className="mono"
                style={{ maxWidth: 180 }}
                value={resolution}
                onChange={(e) => { resolutionTouched.current = true; setResolution(e.target.value); }}
                placeholder="1920x1080"
                autoComplete="off"
                spellCheck={false}
              />
              {isDetected && <Badge tone="success">Auto-detected</Badge>}
            </span>
          </Field>
          <Field label="Location" htmlFor="wizard-location" hint="Where this screen is installed.">
            <Select
              id="wizard-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="No location yet"
              options={lists.shops.map((sname) => ({ value: sname, label: sname }))}
              disabled={lists.loading}
            />
          </Field>
          <Field label="Group" htmlFor="wizard-group" hint="The screen plays its group’s playlist. You can assign one later.">
            <Select
              id="wizard-group"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="Ungrouped"
              options={lists.groups.map((gname) => ({ value: gname, label: gname }))}
              disabled={lists.loading}
            />
          </Field>
          {lists.error && (
            <div role="alert" className="u-flex u-danger">
              <span>{lists.error}</span>
              <Button variant="ghost" size="sm" onClick={loadLists} loading={lists.loading}>Retry</Button>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "grid", gap: 14 }}>
          <KeyValue
            columns={2}
            items={[
              { label: "Device ID", value: id, mono: true },
              { label: "Screen name", value: name.trim() || "—" },
              { label: "Resolution", value: resolution.trim() ? `${pretty(resolution.trim())}${isDetected ? " (auto-detected)" : ""}` : "Auto" },
              { label: "Location", value: location || "—" },
              { label: "Group", value: group || "Ungrouped" },
            ]}
          />
          {group && <p className="u-muted" style={{ margin: 0 }}>The screen will automatically receive the “{group}” group’s playlist.</p>}
          {submitError && <div role="alert" className="u-danger">{submitError}</div>}
        </div>
      )}

      {step === "done" && (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <CheckCircle2 size={36} aria-hidden="true" style={{ color: "var(--success)" }} />
          <h3 style={{ margin: "10px 0 4px" }}>Screen enrolled</h3>
          <p className="u-muted" style={{ margin: 0 }}>
            “{name.trim() || id}” is ready. It comes online when the player next checks in.
          </p>
          {createdVia === "legacy" && (
            <p role="alert" className="u-flex" style={{ justifyContent: "center", color: "var(--warn)", marginTop: 10 }}>
              <AlertTriangle size={16} aria-hidden="true" />
              Enrolled through the legacy endpoint — name, resolution, location, and group were NOT saved. Open the screen to set them.
            </p>
          )}
          <p style={{ marginTop: 14 }}>
            <Link to={`/screens/${encodeURIComponent(id)}`} onClick={onClose}>Open screen</Link>
          </p>
        </div>
      )}
    </Modal>
  );
}
