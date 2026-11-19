import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { SfIcon, type SfIconName } from './SfIcon';
import { LiquidGlassSurface } from './LiquidGlassSurface';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

export type TabId = 'explorar' | 'mapa' | 'postes' | 'denuncias';

export interface TabItem {
  id: TabId;
  label: string;
  icon: SfIconName;
}

export const TABS: TabItem[] = [
  { id: 'explorar', label: 'Explorar', icon: 'compass' },
  { id: 'mapa', label: 'Mapa', icon: 'map' },
  { id: 'postes', label: 'Postes', icon: 'lightbulb' },
  { id: 'denuncias', label: 'Denúncias', icon: 'shield' },
];

export interface FloatingTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  alertCount?: number;
  dark?: boolean;
  className?: string;
}

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  onTabChange,
  alertCount = 0,
  dark = false,
  className = '',
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [minimized, setMinimized] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;

      if (currentY < 40) {
        setMinimized(false);
        lastScrollYRef.current = currentY;
        return;
      }

      const delta = currentY - lastScrollYRef.current;
      if (Math.abs(delta) < 12) return;

      if (delta > 0 && currentY > 80) {
        setMinimized(true);
      } else if (delta < 0) {
        setMinimized(false);
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMinimized(false);
    if (typeof window !== 'undefined') {
      lastScrollYRef.current = window.scrollY;
    }
  }, [activeTab]);

  return (
    <nav
      aria-label="Navegação principal"
      data-minimized={minimized ? 'true' : 'false'}
      style={{ bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))' }}
      className={`fixed inset-x-0 mx-auto w-fit max-w-[calc(100vw-16px)] z-50 pointer-events-auto ${className}`.trim()}
    >
      <LiquidGlassSurface
        variant="nav"
        dark={dark}
        className={`flex items-center transition-[padding,gap] ${
          prefersReducedMotion ? 'duration-0' : 'duration-200'
        } [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] ${
          minimized ? 'gap-1 px-1.5 py-1' : 'gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1.5'
        }`}
        role="tablist"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;

          const activePillClass = dark
            ? 'bg-[#60A5FA]/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
            : 'liquid-glass-tab-active bg-[#2563EB]/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_1px_3px_rgba(37,99,235,0.12)]';

          const textStateClass = isActive
            ? dark
              ? 'text-[#60A5FA]'
              : 'liquid-glass-tab-active-label text-[#2563EB]'
            : dark
              ? 'text-[#CBD5E1] hover:text-white hover:bg-white/10'
              : 'text-[var(--label-secondary)] hover:text-[var(--label-primary)] hover:bg-black/[0.04]';

          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(tab.id)}
              style={minimized ? undefined : { minWidth: '60px' }}
              className={`relative flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full whitespace-nowrap transition-[transform,color,background-color,padding,height,width] ${
                prefersReducedMotion ? 'duration-0' : 'duration-200'
              } [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] enabled:active:scale-[0.96] select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ${
                minimized ? 'h-11 w-11 px-0' : 'h-12 px-3.5 sm:px-4'
              } ${
                dark ? 'focus-visible:outline-[#60A5FA]' : 'focus-visible:outline-[#2563EB]'
              } ${textStateClass}`}
            >
              {isActive && (
                <motion.span
                  layoutId={prefersReducedMotion ? undefined : 'rua-active-tab'}
                  aria-hidden="true"
                  data-testid="active-tab-indicator"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0.01 }
                      : { type: 'spring', duration: 0.3, bounce: 0 }
                  }
                  className={`absolute inset-0 rounded-full ${activePillClass}`}
                />
              )}

              <span className="relative z-10 inline-flex flex-col items-center justify-center gap-0.5">
                <span className="relative inline-flex items-center justify-center">
                  <SfIcon
                    name={tab.icon}
                    filled={isActive}
                    size={minimized ? 20 : 18}
                  />

                  {tab.id === 'denuncias' && alertCount > 0 && (
                    <span
                      aria-label={`${alertCount} denúncias pendentes`}
                      className="absolute -top-1.5 -right-2.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-semibold rounded-full bg-[#D70015] text-white leading-none shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
                    >
                      {alertCount}
                    </span>
                  )}
                </span>

                <span
                  className={
                    minimized
                      ? 'sr-only'
                      : 'text-[10.5px] font-medium leading-none tracking-[-0.01em]'
                  }
                >
                  {tab.label}
                </span>
              </span>
            </button>
          );
        })}
      </LiquidGlassSurface>
    </nav>
  );
};
