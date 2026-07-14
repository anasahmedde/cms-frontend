// Locations list — rebuilt legacy Shop.js list half. Card grid with lazy
// screen counts, server-side ?q= search (deep-linkable), checked create,
// delete with the 409 → force flow. Per-location detail lives at
// /locations/:shopName (LocationDetail).
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MapPin, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "../lib/auth";
import PermissionDenied from "./PermissionDenied";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import SearchInput from "../ui/SearchInput";
import Skeleton from "../ui/Skeleton";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import LocationCard from "../content/locations/LocationCard";
import CreateLocationModal from "../content/locations/CreateLocationModal";
import DeleteLocationModal from "../content/locations/DeleteLocationModal";
import { fetchLocations, clearScreenCountCache } from "../content/locations/lib";

function CardSkeletons({ count = 6 }) {
  return (
    <div className="u-grid-cards" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ui-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="40%" height={12} />
          <Skeleton width="50%" height={12} />
        </div>
      ))}
    </div>
  );
}

export default function Locations() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [del, setDel] = useState(null); // shop being deleted

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetchLocations(q);
    if (res.ok) setItems(res.items);
    else setError(res.message || "Could not load locations");
    setLoading(false);
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const setQuery = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("q", next);
    else params.delete("q");
    setSearchParams(params, { replace: true });
  };

  const refresh = () => {
    clearScreenCountCache();
    load();
  };

  // Same gate the legacy Shops page lived behind (App.js manage_shops).
  if (!hasPermission("manage_shops")) return <PermissionDenied />;

  return (
    <div>
      <PageHeader
        title="Locations"
        subtitle={
          loading
            ? "Loading locations…"
            : `${items.length} location${items.length === 1 ? "" : "s"}${q ? ` matching "${q}"` : ""}`
        }
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={refresh} disabled={loading}>
              Refresh
            </Button>
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>
              Add location
            </Button>
          </>
        }
      />

      <div style={{ maxWidth: 400, marginBottom: 16 }}>
        <SearchInput value={q} onChange={setQuery} placeholder="Search locations" />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <CardSkeletons />
      ) : items.length === 0 ? (
        q ? (
          <EmptyState
            icon={MapPin}
            title={`No locations match "${q}"`}
            hint="Try a different search, or clear it to see every location."
            action={
              <Button variant="secondary" onClick={() => setQuery("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={MapPin}
            title="No locations yet"
            hint="Create a location for each store or venue, then pick it when enrolling screens."
            action={
              <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                Add location
              </Button>
            }
          />
        )
      ) : (
        <div className="u-grid-cards">
          {items.map((shop) => (
            <LocationCard key={shop.id} shop={shop} onDelete={setDel} />
          ))}
        </div>
      )}

      <CreateLocationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => load()}
      />
      <DeleteLocationModal
        shop={del}
        onClose={() => setDel(null)}
        onDeleted={() => {
          clearScreenCountCache();
          load();
        }}
      />
    </div>
  );
}
