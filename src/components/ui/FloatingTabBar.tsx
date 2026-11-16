import React from 'react';
import { Compass, Map, Lightbulb, ShieldAlert } from 'lucide-react';
import { LiquidGlassSurface } from './LiquidGlassSurface';

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
  return (
    <nav
      aria-label="Navegação principal"
      className={`fixed bottom-4 inset-x-0 mx-auto w-fit max-w-[94vw] z-50 pointer-events-auto ${className}`}
    >
      <LiquidGlassSurface
        variant="nav"
        dark={dark}
        className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 rounded-full shadow-xl"
        role="tablist"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex items-center gap-1.5 min-h-[44px] min-w-[44px] h-11 px-3.5 sm:px-4 rounded-full text-sm font-medium transition-all duration-150 ease-out active:scale-[0.97] select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ${
                isActive
                  ? dark
                    ? 'bg-[#befc65] text-[#131314] shadow-sm'
                    : 'bg-[#131314] text-[#befc65] shadow-sm'
                  : dark
                    ? 'text-[#a1a1aa] hover:text-white hover:bg-white/10'
                    : 'text-[#46444a] hover:text-[#131314] hover:bg-black/5'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="leading-none">{tab.label}</span>

              {tab.id === 'denuncias' && alertCount > 0 && (
                <span
                  aria-label={`${alertCount} denúncias pendentes`}
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-semibold rounded-full bg-[#D70015] text-white leading-none -ml-0.5"
                >
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </LiquidGlassSurface>
    </nav>
  );
};
