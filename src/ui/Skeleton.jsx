import "./kit-core.css";

const dim = (v) => (typeof v === "number" ? `${v}px` : v);

// Shimmering placeholder block shown while real content loads.
export default function Skeleton({ width = "100%", height = 14, style }) {
  return (
    <span
      className="ui-skeleton"
      aria-hidden="true"
      style={{ width: dim(width), height: dim(height), ...style }}
    />
  );
}

// Paragraph-shaped stack of skeleton lines (last line shortened).
export function SkeletonText({ lines = 3 }) {
  return (
    <span className="ui-skeleton-text" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </span>
  );
}
