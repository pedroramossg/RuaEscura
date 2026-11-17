import React, { useMemo, useState } from 'react';

export interface VirtualizedListProps<T> {
  items: ReadonlyArray<T>;
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemKey?: (item: T, index: number) => string | number;
  pageSize?: number;
  initialVisibleCount?: number;
  windowStart?: number;
  windowSize?: number;
  showLoadMore?: boolean;
  loadMoreLabel?: string;
  emptyState?: React.ReactNode;
  listClassName?: string;
  itemClassName?: string;
  className?: string;
  ariaLabel?: string;
  as?: 'ul' | 'ol' | 'div';
  onLoadMore?: (nextVisibleCount: number) => void;
}

/**
 * Lightweight paginated & slice-windowed list helper designed for LightsTab and ReportsTab
 * without relying on fragile DOM height measurements in JSDOM.
 */
export function VirtualizedList<T>({
  items,
  renderItem,
  getItemKey,
  pageSize = 10,
  initialVisibleCount,
  windowStart = 0,
  windowSize,
  showLoadMore,
  loadMoreLabel = 'Carregar mais',
  emptyState = null,
  listClassName = 'space-y-3',
  itemClassName = '',
  className = '',
  ariaLabel,
  as = 'ul',
  onLoadMore,
}: VirtualizedListProps<T>): React.ReactElement | null {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const [visibleCount, setVisibleCount] = useState<number>(() =>
    Math.max(1, Math.floor(initialVisibleCount ?? safePageSize))
  );

  const isWindowControlled = windowSize !== undefined;
  const start = Math.max(0, Math.min(Math.floor(windowStart), items.length));
  const effectiveLimit = isWindowControlled
    ? Math.max(1, Math.floor(windowSize))
    : visibleCount;
  const end = Math.min(items.length, start + effectiveLimit);

  const visibleSlice = useMemo(() => items.slice(start, end), [items, start, end]);
  const remainingCount = Math.max(0, items.length - end);
  const shouldRenderLoadMore =
    (showLoadMore ?? !isWindowControlled) && remainingCount > 0;

  if (items.length === 0) {
    return emptyState ? <div className={className}>{emptyState}</div> : null;
  }

  const handleLoadMore = () => {
    const nextCount = Math.min(items.length - start, visibleCount + safePageSize);
    setVisibleCount(nextCount);
    onLoadMore?.(nextCount);
  };

  const renderedItems = visibleSlice.map((item, offset) => {
    const absoluteIndex = start + offset;
    const key = getItemKey ? getItemKey(item, absoluteIndex) : absoluteIndex;
    const content = renderItem(item, absoluteIndex);

    if (as === 'div') {
      return (
        <div key={key} className={itemClassName || undefined}>
          {content}
        </div>
      );
    }

    return (
      <li key={key} className={itemClassName || undefined}>
        {content}
      </li>
    );
  });

  const ListTag = as;

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <ListTag
        aria-label={ariaLabel}
        data-slice-start={start}
        data-slice-end={end}
        data-total-count={items.length}
        className={listClassName}
      >
        {renderedItems}
      </ListTag>

      {shouldRenderLoadMore && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={handleLoadMore}
            className="min-h-[44px] px-5 rounded-full text-sm font-medium bg-[#FEF1CF] text-[#0131CD] border border-[#0131CD]/25 hover:bg-[#0131CD] hover:text-[#FEF1CF] active:scale-[0.98] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0131CD]"
          >
            {loadMoreLabel} ({remainingCount})
          </button>
        </div>
      )}
    </div>
  );
}
