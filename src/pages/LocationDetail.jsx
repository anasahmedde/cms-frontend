// Location detail — /locations/:shopName. Screens at this location plus the
// location-scope screen-template content editor (the legacy ZoneContentEditor,
// mounted as-is). Rename and delete live here; locations are keyed by name in
// the API, so a rename navigates to the new URL.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AssignScreensModal from "../content/locations/AssignScreensModal";
import { MapPinOff, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatDateTime } from "../lib/format";
import PermissionDenied from "./PermissionDenied";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import Skeleton, { SkeletonText } from "../ui/Skeleton";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import ScreensCard from "../content/locations/ScreensCard";
import TemplateContentCard from "../content/locations/TemplateContentCard";
import RenameLocationModal from "../content/locations/RenameLocationModal";
import DeleteLocationModal from "../content/locations/DeleteLocationModal";
import { fetchLocation, useCompanyTemplate, clearScreenCountCache } from "../content/locations/lib";

export default function LocationDetail() {
  const { shopName } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [screensKey, setScreensKey] = useState(0);
  const [del, setDel] = useState(null);

  // The template check gates the content editor AND the per-screen override
  // links in the Screens card; its failure shows in the template card only.
  const template = useCompanyTemplate();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotFound(false);
    const res = await fetchLocation(shopName);
    if (res.ok) {
      setShop(res.data);
    } else if (res.status === 404) {
      setNotFound(true);
    } else {
      setError(res.message || "Could not load the location");
    }
    setLoading(false);
  }, [shopName]);

  useEffect(() => {
    load();
  }, [load]);

  // Same gate the legacy Shops page lived behind (App.js manage_shops).
  if (!hasPermission("manage_shops")) return <PermissionDenied />;

  if (loading) {
    return (
      <div>
        <Skeleton width={280} height={28} style={{ marginBottom: 12 }} />
        <Skeleton width={420} height={14} style={{ marginBottom: 24 }} />
        <SkeletonText lines={6} />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={load} />;

  if (notFound) {
    return (
      <EmptyState
        icon={MapPinOff}
        title="Location not found"
        hint={`No location named "${shopName}" exists in this workspace. It may have been renamed or deleted.`}
        action={
          <Link to="/locations">
            <Button variant="secondary">Back to Locations</Button>
          </Link>
        }
      />
    );
  }

  if (!shop) return null;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Locations", to: "/locations" }, { label: shop.shop_name }]}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {shop.shop_name}
            <IconButton label="Rename location" icon={Pencil} size="sm" onClick={() => setRenameOpen(true)} />
          </span>
        }
        subtitle={`Location ID ${shop.id}${shop.created_at ? ` · Created ${formatDateTime(shop.created_at)}` : ""}`}
        actions={
          <>
            <Link to={`/screens?add=1&location=${encodeURIComponent(shop.shop_name)}`}>
              <Button variant="secondary">Add screen here</Button>
            </Link>
            <Button variant="secondary" onClick={() => setAssignOpen(true)}>
              Move screen here
            </Button>
            <Button variant="danger" icon={Trash2} onClick={() => setDel(shop)}>
              Delete location
            </Button>
          </>
        }
      />

      <div style={{ display: "grid", gap: 16 }}>
        <ScreensCard key={screensKey} shopName={shop.shop_name} hasTemplate={!!template.template} />
        <TemplateContentCard shop={shop} template={template} />
      </div>

      <AssignScreensModal
        shopName={shop.shop_name}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssigned={() => {
          setAssignOpen(false);
          setScreensKey((k) => k + 1);
        }}
      />
      <RenameLocationModal
        open={renameOpen}
        currentName={shop.shop_name}
        onClose={() => setRenameOpen(false)}
        onRenamed={(newName) => {
          clearScreenCountCache();
          navigate(`/locations/${encodeURIComponent(newName)}`, { replace: true });
        }}
      />
      <DeleteLocationModal
        shop={del}
        onClose={() => setDel(null)}
        onDeleted={() => {
          clearScreenCountCache();
          navigate("/locations");
        }}
      />
    </div>
  );
}
