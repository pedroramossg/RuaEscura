import React, { useEffect, useState } from 'react';

export interface IosNavHeaderProps {
  /** Primary Large Title (rendered as the sole <h1> in normal document flow). */
  title: string;
  /** Optional shorter label shown in the sticky collapsed inline bar. Defaults to `title`. */
  compactTitle?: string;
  /** Optional uppercase eyebrow / context kicker above the Large Title. */
  kicker?: React.ReactNode;
  /** Optional subtitle below the Large Title. */
  subtitle?: React.ReactNode;
  /** Optional inline accessory rendered alongside the Large Title (e.g., TrioMascotStack). */
  titleAccessory?: React.ReactNode;
  /** Optional trailing slot rendered on the right side of the Large Title row. */
  trailing?: React.ReactNode;
  /** Optional compact trailing slot shown in the collapsed sticky bar when scrolled. */
  compactTrailing?: React.ReactNode;
  /** Optional footer row below the Large Title (e.g., status pills or safety tip strip). */
  footer?: React.ReactNode;
  /** Scroll threshold in pixels before the sticky inline bar morphs into Liquid Glass. */
  collapseThreshold?: number;
  className?: string;
}

/**
 * Apple iOS 26 HIG Large Title Navigation Header.
 *
 * - Sticky top translucent Liquid Glass inline bar (`sticky top-0 z-30`) with safe-area top inset.
 * - Fixed bar height prevents scroll-threshold layout jitter; compact title is only rendered when
 *   collapsed and marked `aria-hidden="true"` so `<h1>` remains unique in the DOM.
 * - Directly underneath in normal document flow (borderless, no card wrapper) sits the native
 *   Large Title `<header>` block.
 */
export const IosNavHeader: React.FC<IosNavHeaderProps> = ({
  title,
  compactTitle,
  kicker,
  subtitle,
  titleAccessory,
  trailing,
  compactTrailing,
  footer,
  collapseThreshold = 44,
  className = '',
}) => {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.scrollY > collapseThreshold
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      const next = window.scrollY > collapseThreshold;
      setCollapsed((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [collapseThreshold]);

  return (
    <>
      <div
        className={`sticky top-0 z-30 w-full transition-[background-color,border-color] duration-200 ${
          collapsed ? 'border-b border-[var(--separator)]' : 'border-b border-transparent'
        }`}
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          backgroundColor: collapsed ? 'var(--glass-surface)' : 'transparent',
          backdropFilter: collapsed ? 'blur(24px) saturate(180%)' : 'none',
          WebkitBackdropFilter: collapsed ? 'blur(24px) saturate(180%)' : 'none',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-11 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0" />
          <div className="min-w-0 text-center">
            {collapsed && (
              <span
                aria-hidden="true"
                className="block text-[17px] font-semibold tracking-tight text-[var(--label-primary)] truncate"
              >
                {compactTitle ?? title}
              </span>
            )}
          </div>
          <div className="flex items-center justify-end min-w-0">
            {collapsed && compactTrailing}
          </div>
        </div>
      </div>

      <header
        className={`relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-1 pb-5 space-y-3 ${className}`.trim()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0 flex-1">
            {kicker && (
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-primary)]">
                {kicker}
              </div>
            )}
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight text-[var(--label-primary)] leading-[1.1]">
                {title}
              </h1>
              {titleAccessory}
            </div>
            {subtitle && (
              <p className="text-sm text-[var(--label-secondary)] leading-snug">
                {subtitle}
              </p>
            )}
          </div>
          {trailing && <div className="shrink-0">{trailing}</div>}
        </div>

        {footer && <div className="pt-0.5">{footer}</div>}
      </header>
    </>
  );
};
