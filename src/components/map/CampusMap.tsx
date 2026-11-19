import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { Zap, AlertTriangle, Flame, X } from 'lucide-react';
import { pickTrioVariant, type TrioVariant } from '../mascot/TrioMascotBadge';
import type {
  CampusNode,
  CampusNodeCategory,
  CompanionMatch,
  Coordinates,
  IncidentReport,
  LampPost,
  LampPostStatus,
  RouteMode,
  RouteResult,
} from '../../types/campus';
import {
  BOSQUE_RING,
  CAMPUS_BOUNDS,
  CAMPUS_CENTER,
  UFSC_EDGES,
  UFSC_LANDMARKS,
  UFSC_PERIMETER_RING,
  UFSC_WALKWAYS,
} from '../../data/ufscTrindade';

export interface MapLayerFilters {
  companions: boolean;
  posts: boolean;
  darkZones: boolean;
}

export type MapStyle = 'osm' | 'satellite';

export interface CampusMapProps {
  isNightMap: boolean;
  mapStyle?: MapStyle;
  activeOriginId: string;
  activeDestinationId: string;
  routeMode: RouteMode;
  activeRoute: RouteResult;
  comparisonRoute: RouteResult;
  posts: LampPost[];
  reports: IncidentReport[];
  companionMatches: CompanionMatch[];
  filters: MapLayerFilters;
  selectedPostId: string | null;
  onSelectLandmark: (nodeId: string) => void;
  onSelectPost: (post: LampPost | null) => void;
  onSelectCompanion?: (companionId: string) => void;
}

const TILE_URLS = {
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  osmNight: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
} as const;

const LANDMARK_CATEGORY_DOT: Record<CampusNodeCategory, string> = {
  centro: 'bg-[#2563EB]',
  servico: 'bg-[#10B981]',
  lazer: 'bg-[#059669]',
  entorno: 'bg-[#536878]',
};

const LAMP_STATUS_META: Record<
  LampPostStatus,
  {
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    dayBadgeClass: string;
    nightBadgeClass: string;
  }
> = {
  aceso: {
    label: 'Aceso',
    Icon: Zap,
    dayBadgeClass: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
    nightBadgeClass: 'bg-[#10B981]/20 text-[#34D399] border-[#10B981]/45',
  },
  oscilando: {
    label: 'Oscilando',
    Icon: AlertTriangle,
    dayBadgeClass: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
    nightBadgeClass: 'bg-[#F7C648]/20 text-[#FFE270] border-[#F7C648]/45',
  },
  queimado: {
    label: 'Queimado',
    Icon: Flame,
    dayBadgeClass: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
    nightBadgeClass: 'bg-[#EF4444]/20 text-[#FCA5A5] border-[#EF4444]/45',
  },
};

const TRIO_COMPANION_STYLES: Record<
  TrioVariant,
  { pillClass: string; dotClass: string }
> = {
  blue: {
    pillClass: 'bg-gradient-to-br from-[#87D7FA] to-[#5EC2F3] text-[#0F172A]',
    dotClass: 'bg-[#0369A1]',
  },
  gold: {
    pillClass: 'bg-gradient-to-br from-[#FFE270] to-[#F7C648] text-[#0F172A]',
    dotClass: 'bg-[#92400E]',
  },
  pink: {
    pillClass: 'bg-gradient-to-br from-[#F5A4CE] to-[#EE86BF] text-[#0F172A]',
    dotClass: 'bg-[#9D174D]',
  },
};

const NODE_MAP: Map<string, CampusNode> = new Map(UFSC_LANDMARKS.map((n) => [n.id, n]));

function toGeoJsonPolygon(ring: Coordinates[]): GeoJSON.Feature<GeoJSON.Polygon> {
  const closed = [...ring, ring[0]].map(([lat, lng]) => [lng, lat]);
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [closed],
    },
  };
}

const UFSC_WALKWAYS_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
  type: 'FeatureCollection',
  features: UFSC_WALKWAYS.map((line) => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: line.map(([lat, lng]) => [lng, lat]),
    },
  })),
};

/**
 * Projects lat/lng coordinates to normalized percentages inside CAMPUS_BOUNDS.
 */
function projectToPercent(
  coords: Coordinates,
  clamp = true
): { xPct: number; yPct: number } {
  const [[minLat, minLng], [maxLat, maxLng]] = CAMPUS_BOUNDS;
  const xPct = ((coords[1] - minLng) / (maxLng - minLng)) * 100;
  const yPct = ((maxLat - coords[0]) / (maxLat - minLat)) * 100;
  if (!clamp) {
    return { xPct, yPct };
  }
  return {
    xPct: Math.max(4, Math.min(96, xPct)),
    yPct: Math.max(8, Math.min(92, yPct)),
  };
}

function projectSvgPoint(coords: Coordinates, clamp = false): string {
  const { xPct, yPct } = projectToPercent(coords, clamp);
  return `${(xPct * 8).toFixed(1)},${(yPct * 6).toFixed(1)}`;
}

function toSvgPolylinePoints(coords: Coordinates[], clamp = false): string {
  return coords.map((c) => projectSvgPoint(c, clamp)).join(' ');
}

const PERIMETER_SVG_POINTS = toSvgPolylinePoints(UFSC_PERIMETER_RING);
const BOSQUE_SVG_POINTS = toSvgPolylinePoints(BOSQUE_RING);
const WALKWAY_SVG_POLYLINES = UFSC_WALKWAYS.map((w) => toSvgPolylinePoints(w));
const EDGE_SVG_POLYLINES = UFSC_EDGES.map((edge) => {
  const pts =
    edge.waypoints && edge.waypoints.length > 1
      ? edge.waypoints
      : [NODE_MAP.get(edge.from)?.coordinates, NODE_MAP.get(edge.to)?.coordinates].filter(
          (c): c is Coordinates => Boolean(c)
        );
  return {
    id: edge.id,
    points: toSvgPolylinePoints(pts),
  };
});

interface VectorFallbackSvgProps {
  visible: boolean;
  isNightMap: boolean;
  routeMode: RouteMode;
  activeRoute: RouteResult;
  comparisonRoute: RouteResult;
  posts: LampPost[];
  filters: MapLayerFilters;
  darkEdgeIds: Set<string>;
  activeReportNodes: Set<string>;
}

const VectorFallbackSvg = React.memo<VectorFallbackSvgProps>(
  ({
    visible,
    isNightMap,
    routeMode,
    activeRoute,
    comparisonRoute,
    posts,
    filters,
    darkEdgeIds,
    activeReportNodes,
  }) => {
    const isWarnRoute = routeMode === 'fastest' && activeRoute.hasDarkWarning;

    return (
      <svg
        data-testid="campus-vector-fallback"
        viewBox="0 0 800 600"
        preserveAspectRatio="none"
        aria-hidden="true"
        className={`absolute inset-0 w-full h-full z-[1] pointer-events-none transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <defs>
          <radialGradient id="pole-halo-emerald" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#10B981" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Campus Perimeter Polygon */}
        <polygon
          points={PERIMETER_SVG_POINTS}
          fill={isNightMap ? '#0A0A0A' : '#FFFFFF'}
          fillOpacity={isNightMap ? 0.84 : 0.85}
          stroke={isNightMap ? '#536878' : '#CBD5E1'}
          strokeOpacity={isNightMap ? 0.55 : 1}
          strokeWidth="2"
          strokeDasharray="8 6"
        />

        {/* Bosque do CFH Green Polygon */}
        <polygon
          points={BOSQUE_SVG_POINTS}
          fill={isNightMap ? '#065F46' : '#10B981'}
          fillOpacity={isNightMap ? 0.34 : 0.16}
          stroke={isNightMap ? '#34D399' : '#10B981'}
          strokeOpacity={isNightMap ? 0.45 : 0.45}
          strokeWidth="1.5"
        />

        {/* OSM Campus Sidewalks & Pedestrian Walkways */}
        {WALKWAY_SVG_POLYLINES.map((points, idx) => (
          <polyline
            key={`walkway-${idx}`}
            points={points}
            fill="none"
            stroke={isNightMap ? '#24303D' : '#E2E8F0'}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Routable Campus Walkway Edges */}
        {EDGE_SVG_POLYLINES.map(({ id, points }) => {
          if (!points) return null;
          const isDark = darkEdgeIds.has(id);
          const showAsDark = filters.darkZones && isDark;

          return (
            <polyline
              key={id}
              points={points}
              fill="none"
              stroke={
                showAsDark
                  ? isNightMap
                    ? '#EF4444'
                    : '#DC2626'
                  : isNightMap
                    ? '#536878'
                    : '#CBD5E1'
              }
              strokeOpacity={showAsDark ? 0.9 : isNightMap ? 0.52 : 1}
              strokeWidth={showAsDark ? 3.5 : 2}
              strokeDasharray={showAsDark ? '5 5' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* Comparison Route (Subtle Dashed) */}
        {comparisonRoute.coordinates.length > 1 && (
          <polyline
            points={toSvgPolylinePoints(comparisonRoute.coordinates, true)}
            fill="none"
            stroke={isNightMap ? '#94A3B8' : '#64748B'}
            strokeWidth="2.5"
            strokeDasharray="6 7"
            strokeOpacity="0.6"
          />
        )}

        {/* Active Route Luminous Line */}
        {activeRoute.coordinates.length > 1 && (
          <>
            <polyline
              points={toSvgPolylinePoints(activeRoute.coordinates, true)}
              fill="none"
              stroke={isWarnRoute ? '#F7C648' : isNightMap ? '#2563EB' : '#5EC2F3'}
              strokeWidth="12"
              strokeOpacity={isNightMap ? 0.45 : 0.55}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={toSvgPolylinePoints(activeRoute.coordinates, true)}
              fill="none"
              stroke={
                isWarnRoute
                  ? isNightMap
                    ? '#FBBF24'
                    : '#D97706'
                  : isNightMap
                    ? '#5EC2F3'
                    : '#2563EB'
              }
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* Night-mode luminous halos around active poles */}
        {filters.posts &&
          isNightMap &&
          posts
            .filter((p) => p.status === 'aceso')
            .map((p) => {
              const { xPct, yPct } = projectToPercent(p.coordinates);
              return (
                <circle
                  key={`halo-${p.id}`}
                  cx={xPct * 8}
                  cy={yPct * 6}
                  r="26"
                  fill="url(#pole-halo-emerald)"
                />
              );
            })}

        {/* Dark zone hazard rings around burned poles & active report nodes */}
        {filters.darkZones &&
          posts
            .filter((p) => p.status === 'queimado')
            .map((p) => {
              const { xPct, yPct } = projectToPercent(p.coordinates);
              return (
                <circle
                  key={`dark-post-${p.id}`}
                  cx={xPct * 8}
                  cy={yPct * 6}
                  r="26"
                  fill={isNightMap ? '#FF3B30' : '#D70015'}
                  fillOpacity="0.14"
                  stroke={isNightMap ? '#FF3B30' : '#D70015'}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              );
            })}

        {filters.darkZones &&
          Array.from(activeReportNodes).map((nodeId) => {
            const node = NODE_MAP.get(nodeId);
            if (!node) return null;
            const { xPct, yPct } = projectToPercent(node.coordinates);
            return (
              <circle
                key={`dark-rep-${nodeId}`}
                cx={xPct * 8}
                cy={yPct * 6}
                r="28"
                fill={isNightMap ? '#FF9F0A' : '#D97706'}
                fillOpacity="0.12"
                stroke={isNightMap ? '#FF9F0A' : '#D97706'}
                strokeWidth="1.5"
                strokeDasharray="3 5"
              />
            );
          })}
      </svg>
    );
  }
);
VectorFallbackSvg.displayName = 'VectorFallbackSvg';

interface LandmarkMarkerProps {
  node: CampusNode;
  isOrigin: boolean;
  isDest: boolean;
  isNightMap: boolean;
  left: string;
  top: string;
  onSelect: (nodeId: string) => void;
}

const LandmarkMarker = React.memo<LandmarkMarkerProps>(
  ({ node, isOrigin, isDest, isNightMap, left, top, onSelect }) => {
    const roleSuffix = isOrigin ? ' (Origem)' : isDest ? ' (Destino)' : '';
    const style = useMemo<React.CSSProperties>(() => ({ left, top }), [left, top]);
    const categoryDotClass = LANDMARK_CATEGORY_DOT[node.category];

    return (
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        style={style}
        aria-label={`${node.shortName} — ${node.name}${roleSuffix}`}
        aria-pressed={isOrigin || isDest}
        className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-2 ${
          isOrigin || isDest ? 'z-20' : 'z-[15]'
        } ${
          isNightMap ? 'focus-visible:outline-[#5EC2F3]' : 'focus-visible:outline-[#2563EB]'
        } rounded-full group`}
      >
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold tracking-tight border backdrop-blur-md transition-transform duration-150 group-active:scale-95 whitespace-nowrap ${
            isOrigin
              ? 'bg-[#0F172A] text-white border-white shadow-[0_4px_12px_rgba(15,23,42,0.32)]'
              : isDest
                ? 'bg-[#2563EB] text-white border-white shadow-[0_4px_14px_rgba(37,99,235,0.40)]'
                : isNightMap
                  ? 'bg-[#0A0A0A]/85 text-[#F8FAFC] border-[#536878]/60 shadow-[0_2px_10px_rgba(0,0,0,0.55)] hover:border-[#5EC2F3]'
                  : 'bg-white/92 text-[#0F172A] border-[#CBD5E1]/90 shadow-[0_2px_6px_rgba(15,23,42,0.08)] hover:border-[#2563EB]'
          }`}
        >
          {isOrigin ? (
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/20 text-[9px] font-bold uppercase">
              O
            </span>
          ) : isDest ? (
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/25 text-[9px] font-bold uppercase">
              D
            </span>
          ) : (
            <span
              aria-hidden="true"
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${categoryDotClass}`}
            />
          )}
          <span>{node.shortName}</span>
        </span>
      </button>
    );
  }
);
LandmarkMarker.displayName = 'LandmarkMarker';

interface LampPostMarkerProps {
  post: LampPost;
  isSelected: boolean;
  isNightMap: boolean;
  left: string;
  top: string;
  onSelect: (post: LampPost | null) => void;
}

const LampPostMarker = React.memo<LampPostMarkerProps>(
  ({ post, isSelected, isNightMap, left, top, onSelect }) => {
    const meta = LAMP_STATUS_META[post.status];
    const style = useMemo<React.CSSProperties>(() => ({ left, top }), [left, top]);

    return (
      <button
        type="button"
        onClick={() => onSelect(isSelected ? null : post)}
        style={style}
        aria-label={`${post.id} — ${post.name} (${meta.label})`}
        aria-pressed={isSelected}
        className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] z-10 flex items-center justify-center cursor-pointer focus-visible:outline-2 ${
          isNightMap ? 'focus-visible:outline-[#5EC2F3]' : 'focus-visible:outline-[#2563EB]'
        } rounded-full group`}
      >
        {/* Sleek 12px optical LED beacon inside 44x44px transparent touch target */}
        <span className="relative inline-flex items-center justify-center w-3 h-3">
          {post.status === 'oscilando' && (
            <span
              aria-hidden="true"
              className="absolute -inset-1 rounded-full bg-[#F7C648]/60 motion-safe:animate-ping"
            />
          )}
          {post.status === 'aceso' && (
            <span
              aria-hidden="true"
              className={`absolute -inset-1.5 rounded-full blur-[2px] ${
                isNightMap ? 'bg-[#10B981]/45' : 'bg-[#10B981]/25'
              }`}
            />
          )}
          {post.status === 'queimado' && (
            <span
              aria-hidden="true"
              className="absolute -inset-1 rounded-full border border-[#EF4444]/85 bg-[#EF4444]/20"
            />
          )}

          {post.status === 'aceso' && (
            <span
              className={`relative w-3 h-3 rounded-full bg-[#10B981] ring-1 ring-white/85 transition-transform duration-150 group-hover:scale-110 group-active:scale-95 ${
                isNightMap
                  ? 'shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                  : 'shadow-[0_0_6px_rgba(16,185,129,0.5)]'
              } ${isSelected ? 'scale-125 ring-2 ring-[#34D399]' : ''}`}
            />
          )}

          {post.status === 'oscilando' && (
            <span
              className={`relative w-3 h-3 rounded-full bg-[#F7C648] ring-1 ring-white/85 shadow-[0_0_8px_rgba(247,198,72,0.75)] transition-transform duration-150 group-hover:scale-110 group-active:scale-95 ${
                isSelected ? 'scale-125 ring-2 ring-[#FDE68A]' : ''
              }`}
            />
          )}

          {post.status === 'queimado' && (
            <span
              className={`relative inline-flex items-center justify-center w-3 h-3 rounded-full ring-1 ring-[#EF4444] shadow-[0_0_8px_rgba(239,68,68,0.6)] transition-transform duration-150 group-hover:scale-110 group-active:scale-95 ${
                isNightMap ? 'bg-[#1F1218]' : 'bg-[#FEF2F2]'
              } ${isSelected ? 'scale-125 ring-2 ring-[#EF4444]' : ''}`}
            >
              {/* Subtle crossed-filament glyph inside 12px alert dot (never color-only) */}
              <svg
                viewBox="0 0 12 12"
                className="w-2 h-2 text-[#EF4444]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </span>
          )}
        </span>
      </button>
    );
  }
);
LampPostMarker.displayName = 'LampPostMarker';

interface CompanionMarkerProps {
  companion: CompanionMatch;
  variant: TrioVariant;
  isNightMap: boolean;
  left: string;
  top: string;
  onSelect?: (companionId: string) => void;
}

const CompanionMarker = React.memo<CompanionMarkerProps>(
  ({ companion, variant, isNightMap, left, top, onSelect }) => {
    const style = useMemo<React.CSSProperties>(() => ({ left, top }), [left, top]);
    const trioStyle = TRIO_COMPANION_STYLES[variant];

    return (
      <button
        type="button"
        onClick={() => onSelect?.(companion.id)}
        style={style}
        aria-label={`Colega de trajeto: ${companion.name} saindo às ${companion.departureTime}`}
        className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-2 ${
          isNightMap ? 'focus-visible:outline-[#5EC2F3]' : 'focus-visible:outline-[#2563EB]'
        } rounded-full group`}
      >
        <span
          className={`relative inline-flex items-center gap-1 px-2 h-6 rounded-full text-[10px] font-bold tracking-tight border-2 border-white shadow-[0_3px_10px_rgba(15,23,42,0.20)] transition-transform duration-150 group-hover:scale-105 group-active:scale-95 ${trioStyle.pillClass}`}
        >
          <span>{companion.initials}</span>
          {companion.isGroup && (
            <span
              aria-hidden="true"
              className={`w-1.5 h-1.5 rounded-full ${trioStyle.dotClass} ring-1 ring-white/80`}
            />
          )}
        </span>
      </button>
    );
  }
);
CompanionMarker.displayName = 'CompanionMarker';

/**
 * Interactive UFSC Trindade campus map powered by Leaflet (bounded to CAMPUS_BOUNDS)
 * with OSM / Esri Satellite tiles, RAF-throttled marker sync, and a GeoJSON/SVG vector fallback.
 */
const CampusMapComponent: React.FC<CampusMapProps> = ({
  isNightMap,
  mapStyle = 'osm',
  activeOriginId,
  activeDestinationId,
  routeMode,
  activeRoute,
  comparisonRoute,
  posts,
  reports,
  companionMatches,
  filters,
  selectedPostId,
  onSelectLandmark,
  onSelectPost,
  onSelectCompanion,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const vectorLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [hasMeasuredViewport, setHasMeasuredViewport] = useState(false);
  const [tilesOffline, setTilesOffline] = useState(false);
  const [, setProjectionVersion] = useState(0);

  const darkEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const edge of UFSC_EDGES) {
      if (edge.baseIllumination < 50) {
        ids.add(edge.id);
      }
    }
    for (const post of posts) {
      if (post.status === 'queimado') {
        for (const eid of post.connectedEdgeIds) {
          ids.add(eid);
        }
      }
    }
    return ids;
  }, [posts]);

  const activeReportNodes = useMemo(() => {
    const nodeIds = new Set<string>();
    for (const rep of reports) {
      if (rep.status !== 'resolvido' && rep.locationNodeId) {
        nodeIds.add(rep.locationNodeId);
      }
    }
    return nodeIds;
  }, [reports]);

  // Initialize Leaflet map once with RAF-throttled move/zoom viewport sync
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || leafletMapRef.current) return;

    let mapInstance: L.Map | null = null;
    let rafId: number | null = null;

    const applySync = () => {
      rafId = null;
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        setHasMeasuredViewport(true);
      }
      setProjectionVersion((v) => v + 1);
    };

    const scheduleSync = () => {
      if (rafId !== null) return;
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        rafId = window.requestAnimationFrame(applySync);
      } else {
        applySync();
      }
    };

    try {
      const bounds = L.latLngBounds(CAMPUS_BOUNDS[0], CAMPUS_BOUNDS[1]);
      mapInstance = L.map(container, {
        center: CAMPUS_CENTER,
        zoom: 16,
        minZoom: 15,
        maxZoom: 19,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0,
        zoomControl: false,
        attributionControl: false,
      });

      const layerGroup = L.layerGroup().addTo(mapInstance);
      leafletMapRef.current = mapInstance;
      vectorLayerGroupRef.current = layerGroup;

      mapInstance.on('move zoom moveend zoomend resize viewreset', scheduleSync);
      applySync();
    } catch {
      // Safe fallback to pure SVG vector layer when DOM/WebGL layout is unavailable (e.g. JSDOM)
      setHasMeasuredViewport(false);
    }

    return () => {
      if (
        rafId !== null &&
        typeof window !== 'undefined' &&
        typeof window.cancelAnimationFrame === 'function'
      ) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (mapInstance) {
        try {
          mapInstance.off('move zoom moveend zoomend resize viewreset', scheduleSync);
          mapInstance.remove();
        } catch {
          // ignore cleanup errors in headless DOM
        }
      }
      leafletMapRef.current = null;
      tileLayerRef.current = null;
      vectorLayerGroupRef.current = null;
    };
  }, []);

  // Switch tile layer cleanly between OSM Standard, CartoDB Dark Matter, and Esri World Imagery
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      try {
        tileLayerRef.current.off();
        tileLayerRef.current.remove();
      } catch {
        // ignore cleanup errors
      }
      tileLayerRef.current = null;
    }

    setTilesOffline(false);

    const isCartoDark = mapStyle === 'osm' && isNightMap;
    const tileUrl =
      mapStyle === 'satellite'
        ? TILE_URLS.satellite
        : isCartoDark
          ? TILE_URLS.osmNight
          : TILE_URLS.osm;

    try {
      const layer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: isCartoDark ? 'abcd' : 'abc',
        crossOrigin: 'anonymous',
      });

      layer.on('tileerror', () => setTilesOffline(true));
      layer.on('tileload', () => setTilesOffline(false));
      layer.addTo(map);
      tileLayerRef.current = layer;
    } catch {
      setTilesOffline(true);
    }

    return () => {
      if (tileLayerRef.current) {
        try {
          tileLayerRef.current.off();
          tileLayerRef.current.remove();
        } catch {
          // ignore cleanup errors
        }
        tileLayerRef.current = null;
      }
    };
  }, [mapStyle, isNightMap]);

  // Sync local GeoJSON footprint, walkways, routes, dark zones, and active pole halos inside Leaflet
  useEffect(() => {
    const group = vectorLayerGroupRef.current;
    if (!group) return;

    try {
      group.clearLayers();

      // 1. UFSC Trindade campus perimeter GeoJSON
      L.geoJSON(toGeoJsonPolygon(UFSC_PERIMETER_RING), {
        style: {
          color: isNightMap ? '#536878' : '#CBD5E1',
          weight: 2,
          dashArray: '6 6',
          fillColor: isNightMap ? '#0A0A0A' : '#EEF3F9',
          fillOpacity: isNightMap ? 0.32 : 0.22,
        },
        interactive: false,
      }).addTo(group);

      // 2. Bosque do CFH green polygon GeoJSON
      L.geoJSON(toGeoJsonPolygon(BOSQUE_RING), {
        style: {
          color: isNightMap ? 'rgba(52, 211, 153, 0.45)' : '#10B981',
          weight: 1.5,
          fillColor: isNightMap ? '#065F46' : '#10B981',
          fillOpacity: isNightMap ? 0.28 : 0.16,
        },
        interactive: false,
      }).addTo(group);

      // 3. Real OSM campus sidewalks & pedestrian walkways GeoJSON
      L.geoJSON(UFSC_WALKWAYS_GEOJSON, {
        style: {
          color: isNightMap ? '#536878' : '#CBD5E1',
          weight: 1.5,
          opacity: isNightMap ? 0.42 : 0.72,
        },
        interactive: false,
      }).addTo(group);

      // 4. All routable campus walkway edges (using real OSM waypoints)
      for (const edge of UFSC_EDGES) {
        const fromNode = NODE_MAP.get(edge.from);
        const toNode = NODE_MAP.get(edge.to);
        if (!fromNode || !toNode) continue;

        const pts =
          edge.waypoints && edge.waypoints.length > 1
            ? edge.waypoints
            : [fromNode.coordinates, toNode.coordinates];
        const isDark = darkEdgeIds.has(edge.id);
        const showAsDarkZone = filters.darkZones && isDark;

        L.polyline(pts, {
          color: showAsDarkZone
            ? isNightMap
              ? '#EF4444'
              : '#DC2626'
            : isNightMap
              ? '#536878'
              : '#94A3B8',
          weight: showAsDarkZone ? 4 : 2.5,
          dashArray: showAsDarkZone ? '4 6' : undefined,
          opacity: showAsDarkZone ? 0.88 : isNightMap ? 0.55 : 0.68,
          interactive: false,
        }).addTo(group);
      }

      // 5. Comparison route (dashed subtle preview)
      if (comparisonRoute.coordinates.length > 1) {
        L.polyline(comparisonRoute.coordinates, {
          color: isNightMap ? '#94A3B8' : '#64748B',
          weight: 3,
          dashArray: '6 7',
          opacity: 0.55,
          interactive: false,
        }).addTo(group);
      }

      // 6. Active route polyline + luminous halo
      if (activeRoute.coordinates.length > 1) {
        const isWarnRoute = routeMode === 'fastest' && activeRoute.hasDarkWarning;
        L.polyline(activeRoute.coordinates, {
          color: isWarnRoute ? '#F7C648' : isNightMap ? '#2563EB' : '#5EC2F3',
          weight: 12,
          opacity: isNightMap ? 0.45 : 0.55,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(group);

        L.polyline(activeRoute.coordinates, {
          color: isWarnRoute
            ? isNightMap
              ? '#FBBF24'
              : '#D97706'
            : isNightMap
              ? '#5EC2F3'
              : '#2563EB',
          weight: 4.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(group);
      }

      // 7. Night-mode glowing pole halos & dark-zone warning rings
      if (filters.posts && isNightMap) {
        for (const post of posts) {
          if (post.status === 'aceso') {
            L.circle(post.coordinates, {
              radius: 32,
              color: '#34D399',
              weight: 1,
              opacity: 0.4,
              fillColor: '#10B981',
              fillOpacity: 0.18,
              interactive: false,
            }).addTo(group);
          }
        }
      }

      if (filters.darkZones) {
        for (const post of posts) {
          if (post.status === 'queimado') {
            L.circle(post.coordinates, {
              radius: 42,
              color: isNightMap ? '#FF3B30' : '#D70015',
              weight: 1.5,
              dashArray: '4 4',
              fillColor: isNightMap ? '#FF3B30' : '#D70015',
              fillOpacity: 0.14,
              interactive: false,
            }).addTo(group);
          }
        }
        for (const nodeId of activeReportNodes) {
          const n = NODE_MAP.get(nodeId);
          if (n) {
            L.circle(n.coordinates, {
              radius: 46,
              color: isNightMap ? '#FF9F0A' : '#D97706',
              weight: 1.5,
              dashArray: '3 5',
              fillColor: isNightMap ? '#FF9F0A' : '#D97706',
              fillOpacity: 0.12,
              interactive: false,
            }).addTo(group);
          }
        }
      }
    } catch {
      // ignore Leaflet vector sync error in minimal DOMs
    }
  }, [
    isNightMap,
    activeRoute,
    comparisonRoute,
    routeMode,
    posts,
    filters,
    darkEdgeIds,
    activeReportNodes,
  ]);

  const getMarkerPosition = useCallback(
    (coords: Coordinates, offsetPx: [number, number] = [0, 0]): { left: string; top: string } => {
      const map = leafletMapRef.current;
      const container = mapContainerRef.current;
      if (hasMeasuredViewport && map && container && container.clientWidth > 0) {
        try {
          const pt = map.latLngToContainerPoint(coords);
          return {
            left: `${Math.round(pt.x + offsetPx[0])}px`,
            top: `${Math.round(pt.y + offsetPx[1])}px`,
          };
        } catch {
          // fallback to % projection
        }
      }
      const { xPct, yPct } = projectToPercent(coords);
      return {
        left:
          offsetPx[0] !== 0
            ? `calc(${xPct.toFixed(2)}% + ${offsetPx[0]}px)`
            : `${xPct.toFixed(2)}%`,
        top:
          offsetPx[1] !== 0
            ? `calc(${yPct.toFixed(2)}% + ${offsetPx[1]}px)`
            : `${yPct.toFixed(2)}%`,
      };
    },
    [hasMeasuredViewport]
  );

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) ?? null,
    [posts, selectedPostId]
  );

  const tileThemeClass =
    mapStyle === 'satellite'
      ? isNightMap
        ? 'bg-[#0A0A0A] brightness-75 contrast-110'
        : 'bg-[#0A0A0A]'
      : isNightMap
        ? 'bg-[#0A0A0A]'
        : 'bg-[#EEF3F9] rua-escura-day-tiles';

  return (
    <div
      data-testid="campus-map"
      data-night={String(isNightMap)}
      data-map-style={mapStyle}
      className={`relative w-full h-full overflow-hidden select-none transition-colors duration-300 ${
        isNightMap ? 'bg-[#0A0A0A] text-[#F8FAFC]' : 'bg-[#EEF3F9] text-[#0F172A]'
      }`}
    >
      {/* Leaflet Geographic Canvas */}
      <div
        ref={mapContainerRef}
        aria-label="Mapa interativo do Campus Trindade da UFSC"
        className={`absolute inset-0 z-0 ${tileThemeClass}`}
      />

      {/* Nocturnal atmospheric tint over Esri satellite imagery (preserves natural aerial hues) */}
      {isNightMap && mapStyle === 'satellite' && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[0] pointer-events-none bg-[#080E21]/40"
        />
      )}

      {/* Resilient Local Vector Campus Footprint Fallback (always present for offline/JSDOM/zero-tile rendering) */}
      <VectorFallbackSvg
        visible={!hasMeasuredViewport || tilesOffline}
        isNightMap={isNightMap}
        routeMode={routeMode}
        activeRoute={activeRoute}
        comparisonRoute={comparisonRoute}
        posts={posts}
        filters={filters}
        darkEdgeIds={darkEdgeIds}
        activeReportNodes={activeReportNodes}
      />

      {/* Interactive Accessible Marker Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Campus Building & Landmark Pins */}
        {UFSC_LANDMARKS.map((node) => {
          const pos = getMarkerPosition(node.coordinates);
          return (
            <LandmarkMarker
              key={node.id}
              node={node}
              isOrigin={node.id === activeOriginId}
              isDest={node.id === activeDestinationId}
              isNightMap={isNightMap}
              left={pos.left}
              top={pos.top}
              onSelect={onSelectLandmark}
            />
          );
        })}

        {/* Lamp Post Status Markers (Never color-only: Zap / AlertTriangle / Flame + ARIA status) */}
        {filters.posts &&
          posts.map((post) => {
            const pos = getMarkerPosition(post.coordinates);
            return (
              <LampPostMarker
                key={post.id}
                post={post}
                isSelected={post.id === selectedPostId}
                isNightMap={isNightMap}
                left={pos.left}
                top={pos.top}
                onSelect={onSelectPost}
              />
            );
          })}

        {/* Trio Pastel Companion Pins */}
        {filters.companions &&
          companionMatches.map((comp, idx) => {
            const originNode = NODE_MAP.get(comp.originId);
            if (!originNode) return null;
            const offset: [number, number] = [20 + (idx % 2) * 8, -20];
            const pos = getMarkerPosition(originNode.coordinates, offset);

            return (
              <CompanionMarker
                key={comp.id}
                companion={comp}
                variant={pickTrioVariant(idx)}
                isNightMap={isNightMap}
                left={pos.left}
                top={pos.top}
                onSelect={onSelectCompanion}
              />
            );
          })}
      </div>

      {/* Compact Map Legend Pill (above BottomSheet peek height) */}
      <div
        aria-label="Legenda do mapa"
        className={`pointer-events-auto absolute bottom-[156px] left-3 z-20 inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 px-2.5 py-1.5 rounded-full border backdrop-blur-xl text-[10px] font-medium max-w-[calc(100%-24px)] ${
          isNightMap
            ? 'bg-[#0A0A0A]/84 text-[#E2E8F0] border-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.45)]'
            : 'bg-white/88 text-[#0F172A] border-[#CBD5E1]/90 shadow-[0_4px_14px_rgba(15,23,42,0.08)]'
        }`}
      >
        <span className="font-semibold opacity-80">Postes:</span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span>Aceso</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#F7C648]" />
          <span>Oscilando</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#EF4444]" />
          <span>Queimado</span>
        </span>
        <span aria-hidden="true" className="opacity-35">
          •
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#2563EB]" />
          <span>Centros</span>
        </span>
      </div>

      {/* Compact Lamp Post Status Summary Callout (Opaque Surface) */}
      {selectedPost && (
        <div
          role="status"
          aria-live="polite"
          className={`absolute left-3 right-3 sm:left-auto sm:right-4 sm:w-80 top-[168px] sm:top-[152px] z-20 rounded-2xl p-3.5 border flex items-start justify-between gap-3 ${
            isNightMap
              ? 'bg-[#0A0A0A]/95 backdrop-blur-xl text-[#F8FAFC] border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.55)]'
              : 'bg-white/95 backdrop-blur-xl text-[#0F172A] border-[#CBD5E1]/90 shadow-[0_12px_32px_rgba(15,23,42,0.14)]'
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {(() => {
                const meta = LAMP_STATUS_META[selectedPost.status];
                const Icon = meta.Icon;
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      isNightMap ? meta.nightBadgeClass : meta.dayBadgeClass
                    }`}
                  >
                    <Icon className="w-3 h-3" aria-hidden="true" />
                    <span>{meta.label}</span>
                  </span>
                );
              })()}
              <span className="text-xs font-mono opacity-70">{selectedPost.id}</span>
            </div>
            <p className="text-sm font-medium mt-1.5 truncate">{selectedPost.name}</p>
          </div>
          <button
            type="button"
            onClick={() => onSelectPost(null)}
            aria-label="Fechar resumo do poste"
            className={`min-w-[44px] min-h-[44px] -my-1 -mr-1 rounded-full inline-flex items-center justify-center cursor-pointer transition-colors ${
              isNightMap ? 'hover:bg-white/10 text-[#F8FAFC]' : 'hover:bg-black/5 text-[#0F172A]'
            }`}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

export const CampusMap = React.memo(CampusMapComponent);
CampusMap.displayName = 'CampusMap';
