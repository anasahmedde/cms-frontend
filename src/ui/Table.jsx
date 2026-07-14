// Data table: sticky header, skeleton loading rows, empty node, row click.
// Column: { key, label, width, mono, render, align } — render(row) wins over
// row[key]; null/undefined cells render "—".
import Skeleton from "./Skeleton";
import "./kit-data.css";

function cellContent(col, row) {
  if (col.render) return col.render(row);
  const v = row[col.key];
  return v === null || v === undefined || v === "" ? "—" : v;
}

function rowKeyOf(rowKey, row, index) {
  if (typeof rowKey === "function") return rowKey(row, index);
  if (rowKey && row[rowKey] !== undefined) return row[rowKey];
  return index;
}

export default function Table({
  columns = [],
  rows = [],
  rowKey,
  loading = false,
  skeletonRows = 5,
  empty = null,
  onRowClick,
  stickyHeader = false,
}) {
  const clickable = typeof onRowClick === "function" && !loading;

  return (
    <div className="u-scroll-x ui-table-wrap">
      <table className={`ui-table${stickyHeader ? " ui-table-sticky" : ""}`}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  textAlign: col.align || "left",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: skeletonRows }, (_, i) => (
              <tr key={`skeleton-${i}`} aria-hidden="true">
                {columns.map((col) => (
                  <td key={col.key}>
                    <Skeleton width={i % 2 ? "55%" : "75%"} height={12} />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && rows.length === 0 && (
            <tr>
              <td className="ui-table-empty" colSpan={columns.length}>
                {empty || "No data"}
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((row, index) => (
              <tr
                key={rowKeyOf(rowKey, row, index)}
                className={clickable ? "ui-table-row-clickable" : undefined}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onRowClick(row) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={col.mono ? "ui-table-cell-mono" : undefined}
                    style={{ textAlign: col.align || "left" }}
                  >
                    {cellContent(col, row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
