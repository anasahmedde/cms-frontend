// Set / edit / remove a company's subscription expiration. The legacy
// "Remove" button had a stale-closure bug that re-saved the old date — here
// removal is its own explicit call to the DELETE endpoint.
import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Field, Input } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { apiDelete, apiPut } from "../lib/api";

const QUICK = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "6 months", days: 182 },
  { label: "1 year", days: 365 },
];

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ExpirationModal({ company, onClose, onSaved }) {
  const toast = useToast();
  const [date, setDate] = useState("");
  const [grace, setGrace] = useState(7);
  const [busy, setBusy] = useState(null); // 'save' | 'remove'
  const [error, setError] = useState("");

  useEffect(() => {
    if (!company) return;
    setDate(toLocalInput(company.expires_at));
    setGrace(company.grace_period_days ?? 7);
    setError("");
    setBusy(null);
  }, [company]);

  if (!company) return null;

  const save = async () => {
    if (!date) {
      setError("Pick a date, or use “Remove expiration” to make the company never expire.");
      return;
    }
    setBusy("save");
    setError("");
    const res = await apiPut(`/platform/company/${company.id}/expiration`, {
      expires_at: new Date(date).toISOString(),
      grace_period_days: Number(grace) || 0,
    });
    setBusy(null);
    if (!res.ok) return setError(res.message);
    toast.success(`Expiration for ${company.name} set to ${new Date(date).toLocaleString()}`);
    if (res.data?.users_logged_out) toast.info("The company is now inaccessible — its users were logged out.");
    onSaved();
  };

  const remove = async () => {
    setBusy("remove");
    setError("");
    const res = await apiDelete(`/platform/company/${company.id}/expiration`);
    setBusy(null);
    if (!res.ok) return setError(res.message);
    toast.success(`${company.name} never expires now`);
    onSaved();
  };

  return (
    <Modal
      open={!!company}
      onClose={onClose}
      title={`Subscription — ${company.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={!!busy}>Cancel</Button>
          {company.expires_at && (
            <Button variant="danger" onClick={remove} loading={busy === "remove"} disabled={busy === "save"}>
              Remove expiration
            </Button>
          )}
          <Button onClick={save} loading={busy === "save"} disabled={busy === "remove"}>Save</Button>
        </>
      }
    >
      <Field label="Expires at" htmlFor="exp-date">
        <Input id="exp-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="u-flex" style={{ marginBottom: 12 }}>
        <span className="u-faint">Quick set:</span>
        {QUICK.map((q) => (
          <Button key={q.days} variant="ghost" size="sm" onClick={() => setDate(toLocalInput(new Date(Date.now() + q.days * 86400000).toISOString()))}>
            {q.label}
          </Button>
        ))}
      </div>
      <Field label="Grace period (days after expiry)" hint="Users keep access with a warning during grace" htmlFor="exp-grace">
        <Input id="exp-grace" type="number" min={0} max={30} value={grace} onChange={(e) => setGrace(e.target.value)} />
      </Field>
      {error && (
        <div role="alert" style={{ padding: 10, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 8 }}>{error}</div>
      )}
    </Modal>
  );
}
