// Page-level header: optional breadcrumbs above, title + subtitle left,
// actions (buttons etc.) right.
import Breadcrumbs from "./Breadcrumbs";
import "./kit-data.css";

export default function PageHeader({ title, subtitle, breadcrumbs, actions }) {
  return (
    <header className="ui-page-header">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="ui-page-header-breadcrumbs">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}
        <h1 className="ui-page-header-title">{title}</h1>
        {subtitle && <p className="ui-page-header-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="ui-page-header-actions">{actions}</div>}
    </header>
  );
}
