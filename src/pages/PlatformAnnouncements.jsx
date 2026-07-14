// Platform announcements: composer (replaces the modal buried in the old
// dashboard), the currently-active banner with a confirmed Clear, and the
// history list (endpoint existed, never had UI).
import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Card from "../ui/Card";
import Table from "../ui/Table";
import ConfirmModal from "../ui/ConfirmModal";
import EmptyState from "../ui/EmptyState";
import { Field, Textarea, Select } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { apiDelete, apiGet, apiPost, normalizeList } from "../lib/api";
import { formatDateTime, timeAgo } from "../lib/format";

const TYPES = [
  { value: "info", label: "Info (blue)" },
  { value: "warning", label: "Warning (amber)" },
  { value: "critical", label: "Critical (red)" },
];
const TYPE_TONES = { info: "info", warning: "warn", critical: "danger" };
const DURATIONS = [
  { value: "", label: "No expiry" },
  { value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" }, { value: "180", label: "3 hours" },
  { value: "360", label: "6 hours" }, { value: "720", label: "12 hours" },
  { value: "1440", label: "1 day" }, { value: "4320", label: "3 days" }, { value: "10080", label: "7 days" },
];

export default function PlatformAnnouncements() {
  const toast = useToast();
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [target, setTarget] = useState("");
  const [duration, setDuration] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(() => {
    apiGet("/announcement/active").then((r) => r.ok && setActive(r.data?.announcement || null));
    apiGet("/platform/announcements", { params: { limit: 20 } }).then(
      (r) => r.ok && setHistory(normalizeList(r.data, "items").items.length ? normalizeList(r.data, "items").items : r.data?.announcements || [])
    );
    apiGet("/platform/companies", { params: { limit: 200 } }).then(
      (r) => r.ok && setCompanies(normalizeList(r.data, "items").items)
    );
  }, []);

  useEffect(load, [load]);

  const publish = async () => {
    setPublishing(true);
    const res = await apiPost("/platform/announcement", {
      message: message.trim(),
      type,
      is_active: true,
      expires_at: duration ? new Date(Date.now() + Number(duration) * 60000).toISOString() : null,
      target_type: target ? "company" : "all",
      target_company_id: target ? Number(target) : null,
    });
    setPublishing(false);
    if (!res.ok) return toast.error(res.message);
    toast.success(target ? "Announcement published to the company" : "Announcement published to all users");
    setMessage("");
    load();
  };

  const clear = async () => {
    setClearing(true);
    const res = await apiDelete("/platform/announcement");
    setClearing(false);
    setConfirmClear(false);
    if (!res.ok) return toast.error(res.message);
    toast.success("Announcement cleared for everyone");
    load();
  };

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Banner messages shown to every logged-in user" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <Card title="Publish">
          <Field label="Message" required htmlFor="ann-msg">
            <Textarea id="ann-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Scheduled maintenance Sunday 02:00–04:00 UTC" />
          </Field>
          <Field label="Type" htmlFor="ann-type">
            <Select id="ann-type" value={type} onChange={(e) => setType(e.target.value)} options={TYPES} />
          </Field>
          <Field label="Audience" htmlFor="ann-target">
            <Select
              id="ann-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              options={[{ value: "", label: "All companies" }, ...companies.map((c) => ({ value: String(c.id), label: c.name }))]}
            />
          </Field>
          <Field label="Auto-dismiss after" htmlFor="ann-dur">
            <Select id="ann-dur" value={duration} onChange={(e) => setDuration(e.target.value)} options={DURATIONS} />
          </Field>
          {active && (
            <Badge tone="warn">Publishing replaces the currently active announcement.</Badge>
          )}
          <div style={{ marginTop: 12 }}>
            <Button icon={Megaphone} onClick={publish} loading={publishing} disabled={!message.trim()}>
              {target ? `Publish to ${companies.find((c) => String(c.id) === target)?.name || "company"}` : "Publish to all users"}
            </Button>
          </div>
        </Card>

        <div style={{ display: "grid", gap: 16 }}>
          <Card title="Currently active" actions={active && <Button size="sm" variant="danger" onClick={() => setConfirmClear(true)}>Clear</Button>}>
            {active ? (
              <div className="u-flex" style={{ alignItems: "flex-start" }}>
                <Badge tone={TYPE_TONES[active.type] || "info"}>{active.type}</Badge>
                <div>
                  <div>{active.message}</div>
                  <div className="u-faint">
                    {active.target_type === "company" ? "Company-targeted" : "All users"} · published {timeAgo(active.created_at)}
                    {active.expires_at ? ` · auto-dismisses ${formatDateTime(active.expires_at)}` : ""}
                  </div>
                </div>
              </div>
            ) : (
              <span className="u-muted">No active announcement.</span>
            )}
          </Card>

          <Card title="History">
            <Table
              columns={[
                { key: "message", label: "Message", render: (a) => <span title={a.message}>{a.message?.slice(0, 60)}{a.message?.length > 60 ? "…" : ""}</span> },
                { key: "type", label: "Type", render: (a) => <Badge tone={TYPE_TONES[a.type] || "neutral"}>{a.type}</Badge> },
                { key: "target", label: "Audience", render: (a) => (a.target_type === "company" ? "Company" : "All") },
                { key: "created_at", label: "Published", render: (a) => timeAgo(a.created_at) },
                { key: "is_active", label: "", render: (a) => (a.is_active ? <Badge tone="success">active</Badge> : null) },
              ]}
              rows={history}
              rowKey={(a) => a.id}
              loading={false}
              empty={<EmptyState icon={Megaphone} title="No announcements yet" />}
            />
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clear}
        title="Clear the active announcement?"
        message="The banner disappears immediately for every user."
        danger
        confirmLabel="Clear announcement"
        loading={clearing}
      />
    </div>
  );
}
