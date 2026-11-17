import React from 'react';
import { motion } from 'motion/react';
import { Compass, Map, Lightbulb, ShieldAlert } from 'lucide-react';
import { LiquidGlassSurface } from './LiquidGlassSurface';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

export type TabId = 'explorar' | 'mapa' | 'postes' | 'denuncias';

export interface TabItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

export const TABS: TabItem[] = [
  { id: 'explorar', label: 'Explorar', icon: Compass },
  { id: 'mapa', label: 'Mapa', icon: Map },
  { id: 'postes', label: 'Postes', icon: Lightbulb },
  { id: 'denuncias', label: 'Denúncias', icon: ShieldAlert },
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

  return (
    <nav
      aria-label="Navegação principal"
      className={`fixed bottom-4 inset-x-0 mx-auto w-fit max-w-[calc(100vw-16px)] z-50 pointer-events-auto ${className}`.trim()}
    >
      <LiquidGlassSurface
        variant="nav"
        dark={dark}
        className="flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2 py-1.5 rounded-full shadow-xl"
        role="tablist"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          const activePillClass = dark ? 'bg-[#B9FC01]' : 'bg-[#0131CD]';
          const textStateClass = isActive
            ? dark
              ? 'text-[#0B1226]'
              : 'text-[#B9FC01]'
            : dark
              ? 'text-[#FEF1CF]/80 hover:text-[#FEF1CF] hover:bg-white/10'
              : 'text-[#0B1226]/80 hover:text-[#0131CD] hover:bg-[#0131CD]/8';

          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] min-w-[44px] h-11 px-2.5 sm:px-4 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-out active:scale-[0.97] select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ${
                dark ? 'focus-visible:outline-[#B9FC01]' : 'focus-visible:outline-[#0131CD]'
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
                      : { type: 'spring', stiffness: 420, damping: 32 }
                  }
                  className={`absolute inset-0 rounded-full shadow-sm ${activePillClass}`}
                />
              )}

              <span className="relative z-10 inline-flex items-center gap-1 sm:gap-1.5">
                <Icon size={16} className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                <span className="leading-none">{tab.label}</span>

                {tab.id === 'denuncias' && alertCount > 0 && (
                  <span
                    aria-label={`${alertCount} denúncias pendentes`}
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-semibold rounded-full bg-[#D70015] text-white leading-none -ml-0.5"
                  >
                    {alertCount}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </LiquidGlassSurface>
    </nav>
  );
};
