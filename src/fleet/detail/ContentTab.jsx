// Content & Layout tab: assigned playlist, layout editor (inline), clear
// media on screen, and the per-screen template-content override (legacy
// ZoneContentEditor mounted as-is when the company has a template).
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Eraser, Layers } from "lucide-react";
import { apiGet, apiPost } from "../../lib/api";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import ConfirmModal from "../../ui/ConfirmModal";
import ErrorState from "../../ui/ErrorState";
import Skeleton from "../../ui/Skeleton";
import { useToast } from "../../ui/Toast";
import LayoutEditor from "../LayoutEditor";
import ZoneContentEditor from "../../components/templates/ZoneContentEditor";
import TemplateAssignSelect from "../../components/templates/TemplateAssignSelect";
import PlaylistCard from "./PlaylistCard";
import { isRealGroup } from "./useScreenDevice";
import { useAuth, CONTENT_EDIT_PERMS } from "../../lib/auth";
import { useCompanyFeatures, featureOn } from "../../lib/features";

function fmtBytes(n) {
  if (!n || n <= 0) return "0 MB";
  const gb = n / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  return `${Math.round(n / (1024 * 1024))} MB`;
}

// Screen storage: shows the device's reported disk usage (so you can see when it's
// filling up) and the Clear-cache action, which tells the screen to delete its
// downloaded media and re-download. Storage numbers come from GET /device/:id/storage.
function StorageCard({ device }) {
  const { hasPermission } = useAuth();
  const canWipe = hasPermission("manage_devices");
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [st, setSt] = useState({ loading: true, error: null, data: null });

  const loadStorage = useCallback(async () => {
    setSt((s) => ({ ...s, loading: true }));
    const res = await apiGet(`/device/${encodeURIComponent(device.mobile_id)}/storage`);
    if (res.ok) setSt({ loading: false, error: null, data: res.data });
    else setSt({ loading: false, error: res.message || "Could not load storage info", data: null });
  }, [device.mobile_id]);

  useEffect(() => { loadStorage(); }, [loadStorage]);

  const clearMedia = async () => {
    setClearing(true);
    const res = await apiPost(`/device/${encodeURIComponent(device.mobile_id)}/wipe-videos`);
    setClearing(false);
    setConfirmOpen(false);
    if (res.ok) {
      toast.success(res.data?.message || "Clear-cache sent — the screen empties its storage and re-downloads on its next sync");
      loadStorage();
    } else {
      toast.error(res.message || "Could not send the clear-cache command");
    }
  };

  const s = st.data?.storage;
  const pct = s ? Math.min(100, Math.max(0, s.percent_used || 0)) : 0;
  const limit = s?.storage_limit_percent ?? 80;
  const near = pct >= limit;
  // Explicit semantic colors (the theme --accent is amber, which would read as a
  // warning at normal usage): green ok → amber near-limit → red critical. The
  // critical threshold (95) aligns with the Overview StorageCard's ProgressBar.
  const barColor = pct >= 95 ? "#ef4444" : near ? "#f59e0b" : "#10b981";

  return (
    <Card title="Screen storage">
      {st.loading ? (
        <Skeleton height={14} width="70%" />
      ) : st.error ? (
        <ErrorState message={st.error} onRetry={loadStorage} />
      ) : !st.data?.reported ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
          This screen hasn't reported its storage yet. It reports on startup and after each download.
        </p>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: "var(--text)" }}>
              {fmtBytes(s.used_bytes)} used of {fmtBytes(s.total_bytes)}
            </span>
            {/* Keep the label at full-contrast text color; the bar carries the color signal. */}
            <span style={{ color: "var(--text)", fontWeight: near ? 700 : 400 }}>
              {pct}%{near ? " · near limit" : ""}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Storage ${pct}% used`}
            style={{ height: 8, borderRadius: 4, background: "rgba(148,163,184,0.25)", overflow: "hidden" }}
          >
            <div style={{ width: `${pct}%`, height: "100%", background: barColor, transition: "width .3s" }} />
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>
            {fmtBytes(s.available_for_content_bytes)} free for content (limit {limit}% of disk)
            {st.data.last_updated ? ` · reported ${new Date(st.data.last_updated).toLocaleString()}` : ""}
          </p>
        </div>
      )}

      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
        Clearing the cache removes downloaded files from the screen's local storage to free space; the
        screen then re-downloads its assigned playlist. Nothing is deleted from the Media Library and no
        assignments change.
      </p>
      {canWipe && (
        <Button variant="danger" icon={Eraser} loading={clearing} onClick={() => setConfirmOpen(true)}>
          Clear cache &amp; free storage
        </Button>
      )}
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={clearMedia}
        loading={clearing}
        danger
        title="Clear cache on this screen"
        confirmLabel="Clear cache"
        message={`Delete all downloaded media on "${device.device_name || device.mobile_id}" to free storage? The screen goes blank briefly, then re-downloads its assigned playlist on the next sync. No assignments or Media Library files are deleted.`}
      />
    </Card>
  );
}

// Per-screen template-content override. Only rendered when the company has a
// linked screen template (GET /company/template). The legacy ZoneContentEditor
// is mounted as-is (device scope keys off the numeric device id).
const ZONE_TONES = {
  playlist: "rgba(16,185,129,0.55)",
  text: "rgba(59,130,246,0.55)",
  ticker: "rgba(59,130,246,0.4)",
  media: "rgba(245,158,11,0.55)",
  qr: "rgba(255,255,255,0.65)",
  clock: "rgba(148,163,184,0.55)",
};

function MiniTemplatePreview({ template }) {
  const zones = template?.zones || [];
  const landscape = (template?.design_width || 1920) >= (template?.design_height || 1080);
  const w = landscape ? 260 : 150;
  const h = landscape ? Math.round((w * (template?.design_height || 1080)) / (template?.design_width || 1920)) : 260;
  return (
    <div
      role="img"
      aria-label={`Template layout: ${zones.length} zones`}
      style={{ position: "relative", width: w, height: h, background: "#0a1628", borderRadius: 6, overflow: "hidden", flexShrink: 0 }}
    >
      {zones.map((z) => (
        <div
          key={z.key}
          title={`${z.key} (${z.type})`}
          style={{
            position: "absolute",
            left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%`,
            background: ZONE_TONES[z.type] || "rgba(255,255,255,0.3)",
            border: "1px solid rgba(255,255,255,0.35)",
            borderRadius: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, color: "#fff", overflow: "hidden", whiteSpace: "nowrap",
          }}
        >
          {z.type === "playlist" ? "▶ rotation" : z.key}
        </div>
      ))}
    </div>
  );
}
function TemplateContentCard({ device }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_devices");
  const canEditContent = CONTENT_EDIT_PERMS.some((perm) => hasPermission(perm));
  const [state, setState] = useState({ loading: true, error: null, template: null });
  const [editorOpen, setEditorOpen] = useState(false);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    // The EFFECTIVE template for THIS screen (screen > group > company default)
    // — with multiple templates linked, the company default may not be it.
    const res = await apiGet(`/device-config/${device.id}/template-content`);
    if (res.ok) setState({ loading: false, error: null, template: res.data?.template || null });
    else setState({ loading: false, error: res.message, template: null });
  }, [device.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.loading) {
    return (
      <Card title="Screen template content">
        <Skeleton height={14} width="60%" />
      </Card>
    );
  }
  if (state.error) {
    return (
      <Card title="Screen template content">
        <ErrorState message={state.error} onRetry={load} />
      </Card>
    );
  }
  if (!state.template) return null; // no template linked — nothing to fill in

  return (
    <Card title={`Screen template — ${state.template.name || "Untitled"} (v${state.template.version ?? 1})`}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
        <MiniTemplatePreview template={state.template} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
            This screen renders the company template. The <strong>▶ rotation</strong> zone plays
            the playlist and layout configured below; the other zones show template content.
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            Fill zones for every screen at once from{" "}
            <RouterLink to="/template-content">Template content</RouterLink>; overrides here apply
            to this screen only, and empty fields fall back to the location's content.
          </p>
        </div>
      </div>
      {canManage && (
        <div style={{ maxWidth: 480, marginBottom: 12 }}>
          <TemplateAssignSelect
            scope="device"
            targetId={device.id}
            inheritLabel="Inherited — group / company default"
            onChanged={load}
          />
        </div>
      )}
      {canEditContent && (
        <Button variant="secondary" icon={Layers} onClick={() => setEditorOpen(true)}>
          Override for this screen
        </Button>
      )}
      {editorOpen && (
        <div className="legacy-page">
          <ZoneContentEditor
            scope="device"
            targetId={device.id}
            targetName={device.device_name || device.mobile_id}
            onClose={() => setEditorOpen(false)}
          />
        </div>
      )}
    </Card>
  );
}

export default function ContentTab({ device, links, linksLoading, linksError, reloadLinks, onDeviceReload }) {
  const { features } = useCompanyFeatures();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_devices");
  const gname = isRealGroup(device.group_name) ? device.group_name : null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PlaylistCard
        device={device}
        links={links}
        loading={linksLoading}
        error={linksError}
        reload={reloadLinks}
        onDeviceReload={onDeviceReload}
      />

      {featureOn(features, "grid") && canManage && (
        <Card title="Layout">
          <LayoutEditor
            mobileId={device.mobile_id}
            gname={gname}
            onSaved={() => {
              reloadLinks();
              onDeviceReload();
            }}
          />
        </Card>
      )}

      <TemplateContentCard device={device} />

      <StorageCard device={device} />
    </div>
  );
}
