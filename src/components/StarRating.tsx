import React from 'react';

interface StarRatingProps {
  rating: number;
  compact?: boolean;
  showOutOfFive?: boolean;
}

export function StarRating({ rating, compact = false, showOutOfFive = false }: StarRatingProps) {
  const hasRating = typeof rating === 'number' && rating > 0;
  const normalized = hasRating ? Math.max(0, Math.min(5, rating > 5 ? rating / 2 : rating)) : 0;
  const starSize = compact ? 11 : 14;

  return (
    <span
      className="inline-flex items-center gap-1.5 tabular-nums"
      aria-label={hasRating ? `Rating pasar ${normalized.toFixed(1)} dari 5 bintang` : 'Belum ada rating pasar'}
    >
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((index) => {
          const fillRatio = hasRating ? Math.max(0, Math.min(1, normalized - (index - 1))) : 0;
          return (
            <span
              key={index}
              className="relative inline-block shrink-0"
              style={{ width: starSize, height: starSize }}
            >
              <svg
                viewBox="0 0 24 24"
                width={starSize}
                height={starSize}
                className="text-slate-200 dark:text-slate-700 fill-current block"
              >
                <path d="M12 2.2l2.92 5.91 6.53.95-4.72 4.6 1.11 6.5L12 17.09l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2.2z" />
              </svg>
              {fillRatio > 0 && (
                <span
                  className="absolute inset-y-0 left-0 overflow-hidden"
                  style={{ width: `${Math.round(fillRatio * 100)}%` }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width={starSize}
                    height={starSize}
                    className="text-amber-500 fill-current block"
                  >
                    <path d="M12 2.2l2.92 5.91 6.53.95-4.72 4.6 1.11 6.5L12 17.09l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2.2z" />
                  </svg>
                </span>
              )}
            </span>
          );
        })}
      </span>
      {hasRating ? (
        <span
          className={`font-semibold text-slate-800 dark:text-slate-200 ${
            compact ? 'text-[11px]' : 'text-xs'
          }`}
        >
          {normalized.toFixed(1)}
          {showOutOfFive && <span className="font-normal text-slate-500 dark:text-slate-400"> / 5</span>}
        </span>
      ) : (
        <span className={`font-medium text-slate-400 dark:text-slate-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          Belum ada rating
        </span>
      )}
    </span>
  );
}
