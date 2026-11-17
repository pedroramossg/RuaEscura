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
    ? 'bg-[#0B132B]/90 text-[#FEF1CF] border-[#1F2E5C] focus:border-[#B9FC01]'
    : 'bg-[#FFF9EA]/95 text-[#0B1226] border-[#D8C89E] focus:border-[#0131CD]';

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
                ? 'bg-[#121D3D] text-[#B9FC01] border-[#1F2E5C] hover:bg-[#192852]'
                : 'bg-[#FEF1CF] text-[#0131CD] border-[#D8C89E] hover:bg-[#E7D8B0]'
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

        {/* Row 2: Night Toggle, Map Style Toggle & Horizontal Layer Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={onToggleNightMap}
            aria-pressed={isNightMap}
            className={`min-h-[44px] px-3.5 rounded-full text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 border transition-all duration-120 active:scale-[0.97] cursor-pointer ${
              isNightMap
                ? 'bg-[#B9FC01] text-[#0B1226] border-[#B9FC01]'
                : 'bg-[#0131CD] text-[#FEF1CF] border-[#0131CD]'
            }`}
          >
            <span>{isNightMap ? '☀ Mapa Claro' : '☾ Luz Noturna'}</span>
          </button>

          {onToggleMapStyle && (
            <button
              type="button"
              onClick={onToggleMapStyle}
              aria-pressed={mapStyle === 'satellite'}
              className={`min-h-[44px] px-3 rounded-full text-xs font-medium shrink-0 inline-flex items-center gap-1.5 border transition-all duration-120 active:scale-[0.97] cursor-pointer ${
                mapStyle === 'satellite'
                  ? 'bg-[#B9FC01] text-[#0B1226] border-[#B9FC01]'
                  : isNightMap
                    ? 'bg-[#121D3D]/85 text-[#FEF1CF] border-[#1F2E5C] hover:border-[#B9FC01]'
                    : 'bg-[#FFF9EA]/90 text-[#0B1226] border-[#D8C89E] hover:border-[#0131CD]'
              }`}
            >
              {mapStyle === 'satellite' ? (
                <>
                  <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Ruas</span>
                </>
              ) : (
                <>
                  <Satellite className="w-3.5 h-3.5" aria-hidden="true" />
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
                className={`min-h-[44px] px-3 rounded-full text-xs font-medium shrink-0 inline-flex items-center gap-1.5 border transition-all duration-120 active:scale-[0.97] cursor-pointer ${
                  active
                    ? isNightMap
                      ? 'bg-[#FEF1CF] text-[#0B1226] border-[#FEF1CF]'
                      : 'bg-[#0131CD] text-[#FEF1CF] border-[#0131CD]'
                    : isNightMap
                      ? 'bg-[#121D3D]/80 text-[#9FB0D8] border-[#1F2E5C] hover:text-[#FEF1CF]'
                      : 'bg-[#FFF9EA]/85 text-[#4D5775] border-[#D8C89E] hover:text-[#0B1226]'
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
