import React from 'react';

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  cols = 6
}) => {
  return (
    <div className="w-full border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-surface)] shadow-sm">
      {/* Header Skeleton */}
      <div className="bg-[var(--color-surface-offset)] border-b border-[var(--color-border)] px-6 py-4 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={`h-${i}`}
            className="h-4 bg-[var(--color-text-faint)]/20 rounded animate-pulse"
            style={{ width: `${100 / cols}%` }}
          />
        ))}
      </div>

      {/* Rows Skeleton */}
      <div className="divide-y divide-[var(--color-divider)]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`r-${r}`} className="px-6 py-4 flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={`c-${r}-${c}`}
                className="h-4 bg-[var(--color-text-faint)]/10 rounded animate-pulse"
                style={{
                  width: `${100 / cols}%`,
                  animationDelay: `${(r * 100) + (c * 50)}ms`
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
export default SkeletonTable;
