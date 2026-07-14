// Screens at this location (legacy "📱 Associated Devices" panel, now through
// the shared authed client with real loading/error/empty states). Every entity
// is a link: screen → /screens/{mobile_id}, group → /groups/{gname}; when the
// company has a screen template, each row links straight to that screen's
// per-screen content override (Content & Layout tab).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MonitorPlay, RefreshCw } from "lucide-react";
import Card from "../../ui/Card";
import Table from "../../ui/Table";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import CopyButton from "../../ui/CopyButton";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import { fetchLocationScreens } from "./lib";

const stop = (e) => e.stopPropagation();

function buildColumns(hasTemplate) {
  const columns = [
    {
      key: "device_name",
      label: "Screen",
      render: (d) => (
        <Link
          to={`/screens/${encodeURIComponent(d.mobile_id)}`}
          onClick={stop}
          onKeyDown={stop}
          style={{ fontWeight: 600 }}
        >
          {d.device_name || <span className="u-faint" style={{ fontStyle: "italic" }}>Unnamed screen</span>}
        </Link>
      ),
    },
    {
      key: "mobile_id",
      label: "Device ID",
      render: (d) => (
        <span className="u-flex u-nowrap" onClick={stop} onKeyDown={stop}>
          <span className="mono" style={{ fontSize: 12 }}>{d.mobile_id}</span>
          <CopyButton value={d.mobile_id} small />
        </span>
      ),
    },
    {
      key: "group_name",
      label: "Group",
      render: (d) =>
        d.group_name ? (
          <Link
            to={`/groups/${encodeURIComponent(d.group_name)}`}
            onClick={stop}
            onKeyDown={stop}
            className="ui-badge ui-badge--info"
            style={{ textDecoration: "none" }}
          >
            {d.group_name}
          </Link>
        ) : (
          <Badge tone="warn">Ungrouped</Badge>
        ),
    },
  ];
  if (hasTemplate) {
    columns.push({
      key: "override",
      label: "Template content",
      render: (d) => (
        <Link
          to={`/screens/${encodeURIComponent(d.mobile_id)}?tab=content`}
          onClick={stop}
          onKeyDown={stop}
          title="Override this screen's template content (otherwise it uses the location's)"
          style={{ fontSize: 13 }}
        >
          Override for this screen
        </Link>
      ),
    });
  }
  return columns;
}

export default function ScreensCard({ shopName, hasTemplate }) {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetchLocationScreens(shopName);
    if (res.ok) setDevices(res.devices);
    else setError(res.message || "Could not load this location's screens");
    setLoading(false);
  }, [shopName]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo(() => buildColumns(hasTemplate), [hasTemplate]);

  return (
    <Card
      title={loading ? "Screens" : `Screens (${devices.length})`}
      padding={0}
      actions={
        <IconButton label="Refresh screens" icon={RefreshCw} size="sm" onClick={load} disabled={loading} />
      }
    >
      {error ? (
        <div style={{ padding: 16 }}>
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : (
        <Table
          columns={columns}
          rows={devices}
          rowKey="mobile_id"
          loading={loading}
          skeletonRows={3}
          onRowClick={(d) => navigate(`/screens/${encodeURIComponent(d.mobile_id)}`)}
          empty={
            <EmptyState
              icon={MonitorPlay}
              title="No screens at this location"
              hint="Pick this location when enrolling a screen (Add screen), or when assigning content on a screen's Content & Layout tab."
              action={
                <Link to="/screens">
                  <Button variant="secondary" size="sm">Go to Screens</Button>
                </Link>
              }
            />
          }
        />
      )}
    </Card>
  );
}
