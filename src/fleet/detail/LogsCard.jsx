// Device logs viewer — GET /device/{id}/logs with log_type/date filters and
// an authorized CSV download from /device/{id}/logs/download (the legacy page
// only exposed logs through the temperature modal; this is the full viewer).
import { useCallback, useEffect, useId, useState } from "react";
import { Download, ScrollText } from "lucide-react";
import { api, apiGet } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import Table from "../../ui/Table";
import { Field, Input, Select } from "../../ui/Field";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import { useToast } from "../../ui/Toast";
import { downloadBlob } from "./csv";

const LOG_TYPES = [
  { value: "", label: "All types" },
  { value: "temperature", label: "Temperature" },
  { value: "door_open", label: "Door open" },
];

export default function LogsCard({ mobileId }) {
  const toast = useToast();
  const ids = useId();
  const [logType, setLogType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [state, setState] = useState({ loading: true, error: null, items: [] });
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const res = await apiGet(`/device/${encodeURIComponent(mobileId)}/logs`, {
      params: {
        log_type: logType || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: 500,
      },
    });
    if (res.ok) setState({ loading: false, error: null, items: res.data?.items || [] });
    else setState({ loading: false, error: res.message, items: [] });
  }, [mobileId, logType, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  // Authorized CSV download (the raw <a href> would drop the Bearer header).
  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/device/${encodeURIComponent(mobileId)}/logs/download`, {
        params: {
          log_type: logType || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
        responseType: "blob",
      });
      downloadBlob(`logs_${mobileId}.csv`, res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not download the logs CSV");
    }
    setDownloading(false);
  };

  const columns = [
    {
      key: "log_type",
      label: "Type",
      width: 140,
      render: (row) => <Badge tone="neutral">{String(row.log_type || "—").replace(/_/g, " ")}</Badge>,
    },
    { key: "value", label: "Value", mono: true, render: (row) => <span style={{ fontFamily: "var(--font-mono)" }}>{row.value ?? "—"}</span> },
    { key: "logged_at", label: "Logged at", render: (row) => formatDateTime(row.logged_at) },
  ];

  return (
    <Card
      title="Device logs"
      actions={
        <Button size="sm" variant="secondary" icon={Download} loading={downloading} onClick={downloadCsv}>
          Download CSV
        </Button>
      }
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "flex-end" }}>
        <div style={{ width: 180 }}>
          <Field label="Log type" htmlFor={`${ids}-type`}>
            <Select id={`${ids}-type`} value={logType} onChange={(e) => setLogType(e.target.value)} options={LOG_TYPES} />
          </Field>
        </div>
        <div style={{ width: 170 }}>
          <Field label="From" htmlFor={`${ids}-start`}>
            <Input id={`${ids}-start`} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
        </div>
        <div style={{ width: 170 }}>
          <Field label="To" htmlFor={`${ids}-end`}>
            <Input id={`${ids}-end`} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
      </div>

      {state.error ? (
        <ErrorState message={state.error} onRetry={load} />
      ) : (
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          <Table
            columns={columns}
            rows={state.items}
            rowKey="id"
            loading={state.loading}
            stickyHeader
            empty={
              <EmptyState
                icon={ScrollText}
                title="No log entries for these filters"
                hint="Try a wider date range or a different log type."
              />
            }
          />
        </div>
      )}
    </Card>
  );
}
