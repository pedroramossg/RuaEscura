import React from 'react';
import { ArrowLeftRight, Users, Lightbulb, AlertTriangle, ShieldAlert, Satellite, Map as MapIcon } from 'lucide-react';
import { LiquidGlassSurface } from '../ui/LiquidGlassSurface';
import { UFSC_LANDMARKS } from '../../data/ufscTrindade';
import type { MapLayerFilters, MapStyle } from './CampusMap';

export interface RouteControlsOverlayProps {
  activeOriginId: string;
  activeDestinationId: string;
  isNightMap: boolean;
  mapStyle?: MapStyle;
  filters: MapLayerFilters;
  onChangeEndpoints: (originId: string, destinationId: string) => void;
  onSwapEndpoints: () => void;
  onToggleFilter: (key: keyof MapLayerFilters) => void;
  onToggleNightMap: () => void;
  onToggleMapStyle?: () => void;
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
  mapStyle = 'osm',
  filters,
  onChangeEndpoints,
  onSwapEndpoints,
  onToggleFilter,
  onToggleNightMap,
  onToggleMapStyle,
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
    ? 'bg-[#0F172A]/90 text-[#F8FAFC] border-white/15 focus:border-[#5EC2F3]'
    : 'bg-white/95 text-[#0F172A] border-[#D5E0EE] focus:border-[#2563EB]';

  return (
    <div className="absolute top-3 inset-x-3 z-30 pointer-events-none flex flex-col gap-2 max-w-2xl mx-auto">
      {/* Liquid Glass Top Dock: Origin/Swap/Destination + Wrapped Filter & Map Mode Pills */}
      <LiquidGlassSurface
        variant="control"
        dark={isNightMap}
        className={`pointer-events-auto p-2.5 flex flex-col gap-2 backdrop-blur-xl ${
          isNightMap
            ? '!bg-[#0B1120]/90 !border-white/15 shadow-[0_12px_30px_rgba(0,0,0,0.45)]'
            : '!bg-white/92 !border-[#D5E0EE] shadow-[0_10px_28px_rgba(15,23,42,0.10)]'
        }`}
      >
        {/* Row 1: Origin -> Swap -> Destination + Emergency Shortcut */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex-1 min-w-0">
            <label htmlFor="map-origin-select" className="sr-only">
              Origem
            </label>
            <select
              id="map-origin-select"
              aria-label="Origem"
              value={activeOriginId}
              onChange={handleOriginChange}
              className={`w-full min-h-[44px] h-11 px-2.5 sm:px-3 rounded-xl border text-[13px] sm:text-sm font-medium truncate outline-none transition-colors cursor-pointer ${selectThemeClass}`}
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
            className={`min-h-[44px] min-w-[44px] w-11 h-11 rounded-full shrink-0 inline-flex items-center justify-center border transition-all duration-150 active:scale-[0.95] cursor-pointer ${
              isNightMap
                ? 'bg-[#132033] text-[#5EC2F3] border-white/15 hover:bg-[#1E293B]'
                : 'bg-[#F8FAFC] text-[#2563EB] border-[#D5E0EE] hover:bg-[#EFF6FF]'
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
              className={`w-full min-h-[44px] h-11 px-2.5 sm:px-3 rounded-xl border text-[13px] sm:text-sm font-medium truncate outline-none transition-colors cursor-pointer ${selectThemeClass}`}
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
              className={`min-h-[44px] min-w-[44px] w-11 h-11 rounded-full shrink-0 inline-flex items-center justify-center border transition-all duration-150 active:scale-[0.95] cursor-pointer ${
                isNightMap
                  ? 'bg-[#EF4444]/20 text-[#FCA5A5] border-[#EF4444]/40 hover:bg-[#EF4444]/30'
                  : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] hover:bg-[#FEE2E2]'
              }`}
            >
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Row 2: Wrapped Apple-style Pill Controls (Zero Right-Edge Clipping on 360px-402px) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleNightMap}
            aria-pressed={isNightMap}
            className={`min-h-[38px] px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 border transition-all duration-150 active:scale-[0.97] cursor-pointer whitespace-nowrap ${
              isNightMap
                ? 'bg-[#5EC2F3] text-[#0F172A] border-[#5EC2F3] shadow-[0_2px_10px_rgba(94,194,243,0.3)]'
                : 'bg-[#0F172A] text-white border-[#0F172A] shadow-[0_2px_8px_rgba(15,23,42,0.18)]'
            }`}
          >
            <span>{isNightMap ? '☀ Mapa Claro' : '☾ Luz Noturna'}</span>
          </button>

          {onToggleMapStyle && (
            <button
              type="button"
              onClick={onToggleMapStyle}
              aria-pressed={mapStyle === 'satellite'}
              className={`min-h-[38px] px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 border transition-all duration-150 active:scale-[0.97] cursor-pointer whitespace-nowrap ${
                mapStyle === 'satellite'
                  ? isNightMap
                    ? 'bg-[#5EC2F3] text-[#0F172A] border-[#5EC2F3]'
                    : 'bg-[#2563EB] text-white border-[#2563EB]'
                  : isNightMap
                    ? 'bg-[#132033]/90 text-[#F8FAFC] border-white/15 hover:border-[#5EC2F3]/60'
                    : 'bg-[#F8FAFC] text-[#0F172A] border-[#D5E0EE] hover:border-[#2563EB]/60'
              }`}
            >
              {mapStyle === 'satellite' ? (
                <>
                  <MapIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Ruas</span>
                </>
              ) : (
                <>
                  <Satellite className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Satélite</span>
                </>
              )}
            </button>
          )}

          {FILTER_CHIPS.map(({ key, label, Icon }) => {
            const active = filters[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggleFilter(key)}
                aria-pressed={active}
                className={`min-h-[38px] px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 border transition-all duration-150 active:scale-[0.97] cursor-pointer whitespace-nowrap ${
                  active
                    ? isNightMap
                      ? 'bg-[#5EC2F3] text-[#0F172A] border-[#5EC2F3] font-semibold shadow-[0_2px_10px_rgba(94,194,243,0.28)]'
                      : 'bg-[#2563EB] text-white border-[#2563EB] font-semibold shadow-[0_2px_8px_rgba(37,99,235,0.25)]'
                    : isNightMap
                      ? 'bg-[#132033]/85 text-[#94A3B8] border-white/15 hover:text-[#F8FAFC] hover:border-white/30'
                      : 'bg-[#F8FAFC] text-[#475569] border-[#D5E0EE] hover:text-[#0F172A] hover:border-[#94A3B8]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </LiquidGlassSurface>
    </div>
  );
};
