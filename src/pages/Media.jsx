// Media Library — one page over both legacy stacks (videos + images).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Film, Upload } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import Tabs from "../ui/Tabs";
import SearchInput from "../ui/SearchInput";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import ConfirmModal from "../ui/ConfirmModal";
import { useToast } from "../ui/Toast";
import { apiDelete } from "../lib/api";
import MediaGrid from "../content/media/MediaGrid";
import UploadModal from "../content/media/UploadModal";
import EditModal from "../content/media/EditModal";
import PreviewModal from "../content/media/PreviewModal";
import WhereUsedModal from "../content/media/WhereUsedModal";
import { KINDS, LOAD_LIMIT, fetchMediaList } from "../content/media/lib";

const TAB_KINDS = { all: ["video", "image"], videos: ["video"], images: ["image"] };

export default function Media() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get("kind") === "image" ? "images" : params.get("kind") === "video" ? "videos" : "all";
  const [q, setQ] = useState(params.get("q") || "");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upload, setUpload] = useState(null); // kind being uploaded
  const [preview, setPreview] = useState(null);
  const [edit, setEdit] = useState(null);
  const [whereUsed, setWhereUsed] = useState(null);
  const [deleting, setDeleting] = useState(null); // {item, linked?}
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const kinds = TAB_KINDS[tab];
    const results = await Promise.all(kinds.map((k) => fetchMediaList(k)));
    const failed = results.find((r) => !r.ok);
    if (failed) {
      setError(failed.message);
    } else {
      setItems(results.flatMap((r) => r.items));
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const switchTab = (key) => {
    const next = new URLSearchParams(params);
    if (key === "videos") next.set("kind", "video");
    else if (key === "images") next.set("kind", "image");
    else next.delete("kind");
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => it.name.toLowerCase().includes(needle));
  }, [items, q]);

  const confirmDelete = async (force) => {
    const { item } = deleting;
    setBusy(true);
    const res = await apiDelete(`${KINDS[item.kind].itemPath(item.name)}${force ? "?force=true" : ""}`);
    setBusy(false);
    if (res.ok) {
      toast.success(`"${item.name}" deleted`);
      setDeleting(null);
      load();
      return;
    }
    if (res.status === 409 && !force) {
      setDeleting({ item, linked: res.detail?.linked || res.detail || {} });
      return;
    }
    toast.error(res.message);
    setDeleting(null);
  };

  const uploadKind = tab === "images" ? "image" : "video";

  return (
    <div>
      <PageHeader
        title="Media Library"
        subtitle="Playlist media plays in the screen rotation (videos, images, HTML, PDF); layout images fill slots in split/grid layouts"
        actions={
          <>
            <Button variant="secondary" icon={Upload} onClick={() => setUpload("image")}>Upload layout image</Button>
            <Button icon={Upload} onClick={() => setUpload("video")}>Upload media</Button>
          </>
        }
      />
      <div className="u-between" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        <Tabs
          tabs={[
            { key: "all", label: "All" },
            { key: "videos", label: "Playlist media" },
            { key: "images", label: "Layout images" },
          ]}
          active={tab}
          onChange={switchTab}
        />
        <div style={{ minWidth: 260 }}>
          <SearchInput value={q} onChange={setQ} placeholder="Search media…" />
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !loading && filtered.length === 0 ? (
        <EmptyState
          icon={Film}
          title={q ? "No media matches your search" : "No media yet"}
          hint={q ? "Try a different name." : "Upload a video or image to get started."}
          action={!q && <Button icon={Upload} onClick={() => setUpload(uploadKind)}>Upload {uploadKind}</Button>}
        />
      ) : (
        <>
          <MediaGrid
            items={filtered}
            loading={loading}
            onPreview={setPreview}
            onEdit={setEdit}
            onWhereUsed={setWhereUsed}
            onDelete={(item) => setDeleting({ item })}
          />
          {items.length >= LOAD_LIMIT && (
            <p className="u-faint" style={{ marginTop: 10 }}>
              Showing the first {LOAD_LIMIT} per kind — use search to narrow down.
            </p>
          )}
        </>
      )}

      <UploadModal
        open={!!upload}
        kind={upload || "video"}
        onClose={() => setUpload(null)}
        onUploaded={() => {
          setUpload(null);
          load();
        }}
      />
      <PreviewModal open={!!preview} item={preview} onClose={() => setPreview(null)} />
      <EditModal
        open={!!edit}
        item={edit}
        onClose={() => setEdit(null)}
        onSaved={() => {
          setEdit(null);
          load();
        }}
      />
      <WhereUsedModal open={!!whereUsed} item={whereUsed} onClose={() => setWhereUsed(null)} />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => confirmDelete(!!deleting?.linked)}
        title={`Delete ${deleting?.item?.name}`}
        message={
          deleting?.linked
            ? "This item is still assigned. Deleting it removes it from every screen and group listed below."
            : "Screens stop playing this item once their playlist refreshes. This cannot be undone."
        }
        danger
        confirmLabel={deleting?.linked ? "Delete and unassign" : "Delete"}
        loading={busy}
        linked={deleting?.linked}
      />
    </div>
  );
}
