// Shared data hooks/helpers for the Groups pages. All HTTP goes through the
// shared client; every consumer gets explicit {loading, error, reload} so a
// failed fetch can never render as an innocent empty state.
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPut, normalizeList } from "../../lib/api";

// The backend's "no group" sentinel (content linked to no group at all).
// UI name for it everywhere: "Ungrouped".
export const NO_GROUP_VALUE = "_none";
export const NO_GROUP_LABEL = "Ungrouped";

// The API caps list endpoints at 1000 — use it instead of the legacy 50.
export const LIST_LIMIT = 1000;

// GET /group/{g}/attachments →
// { videos[], video_count, advertisements[], advertisement_count, devices[], device_count }
export function useGroupAttachments(gname) {
  const [attachments, setAttachments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seqRef = useRef(0);

  const reload = useCallback(async () => {
    if (!gname || gname === NO_GROUP_VALUE) {
      setAttachments(null);
      setLoading(false);
      setError(null);
      return;
    }
    const seq = ++seqRef.current;
    setLoading(true);
    const res = await apiGet(`/group/${encodeURIComponent(gname)}/attachments`);
    if (seq !== seqRef.current) return;
    if (res.ok) {
      setAttachments(res.data);
      setError(null);
    } else {
      setError(res.message);
    }
    setLoading(false);
  }, [gname]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(
    () => () => {
      seqRef.current += 1; // invalidate in-flight loads on unmount
    },
    []
  );

  return { attachments, loading, error, reload };
}

// GET /groups?limit=1000 — the full group list (replaces the legacy 50 cap).
export function useGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seqRef = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    const res = await apiGet("/groups", { params: { limit: LIST_LIMIT, offset: 0 } });
    if (seq !== seqRef.current) return;
    if (res.ok) {
      setGroups(normalizeList(res.data, "items").items);
      setError(null);
    } else {
      setError(res.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(
    () => () => {
      seqRef.current += 1;
    },
    []
  );

  return { groups, loading, error, reload };
}

// PUT /group/{gname} {gname: newName}. Used by both the detail-header pencil
// and the Settings tab so the rename call exists exactly once. Result must be
// checked by the caller (the legacy page silently swallowed failures).
export function renameGroup(gname, newName) {
  return apiPut(`/group/${encodeURIComponent(gname)}`, { gname: newName });
}
