// Card grid for the Media Library, with a skeleton variant while loading.
import Skeleton from "../../ui/Skeleton";
import MediaCard from "./MediaCard";
import "./media.css";

function SkeletonCard() {
  return (
    <div className="media-card" aria-hidden="true">
      <div className="media-card-thumb">
        <Skeleton width={34} height={34} />
      </div>
      <div className="media-card-body">
        <Skeleton width="70%" height={14} />
        <Skeleton width="50%" height={12} />
        <Skeleton width="40%" height={12} />
      </div>
    </div>
  );
}

export default function MediaGrid({ items = [], loading, onPreview, onEdit, onWhereUsed, onDelete }) {
  if (loading) {
    return (
      <div className="media-grid" aria-busy="true" aria-label="Loading media">
        {Array.from({ length: 8 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className="media-grid">
      {items.map((item) => (
        <MediaCard
          key={`${item.kind}-${item.id}`}
          item={item}
          onPreview={onPreview}
          onEdit={onEdit}
          onWhereUsed={onWhereUsed}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
