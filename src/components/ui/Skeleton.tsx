import React from 'react';

export interface SkeletonBlockProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  tone?: 'cream' | 'cobalt';
}

const ROUNDED_CLASSES: Record<NonNullable<SkeletonBlockProps['rounded']>, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

const TONE_CLASSES: Record<NonNullable<SkeletonBlockProps['tone']>, string> = {
  cream: 'bg-[#FEF1CF] border border-[#0131CD]/15',
  cobalt: 'bg-[#0131CD]/15 border border-[#0131CD]/20',
};

/**
 * Reduced-motion-safe skeleton placeholder block styled in the Cobalt/Cream palette.
 */
export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  className = '',
  width,
  height,
  rounded = 'lg',
  tone = 'cream',
}) => {
  const inlineStyle: React.CSSProperties = {};
  if (width !== undefined) inlineStyle.width = width;
  if (height !== undefined) inlineStyle.height = height;

  return (
    <div
      aria-hidden="true"
      style={inlineStyle}
      className={`motion-safe:animate-pulse ${ROUNDED_CLASSES[rounded]} ${TONE_CLASSES[tone]} ${className}`.trim()}
    />
  );
};

export interface TabSkeletonProps {
  label?: string;
  rows?: number;
  showHeader?: boolean;
  className?: string;
}

/**
 * Accessible tab-level loading placeholder with `aria-busy="true"` and Cobalt/Cream accents.
 */
export const TabSkeleton: React.FC<TabSkeletonProps> = ({
  label = 'Carregando conteúdo...',
  rows = 3,
  showHeader = true,
  className = '',
}) => {
  const safeRows = Math.max(1, Math.min(10, Math.floor(rows)));

  return (
    <section
      role="status"
      aria-busy="true"
      aria-label={label}
      className={`min-h-screen bg-[#FEF1CF]/35 px-4 pt-5 pb-28 sm:px-6 space-y-4 ${className}`.trim()}
    >
      <span className="sr-only">{label}</span>

      {showHeader && (
        <div className="space-y-2.5 pb-1">
          <SkeletonBlock tone="cobalt" rounded="full" className="h-5 w-28" />
          <SkeletonBlock tone="cream" rounded="xl" className="h-8 w-3/4 max-w-xs" />
          <SkeletonBlock tone="cream" rounded="lg" className="h-4 w-full max-w-md" />
        </div>
      )}

      <div className="space-y-3">
        {Array.from({ length: safeRows }, (_, index) => (
          <div
            key={index}
            className="rounded-2xl bg-[#FEF1CF]/60 border border-[#0131CD]/15 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <SkeletonBlock tone="cobalt" rounded="full" className="h-5 w-24" />
              <SkeletonBlock tone="cream" rounded="full" className="h-4 w-16" />
            </div>
            <SkeletonBlock tone="cream" rounded="lg" className="h-5 w-2/3" />
            <SkeletonBlock tone="cream" rounded="lg" className="h-4 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
};
