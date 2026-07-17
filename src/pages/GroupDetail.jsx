// Group detail: Playlist | Screens | Settings tabs at /groups/:gname.
import { useParams, useSearchParams } from "react-router-dom";
import { ListVideo, MonitorPlay, Settings2 } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import Tabs from "../ui/Tabs";
import Badge from "../ui/Badge";
import PlaylistEditor from "../content/groups/PlaylistEditor";
import GroupScreens from "../content/groups/GroupScreens";
import GroupSettings from "../content/groups/GroupSettings";
import { useGroupAttachments } from "../content/groups/useGroupAttachments";

export default function GroupDetail() {
  const { gname } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "playlist";
  const { attachments, loading, error, reload } = useGroupAttachments(gname);

  const screens = attachments?.device_count ?? attachments?.devices?.length ?? 0;

  return (
    <div>
      <PageHeader
        title={gname}
        subtitle={
          <span className="u-flex">
            Group
            <Badge tone={screens > 0 ? "info" : "warn"}>
              {screens} screen{screens === 1 ? "" : "s"}
            </Badge>
          </span>
        }
        breadcrumbs={[{ label: "Groups", to: "/groups" }, { label: gname }]}
      />
      <Tabs
        tabs={[
          { key: "playlist", label: "Playlist", icon: ListVideo },
          { key: "screens", label: "Screens", icon: MonitorPlay, badge: screens || undefined },
          { key: "settings", label: "Settings", icon: Settings2 },
        ]}
        active={tab}
        onChange={(key) => setParams({ tab: key }, { replace: true })}
      />
      <div style={{ marginTop: 16 }}>
        {tab === "playlist" && <PlaylistEditor gname={gname} onSaved={reload} />}
        {tab === "screens" && (
          <GroupScreens gname={gname} attachments={attachments} loading={loading} error={error} reload={reload} />
        )}
        {tab === "settings" && <GroupSettings gname={gname} attachments={attachments} reload={reload} />}
      </div>
    </div>
  );
}
