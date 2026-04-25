import './Skeleton.scss';

export function Skeleton({ width, height, radius, className = '', style = {} }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ lines = 2 }) {
  return (
    <div className="skeleton-card">
      <Skeleton height={18} width="60%" radius={6} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? '40%' : '90%'} radius={4} />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 3 }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}

export default Skeleton;
