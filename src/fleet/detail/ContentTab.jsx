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
import PlaylistCard from "./PlaylistCard";
import { isRealGroup } from "./useScreenDevice";

function ClearMediaCard({ device }) {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const clearMedia = async () => {
    setClearing(true);
    const res = await apiPost(`/device/${encodeURIComponent(device.mobile_id)}/wipe-videos`);
    setClearing(false);
    setConfirmOpen(false);
    if (res.ok) {
      toast.success(res.data?.message || "Clear command sent — the screen empties its storage on the next sync");
    } else {
      toast.error(res.message || "Could not send the clear command");
    }
  };

  return (
    <Card title="Clear media on screen">
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
        Removes the downloaded files from the screen's local storage. The screen then re-downloads
        its playlist. Nothing is deleted from the Media Library and no assignments change.
      </p>
      <Button variant="danger" icon={Eraser} onClick={() => setConfirmOpen(true)}>
        Clear media on screen
      </Button>
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={clearMedia}
        loading={clearing}
        danger
        title="Clear media on screen"
        confirmLabel="Clear media"
        message="Removes downloaded files from the screen; it re-downloads its playlist. No links are deleted."
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
  const [state, setState] = useState({ loading: true, error: null, template: null });
  const [editorOpen, setEditorOpen] = useState(false);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const res = await apiGet("/company/template");
    if (res.ok) setState({ loading: false, error: null, template: res.data?.template || null });
    else setState({ loading: false, error: res.message, template: null });
  }, []);

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
      <Button variant="secondary" icon={Layers} onClick={() => setEditorOpen(true)}>
        Override for this screen
      </Button>
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

      <TemplateContentCard device={device} />

      <ClearMediaCard device={device} />
    </div>
  );
}
