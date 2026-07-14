// Add one media item to this screen's playlist — port of the legacy
// EditContentModal add flow (RecentLinks.js:1692): datalist autocomplete,
// group-restricted choices when the screen belongs to a group, exact
// validation copy, POST /link {mobile_id, video_name, shop_name, gname?}.
import { useCallback, useEffect, useId, useState } from "react";
import { Plus } from "lucide-react";
import { apiGet, apiPost, normalizeList } from "../../lib/api";
import Button from "../../ui/Button";
import { Field, Input, Select } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import { isRealGroup } from "./useScreenDevice";

export default function AddLinkForm({ device, existingVideos, defaultShop, onAdded }) {
  const toast = useToast();
  const listId = useId();
  const gname = isRealGroup(device.group_name) ? device.group_name : null;

  const [videoNames, setVideoNames] = useState([]);
  const [shops, setShops] = useState([]);
  const [listsError, setListsError] = useState(null);
  const [listsLoading, setListsLoading] = useState(true);

  const [typedVideo, setTypedVideo] = useState("");
  const [shop, setShop] = useState(defaultShop || "");
  const [fieldError, setFieldError] = useState("");
  const [adding, setAdding] = useState(false);

  const loadLists = useCallback(async () => {
    setListsLoading(true);
    setListsError(null);
    const [videosRes, shopsRes] = await Promise.all([
      gname
        ? apiGet(`/group/${encodeURIComponent(gname)}/videos`)
        : apiGet("/videos", { params: { limit: 500 } }),
      apiGet("/shops", { params: { limit: 500 } }),
    ]);
    if (videosRes.ok) {
      const names = gname
        ? videosRes.data?.video_names || []
        : normalizeList(videosRes.data, "items").items.map((v) => v.video_name).filter(Boolean);
      setVideoNames(Array.isArray(names) ? names : []);
    }
    if (shopsRes.ok) {
      const names = normalizeList(shopsRes.data, "items")
        .items.map((s) => s.shop_name)
        .filter(Boolean);
      setShops(names);
      setShop((prev) => prev || defaultShop || names[0] || "");
    }
    if (!videosRes.ok || !shopsRes.ok) {
      setListsError((!videosRes.ok ? videosRes : shopsRes).message || "Could not load the media list");
    }
    setListsLoading(false);
  }, [gname, defaultShop]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const add = async () => {
    const v = typedVideo.trim();
    if (!v) return;
    if (!videoNames.includes(v)) {
      setFieldError(
        gname
          ? `"${v}" is not linked to group "${gname}". Add it to the group's playlist first.`
          : `"${v}" is not in the media list.`
      );
      return;
    }
    if (existingVideos.includes(v)) {
      setFieldError(`"${v}" is already in this screen's playlist.`);
      return;
    }
    if (!shop) {
      setFieldError("Pick a location for this assignment.");
      return;
    }
    setFieldError("");
    setAdding(true);
    const res = await apiPost("/link", {
      mobile_id: device.mobile_id,
      video_name: v,
      shop_name: shop,
      ...(gname ? { gname } : {}),
    });
    setAdding(false);
    if (res.ok) {
      toast.success(`Assigned "${v}" to this screen`);
      setTypedVideo("");
      onAdded();
    } else {
      toast.error(res.message || "Could not assign the media");
    }
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Assign media to this screen</div>
      {listsError && (
        <div role="alert" style={{ fontSize: 13, color: "var(--danger)", marginBottom: 10 }}>
          {listsError}{" "}
          <Button size="sm" variant="ghost" onClick={loadLists}>
            Retry
          </Button>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 220px" }}>
          <Field
            label={gname ? `Media (from group "${gname}")` : "Media"}
            htmlFor={`${listId}-video`}
            error={fieldError || undefined}
          >
            <Input
              id={`${listId}-video`}
              list={`${listId}-names`}
              value={typedVideo}
              placeholder="Type a media name…"
              disabled={listsLoading}
              onChange={(e) => {
                setTypedVideo(e.target.value);
                if (fieldError) setFieldError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </Field>
          <datalist id={`${listId}-names`}>
            {videoNames.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <Field label="Location" htmlFor={`${listId}-shop`}>
            <Select
              id={`${listId}-shop`}
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              disabled={listsLoading}
              placeholder="Select a location…"
              options={shops.map((s) => ({ value: s, label: s }))}
            />
          </Field>
        </div>
        <Button icon={Plus} onClick={add} loading={adding} disabled={!typedVideo.trim() || listsLoading}>
          Assign
        </Button>
      </div>
    </div>
  );
}
