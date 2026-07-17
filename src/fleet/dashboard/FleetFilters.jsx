// Client-side filter bar over the loaded fleet: ONE search matching screen
// name/ID, group, location, or assigned media, with notes for hidden inactive
// screens and truncated loads.
import { Link } from "react-router-dom";
import SearchInput from "../../ui/SearchInput";
import Button from "../../ui/Button";
import "./dashboard.css";

export default function FleetFilters({
  query,
  onChange,
  onClear,
  inactiveCount = 0,
  truncatedLinks = false,
  totalScreens = 0,
  loadedScreens = 0,
}) {
  return (
    <div className="fleet-filters fleet-filters--single">
      <SearchInput
        value={query}
        onChange={onChange}
        placeholder="Search screens, groups, locations or media…"
      />
      {query && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      )}
      {inactiveCount > 0 && (
        <span className="u-faint">
          {inactiveCount} inactive hidden — <Link to="/screens?status=inactive">manage in Screens</Link>
        </span>
      )}
      {truncatedLinks && (
        <span className="u-faint">Showing the first {loadedScreens} of {totalScreens} screens.</span>
      )}
    </div>
  );
}
