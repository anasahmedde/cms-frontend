// Add-company wizard: identity → limits → template → review → success (temp
// password with copy button — legacy showed it once with no copy).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import CopyButton from "../ui/CopyButton";
import KeyValue from "../ui/KeyValue";
import { Field, Input, Select } from "../ui/Field";
import { apiGet, apiPost, apiPut } from "../lib/api";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const STEPS = ["Company", "Limits", "Template", "Review"];

const initial = {
  name: "", slug: "", email: "", phone: "",
  max_devices: 50, max_users: 10, max_storage_mb: 5120,
  expires_at: "", grace_period_days: 7,
  admin_username: "", admin_full_name: "", admin_email: "",
  template_id: "",
};

export default function CompanyWizard({ open, onClose, onCreated }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // success payload

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setForm(initial);
    setError("");
    setWarnings([]);
    setResult(null);
    apiGet("/platform/templates", { params: { status: "published" } }).then((res) => {
      if (res.ok) setTemplates(res.data?.items || res.data || []);
    });
  }, [open]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const slugOk = SLUG_RE.test(form.slug);
  const stepOk =
    step === 0 ? form.name.trim() && slugOk && form.admin_username.trim() : true;

  const create = async () => {
    setBusy(true);
    setError("");
    const res = await apiPost("/platform/companies", {
      name: form.name.trim(),
      slug: form.slug.trim(),
      email: form.email || null,
      phone: form.phone || null,
      max_devices: Number(form.max_devices) || 50,
      max_users: Number(form.max_users) || 10,
      max_storage_mb: Number(form.max_storage_mb) || 5120,
      admin_username: form.admin_username.trim(),
      admin_full_name: form.admin_full_name || null,
      admin_email: form.admin_email || null,
    });
    if (!res.ok) {
      setBusy(false);
      setError(res.message);
      return;
    }
    const created = res.data;
    const warn = [];
    // Post-create steps — every result checked (legacy silently ignored them).
    if (form.expires_at) {
      const exp = await apiPut(`/platform/company/${created.company.id}/expiration`, {
        expires_at: new Date(form.expires_at).toISOString(),
        grace_period_days: Number(form.grace_period_days) || 7,
        notes: "Set during company creation",
      });
      if (!exp.ok) warn.push(`Expiration was NOT set: ${exp.message}`);
    }
    if (form.template_id) {
      const link = await apiPut(`/platform/companies/${created.company.id}/template`, {
        template_id: Number(form.template_id),
      });
      if (!link.ok) warn.push(`Template was NOT linked: ${link.message}`);
    }
    setWarnings(warn);
    setResult(created);
    setBusy(false);
    onCreated?.();
  };

  const close = () => {
    if (busy) return;
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={result ? "Company created" : `Add company — ${STEPS[step]} (${step + 1}/${STEPS.length})`}
      size="md"
      closeOnOverlay={false}
      footer={
        result ? (
          <>
            <Button variant="secondary" onClick={() => navigate(`/platform/companies/${encodeURIComponent(result.company.slug)}`)}>Open company page</Button>
            <Button onClick={close}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={step === 0 ? close : () => setStep(step - 1)} disabled={busy}>
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!stepOk}>Next</Button>
            ) : (
              <Button onClick={create} loading={busy}>Create company</Button>
            )}
          </>
        )
      }
    >
      {result ? (
        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0 }}>
            <strong>{result.company?.name}</strong> is ready. Share these one-time credentials with
            the company admin — <strong>the password is shown only once</strong>.
          </p>
          <KeyValue
            columns={1}
            items={[
              { label: "Workspace", value: result.company?.slug, mono: true },
              { label: "Admin username", value: result.admin_user?.username, mono: true },
            ]}
          />
          <div className="u-flex">
            <code className="mono" style={{ padding: "8px 12px", background: "var(--elevated)", borderRadius: 8 }}>
              {result.admin_user?.temp_password}
            </code>
            <CopyButton value={result.admin_user?.temp_password} label="Copy password" />
          </div>
          {warnings.map((w) => (
            <div key={w} role="alert" style={{ padding: 10, background: "var(--warn-soft)", color: "var(--warn)", borderRadius: 8 }}>{w}</div>
          ))}
          <p className="u-faint" style={{ margin: 0 }}>
            Next: open the company page to link a screen template, or open its workspace to enroll screens.
          </p>
        </div>
      ) : step === 0 ? (
        <>
          <Field label="Company name" required htmlFor="cw-name"><Input id="cw-name" value={form.name} onChange={set("name")} /></Field>
          <Field label="Workspace ID (slug)" required htmlFor="cw-slug"
            hint="Lowercase letters, digits, hyphens — permanent"
            error={form.slug && !slugOk ? "Must start/end with a letter or digit; lowercase letters, digits and hyphens only" : undefined}>
            <Input id="cw-slug" className="mono" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
          </Field>
          <Field label="Contact email" htmlFor="cw-email"><Input id="cw-email" type="email" value={form.email} onChange={set("email")} /></Field>
          <Field label="Phone" htmlFor="cw-phone"><Input id="cw-phone" value={form.phone} onChange={set("phone")} /></Field>
          <Field label="Admin username" required hint="The company's first login — a temporary password is generated" htmlFor="cw-admin">
            <Input id="cw-admin" value={form.admin_username} onChange={set("admin_username")} autoComplete="off" />
          </Field>
          <Field label="Admin full name" htmlFor="cw-adminname"><Input id="cw-adminname" value={form.admin_full_name} onChange={set("admin_full_name")} /></Field>
          <Field label="Admin email" htmlFor="cw-adminemail"><Input id="cw-adminemail" type="email" value={form.admin_email} onChange={set("admin_email")} /></Field>
        </>
      ) : step === 1 ? (
        <>
          <Field label="Screen limit" htmlFor="cw-maxdev"><Input id="cw-maxdev" type="number" min={1} value={form.max_devices} onChange={set("max_devices")} /></Field>
          <Field label="Team limit" htmlFor="cw-maxusr"><Input id="cw-maxusr" type="number" min={1} value={form.max_users} onChange={set("max_users")} /></Field>
          <Field label="Storage (MB)" htmlFor="cw-maxstor"><Input id="cw-maxstor" type="number" min={100} value={form.max_storage_mb} onChange={set("max_storage_mb")} /></Field>
          <Field label="Subscription expires" hint="Leave empty for no expiration" htmlFor="cw-exp">
            <Input id="cw-exp" type="datetime-local" value={form.expires_at} onChange={set("expires_at")} />
          </Field>
          {form.expires_at && (
            <Field label="Grace period (days after expiry)" htmlFor="cw-grace">
              <Input id="cw-grace" type="number" min={0} max={30} value={form.grace_period_days} onChange={set("grace_period_days")} />
            </Field>
          )}
        </>
      ) : step === 2 ? (
        <>
          <Field label="Screen template" hint="Published templates only — can be linked or changed later" htmlFor="cw-template">
            <Select
              id="cw-template"
              value={form.template_id}
              onChange={set("template_id")}
              options={[{ value: "", label: "No template (screens play plain playlists)" }, ...templates.map((t) => ({ value: String(t.id), label: `${t.name} (v${t.version})` }))]}
            />
          </Field>
          {templates.length === 0 && <p className="u-muted">No published templates yet — you can design one under Platform → Templates.</p>}
        </>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <KeyValue
            columns={2}
            items={[
              { label: "Name", value: form.name },
              { label: "Workspace ID", value: form.slug, mono: true },
              { label: "Admin", value: form.admin_username, mono: true },
              { label: "Screens / Team / Storage", value: `${form.max_devices} / ${form.max_users} / ${form.max_storage_mb} MB` },
              { label: "Expires", value: form.expires_at ? new Date(form.expires_at).toLocaleString() : "Never" },
              { label: "Template", value: form.template_id ? templates.find((t) => String(t.id) === form.template_id)?.name : "None" },
            ]}
          />
          <Badge tone="info">A temporary admin password will be generated and shown once.</Badge>
        </div>
      )}
      {error && (
        <div role="alert" style={{ padding: 10, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 8, marginTop: 10 }}>{error}</div>
      )}
    </Modal>
  );
}
