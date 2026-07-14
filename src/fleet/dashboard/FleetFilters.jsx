// Client-side filter bar over the loaded fleet: one search box per entity
// dimension (screen / group / location / media) + Clear, with notes for
// hidden inactive screens and truncated loads.
import { Link } from "react-router-dom";
import SearchInput from "../../ui/SearchInput";
import Button from "../../ui/Button";
import "./dashboard.css";

export default function FleetFilters({
  filters, // { screen, group, location, media }
  onChange, // (key, value) =>
  onClear,
  inactiveCount = 0,
  truncatedLinks = false,
  totalScreens = 0,
  loadedScreens = 0,
}) {
  const hasFilters = Object.values(filters).some((v) => v);

  return (
    <div className="fleet-filters">
      <SearchInput
        value={filters.screen}
        onChange={(v) => onChange("screen", v)}
        placeholder="Screen name or Device ID"
      />
      <SearchInput
        value={filters.group}
        onChange={(v) => onChange("group", v)}
        placeholder="Group"
      />
      <SearchInput
        value={filters.location}
        onChange={(v) => onChange("location", v)}
        placeholder="Location"
      />
      <SearchInput
        value={filters.media}
        onChange={(v) => onChange("media", v)}
        placeholder="Media name"
      />
      <Button variant="ghost" size="sm" onClick={onClear} disabled={!hasFilters}>
        Clear
      </Button>
      {inactiveCount > 0 && (
        <div className="fleet-filters-note">
          {inactiveCount} inactive {inactiveCount === 1 ? "screen" : "screens"} hidden —{" "}
          <Link to="/screens">manage in Screens</Link>
        </div>
      )}
      {loadedScreens < totalScreens && (
        <div className="fleet-filters-note">
          Showing the first {loadedScreens} of {totalScreens} screens —{" "}
          <Link to="/screens">see Screens for the full list</Link>
        </div>
      )}
      {truncatedLinks && (
        <div className="fleet-filters-note">
          Media assignment data was truncated at 1000 rows — location and media
          details may be incomplete for some screens.
        </div>
      )}
    </div>
  );
}
