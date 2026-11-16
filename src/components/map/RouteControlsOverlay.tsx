import React from 'react';
import { ArrowLeftRight, Users, Lightbulb, AlertTriangle, ShieldAlert } from 'lucide-react';
import { LiquidGlassSurface } from '../ui/LiquidGlassSurface';
import { UFSC_LANDMARKS } from '../../data/ufscTrindade';
import type { MapLayerFilters } from './CampusMap';

export interface RouteControlsOverlayProps {
  activeOriginId: string;
  activeDestinationId: string;
  isNightMap: boolean;
  filters: MapLayerFilters;
  onChangeEndpoints: (originId: string, destinationId: string) => void;
  onSwapEndpoints: () => void;
  onToggleFilter: (key: keyof MapLayerFilters) => void;
  onToggleNightMap: () => void;
  onOpenReportsShortcut?: () => void;
}

const FILTER_CHIPS: Array<{
  key: keyof MapLayerFilters;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'companions', label: 'Colegas', Icon: Users },
  { key: 'posts', label: 'Postes', Icon: Lightbulb },
  { key: 'darkZones', label: 'Zonas Escuras', Icon: AlertTriangle },
];

/**
 * Floating Liquid Glass top controls over the UFSC map:
 * Origin/Destination pickers with instant swap, layer filter chips,
 * instant Night Map toggle, and discreet emergency reports shortcut.
 */
export const RouteControlsOverlay: React.FC<RouteControlsOverlayProps> = ({
  activeOriginId,
  activeDestinationId,
  isNightMap,
  filters,
  onChangeEndpoints,
  onSwapEndpoints,
  onToggleFilter,
  onToggleNightMap,
  onOpenReportsShortcut,
}) => {
  const handleOriginChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextOrigin = e.target.value;
    if (nextOrigin === activeDestinationId) {
      onChangeEndpoints(nextOrigin, activeOriginId);
    } else {
      onChangeEndpoints(nextOrigin, activeDestinationId);
    }
  };

  const handleDestinationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextDest = e.target.value;
    if (nextDest === activeOriginId) {
      onChangeEndpoints(activeDestinationId, nextDest);
    } else {
      onChangeEndpoints(activeOriginId, nextDest);
    }
  };

  const selectThemeClass = isNightMap
    ? 'bg-[#131314]/85 text-[#f3f3f4] border-[#2e2e32] focus:border-[#befc65]'
    : 'bg-white/90 text-[#131314] border-[#dfe3e6] focus:border-[#131314]';

  return (
    <div className="absolute top-3 inset-x-3 z-30 pointer-events-none flex flex-col gap-2 max-w-2xl mx-auto">
      {/* Row 1: Origin -> Swap -> Destination + Emergency Shortcut */}
      <LiquidGlassSurface
        variant="control"
        dark={isNightMap}
        className="pointer-events-auto p-2 flex flex-col gap-2"
      >
        <div className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <label htmlFor="map-origin-select" className="sr-only">
              Origem
            </label>
            <select
              id="map-origin-select"
              aria-label="Origem"
              value={activeOriginId}
              onChange={handleOriginChange}
              className={`w-full min-h-[44px] h-11 px-3 rounded-xl border text-sm font-medium truncate outline-none transition-colors cursor-pointer ${selectThemeClass}`}
            >
              {UFSC_LANDMARKS.map((node) => (
                <option key={node.id} value={node.id}>
                  De: {node.shortName}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onSwapEndpoints}
            aria-label="Trocar origem e destino"
            className={`min-h-[44px] min-w-[44px] w-11 h-11 rounded-full shrink-0 inline-flex items-center justify-center border transition-all duration-120 active:scale-[0.95] cursor-pointer ${
              isNightMap
                ? 'bg-[#2c2c2e] text-[#befc65] border-[#3a3a3e] hover:bg-[#3a3a3e]'
                : 'bg-[#f3f3f4] text-[#131314] border-[#dfe3e6] hover:bg-[#e5e5e7]'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
          </button>

          <div className="flex-1 min-w-0">
            <label htmlFor="map-destination-select" className="sr-only">
              Destino
            </label>
            <select
              id="map-destination-select"
              aria-label="Destino"
              value={activeDestinationId}
              onChange={handleDestinationChange}
              className={`w-full min-h-[44px] h-11 px-3 rounded-xl border text-sm font-medium truncate outline-none transition-colors cursor-pointer ${selectThemeClass}`}
            >
              {UFSC_LANDMARKS.map((node) => (
                <option key={node.id} value={node.id}>
                  Para: {node.shortName}
                </option>
              ))}
            </select>
          </div>

          {onOpenReportsShortcut && (
            <button
              type="button"
              onClick={onOpenReportsShortcut}
              aria-label="Abrir canal de emergência e denúncias"
              title="Emergência e Denúncias"
              className={`min-h-[44px] min-w-[44px] w-11 h-11 rounded-full shrink-0 inline-flex items-center justify-center border transition-all duration-120 active:scale-[0.95] cursor-pointer ${
                isNightMap
                  ? 'bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/40 hover:bg-[#FF3B30]/30'
                  : 'bg-[#D70015]/10 text-[#D70015] border-[#D70015]/25 hover:bg-[#D70015]/15'
              }`}
            >
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Row 2: Night Toggle & Horizontal Layer Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={onToggleNightMap}
            aria-pressed={isNightMap}
            className={`min-h-[44px] px-3.5 rounded-full text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 border transition-all duration-120 active:scale-[0.97] cursor-pointer ${
              isNightMap
                ? 'bg-[#befc65] text-[#131314] border-[#befc65]'
                : 'bg-[#131314] text-[#befc65] border-[#131314]'
            }`}
          >
            <span>{isNightMap ? '☀ Mapa Claro' : '☾ Luz Noturna'}</span>
          </button>

          {FILTER_CHIPS.map(({ key, label, Icon }) => {
            const active = filters[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggleFilter(key)}
                aria-pressed={active}
                className={`min-h-[44px] px-3 rounded-full text-xs font-medium shrink-0 inline-flex items-center gap-1.5 border transition-all duration-120 active:scale-[0.97] cursor-pointer ${
                  active
                    ? isNightMap
                      ? 'bg-[#f3f3f4] text-[#131314] border-[#f3f3f4]'
                      : 'bg-[#131314] text-white border-[#131314]'
                    : isNightMap
                      ? 'bg-[#2c2c2e]/80 text-[#a1a1aa] border-[#3a3a3e] hover:text-white'
                      : 'bg-white/80 text-[#46444a] border-[#dfe3e6] hover:text-[#131314]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </LiquidGlassSurface>
    </div>
  );
};
