// Breadcrumb trail. Items with "to" render as router links; the last item
// (or any item without "to") renders as plain text with aria-current.
import { Link } from "react-router-dom";
import "./kit-data.css";

export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav className="ui-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`}>
              {item.to && !isLast ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span
                  className="ui-breadcrumbs-current"
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span className="ui-breadcrumbs-sep" aria-hidden="true">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
