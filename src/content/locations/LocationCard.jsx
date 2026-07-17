// One location in the /locations grid: name → detail, ID, lazy screen count.
// The count loads per card through the shared authed client (the legacy page
// used a bare unauthenticated fetch, and only on expand).
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, MonitorPlay, Trash2 } from "lucide-react";
import IconButton from "../../ui/IconButton";
import Skeleton from "../../ui/Skeleton";
import { fetchScreenCount } from "./lib";

const stop = (e) => e.stopPropagation();

function ScreenCount({ shopName }) {
  const [state, setState] = useState({ loading: true, error: "", count: null });

  const load = useCallback(async () => {
    setState({ loading: true, error: "", count: null });
    const res = await fetchScreenCount(shopName);
    if (res.ok) setState({ loading: false, error: "", count: res.count });
    else setState({ loading: false, error: res.message || "Failed", count: null });
  }, [shopName]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.loading) return <Skeleton width={90} height={12} />;
  if (state.error) {
    // A failed count must never read as "0 screens".
    return (
      <span className="u-faint u-flex" onClick={stop} onKeyDown={stop}>
        Screen count unavailable
        <button
          type="button"
          onClick={load}
          aria-label={`Retry loading screen count for ${shopName}`}
          style={{
            border: "none",
            background: "none",
            padding: 0,
            color: "var(--accent)",
            cursor: "pointer",
            font: "inherit",
          }}
        >
          Retry
        </button>
      </span>
    );
  }
  return (
    <span className="u-flex u-muted" style={{ fontSize: 13 }}>
      <MonitorPlay size={14} aria-hidden="true" />
      {state.count} screen{state.count === 1 ? "" : "s"}
    </span>
  );
}

export default function LocationCard({ shop, onDelete }) {
  const navigate = useNavigate();
  const to = `/locations/${encodeURIComponent(shop.shop_name)}`;
  return (
    <div
      className="ui-card"
      onClick={() => navigate(to)}
      style={{ padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div className="u-between">
        <span className="u-flex" style={{ minWidth: 0 }}>
          <span aria-hidden="true" style={{ color: "var(--text-muted)", display: "flex" }}>
            <MapPin size={16} />
          </span>
          <Link
            to={to}
            onClick={stop}
            onKeyDown={stop}
            style={{
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {shop.shop_name}
          </Link>
        </span>
        <span onClick={stop} onKeyDown={stop}>
          <IconButton
            label={`Delete location ${shop.shop_name}`}
            icon={Trash2}
            variant="danger"
            size="sm"
            onClick={() => onDelete(shop)}
          />
        </span>
      </div>
      <span className="u-faint mono">ID: {shop.id}</span>
      <ScreenCount shopName={shop.shop_name} />
    </div>
  );
}
