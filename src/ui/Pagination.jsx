// "Showing X–Y of Z" + prev/next + numbered window (max 7 pages shown).
// page is 1-based; onPage(nextPage) is only called with valid pages.
import { ChevronLeft, ChevronRight } from "lucide-react";
import IconButton from "./IconButton";
import "./kit-data.css";

const WINDOW = 7;

function pageWindow(page, pageCount) {
  const size = Math.min(WINDOW, pageCount);
  let start = Math.max(1, page - Math.floor(size / 2));
  start = Math.min(start, pageCount - size + 1);
  return Array.from({ length: size }, (_, i) => start + i);
}

export default function Pagination({ page = 1, pageSize = 20, total = 0, onPage }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="ui-pagination">
      <span className="ui-pagination-info" aria-live="polite">
        Showing {from}&ndash;{to} of {total}
      </span>
      {pageCount > 1 && (
        <nav className="ui-pagination-controls" aria-label="Pagination">
          <IconButton
            label="Previous page"
            icon={ChevronLeft}
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          />
          {pageWindow(page, pageCount).map((p) => (
            <button
              key={p}
              type="button"
              className={`ui-pagination-num${p === page ? " ui-pagination-num-active" : ""}`}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ))}
          <IconButton
            label="Next page"
            icon={ChevronRight}
            variant="ghost"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
          />
        </nav>
      )}
    </div>
  );
}
