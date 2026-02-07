import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
  Autocomplete,
} from "@mui/material";

import { listDevices, insertDevice } from "../api/device";
import { listGroups } from "../api/group";
import { listShops } from "../api/shop";
import { createLink, listGroupVideosByName } from "../api/link";

const safeMap = (arr, key) =>
  (arr || []).map((x) => x?.[key]).filter(Boolean);

const withLimitFallback = async (fn, params, caps = [100, 50]) => {
  try {
    const r = await fn(params);
    return r.data.items || [];
  } catch (e) {
    // if backend rejects limit, retry with caps
    if (e?.response?.status === 422 && params?.limit) {
      for (const cap of caps) {
        try {
          const r2 = await fn({ ...params, limit: cap });
          return r2.data.items || [];
        } catch (e2) {
          if (e2?.response?.status !== 422) throw e2;
        }
      }
      const r3 = await fn({});
      return r3.data.items || [];
    }
    throw e;
  }
};

export default function Linker() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [deviceOpts, setDeviceOpts] = useState([]);
  const [groupOpts, setGroupOpts] = useState([]);
  const [shopOpts, setShopOpts] = useState([]);

  const [dMobile, setDMobile] = useState("");
  const [dGroup, setDGroup] = useState("");
  const [dShop, setDShop] = useState("");

  const [loadingDevice, setLoadingDevice] = useState(false);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [loadingShop, setLoadingShop] = useState(false);

  const lastQ = useRef({ device: "", group: "", shop: "" });

  const canSubmit = useMemo(() => {
    return Boolean(dMobile?.trim() && dGroup?.trim() && dShop?.trim());
  }, [dMobile, dGroup, dShop]);

  const reloadAll = async () => {
    setBusy(true);
    setMsg("");
    try {
      const MAX = 50;
      const [d, g, s] = await Promise.all([
        listDevices({ limit: MAX, offset: 0 }).then((r) => r.data.items || []),
        withLimitFallback(listGroups, { limit: MAX, offset: 0 }),
        withLimitFallback(listShops, { limit: MAX, offset: 0 }),
      ]);
      setDeviceOpts(safeMap(d, "mobile_id"));
      setGroupOpts(safeMap(g, "gname"));
      setShopOpts(safeMap(s, "shop_name"));
    } catch (e) {
      setMsg(`Failed to load lists: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    reloadAll();
  }, []);

  // server-side filtering per field (lightweight)
  useEffect(() => {
    const q = dMobile?.trim() || "";
    if (q === lastQ.current.device) return;
    lastQ.current.device = q;
    setLoadingDevice(true);
    listDevices({ q, limit: 50, offset: 0 })
      .then((r) => setDeviceOpts(safeMap(r.data.items || [], "mobile_id")))
      .catch(() => {})
      .finally(() => setLoadingDevice(false));
  }, [dMobile]);

  useEffect(() => {
    const q = dGroup?.trim() || "";
    if (q === lastQ.current.group) return;
    lastQ.current.group = q;
    setLoadingGroup(true);
    listGroups({ q, limit: 50, offset: 0 })
      .then((r) => setGroupOpts(safeMap(r.data.items || [], "gname")))
      .catch(() => {})
      .finally(() => setLoadingGroup(false));
  }, [dGroup]);

  useEffect(() => {
    const q = dShop?.trim() || "";
    if (q === lastQ.current.shop) return;
    lastQ.current.shop = q;
    setLoadingShop(true);
    listShops({ q, limit: 50, offset: 0 })
      .then((r) => setShopOpts(safeMap(r.data.items || [], "shop_name")))
      .catch(() => {})
      .finally(() => setLoadingShop(false));
  }, [dShop]);

  const handleCreate = async () => {
    setMsg("");
    const mobile_id = (dMobile || "").trim();
    const gname = (dGroup || "").trim();
    const shop_name = (dShop || "").trim();

    if (!mobile_id || !gname || !shop_name) {
      setMsg("Please select Device, Group and Shop.");
      return;
    }

    setBusy(true);
    try {
      // 1) Insert device first (as you requested)
      await insertDevice(mobile_id, false).catch((e) => {
        // If you later add uniqueness and it becomes 409, ignore it
        const st = e?.response?.status;
        if (st && st !== 409) throw e;
      });

      // 2) Get all videos linked to this group
      const gv = await listGroupVideosByName(gname);
      const video_names = gv?.data?.video_names || [];

      if (!video_names.length) {
        throw new Error(`No videos are linked to group "${gname}".`);
      }

      // 3) Create link per video
      for (const video_name of video_names) {
        await createLink({ mobile_id, video_name, shop_name, gname });
      }

      setMsg(`✅ Device added + linked (${video_names.length} video(s)).`);
    } catch (e) {
      setMsg(`❌ Failed: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setBusy(false);
      // optional refresh lists
      reloadAll().catch(() => {});
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2} sx={{ maxWidth: 720 }}>
        <Typography variant="h6">Add Device + Assign (Group + Shop)</Typography>

        {msg ? <Alert severity={msg.startsWith("✅") ? "success" : "error"}>{msg}</Alert> : null}

        <Autocomplete
          freeSolo
          options={deviceOpts}
          value={dMobile}
          onInputChange={(e, v) => setDMobile(v || "")}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Device (mobile_id)"
              placeholder="Type or pick a device mobile_id"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loadingDevice ? <CircularProgress size={18} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        <Autocomplete
          options={groupOpts}
          value={dGroup}
          onInputChange={(e, v) => setDGroup(v || "")}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Group"
              placeholder="Select group"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loadingGroup ? <CircularProgress size={18} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        <Autocomplete
          options={shopOpts}
          value={dShop}
          onInputChange={(e, v) => setDShop(v || "")}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Shop"
              placeholder="Select shop"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loadingShop ? <CircularProgress size={18} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!canSubmit || busy}
          >
            {busy ? "Working..." : "Add Device & Create Relation"}
          </Button>

          <Button variant="outlined" onClick={reloadAll} disabled={busy}>
            Reload lists
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

