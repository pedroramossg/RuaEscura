import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { Zap, AlertTriangle, Flame, ShieldCheck, X } from 'lucide-react';
import type {
  CampusNode,
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

const TILE_URLS: Record<MapStyle, string> = {
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
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
    dayBadgeClass: 'bg-[#B9FC01] text-[#0B1226] border-[#0B1226]',
    nightBadgeClass:
      'bg-[#B9FC01] text-[#0B1226] border-[#B9FC01] shadow-[0_0_16px_rgba(185,252,1,0.85)] ring-4 ring-[#B9FC01]/35',
  },
  oscilando: {
    label: 'Oscilando',
    Icon: AlertTriangle,
    dayBadgeClass: 'bg-[#D97706] text-white border-[#92400E]',
    nightBadgeClass: 'bg-[#FF9F0A] text-[#0B1226] border-[#FF9F0A] ring-4 ring-[#FF9F0A]/30',
  },
  queimado: {
    label: 'Queimado',
    Icon: Flame,
    dayBadgeClass: 'bg-[#D70015] text-white border-[#7F1D1D]',
    nightBadgeClass: 'bg-[#FF3B30] text-white border-[#FF3B30] ring-4 ring-[#FF3B30]/35',
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
          <radialGradient id="pole-halo-lime" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#B9FC01" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#B9FC01" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Campus Perimeter Polygon */}
        <polygon
          points={PERIMETER_SVG_POINTS}
          fill={isNightMap ? '#0d1736' : '#FFF9EA'}
          fillOpacity={isNightMap ? 0.72 : 0.78}
          stroke={isNightMap ? '#B9FC01' : '#cbd5e1'}
          strokeOpacity={isNightMap ? 0.35 : 1}
          strokeWidth="2"
          strokeDasharray="8 6"
        />

        {/* Bosque do CFH Green Polygon */}
        <polygon
          points={BOSQUE_SVG_POINTS}
          fill="#15803d"
          fillOpacity={isNightMap ? 0.28 : 0.18}
          stroke="#15803d"
          strokeOpacity={isNightMap ? 0.6 : 0.5}
          strokeWidth="1.5"
        />

        {/* OSM Campus Sidewalks & Pedestrian Walkways */}
        {WALKWAY_SVG_POLYLINES.map((points, idx) => (
          <polyline
            key={`walkway-${idx}`}
            points={points}
            fill="none"
            stroke={isNightMap ? '#1d2b53' : '#e2e8f0'}
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
                    ? '#FF3B30'
                    : '#D70015'
                  : isNightMap
                    ? '#2a3c6e'
                    : '#cbd5e1'
              }
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
            stroke={isNightMap ? '#a1a1aa' : '#66646d'}
            strokeWidth="2.5"
            strokeDasharray="6 8"
            strokeOpacity="0.6"
          />
        )}

        {/* Active Route Luminous Line */}
        {activeRoute.coordinates.length > 1 && (
          <>
            <polyline
              points={toSvgPolylinePoints(activeRoute.coordinates, true)}
              fill="none"
              stroke={isWarnRoute ? '#FF9F0A' : '#B9FC01'}
              strokeWidth="12"
              strokeOpacity={isNightMap ? 0.35 : 0.78}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={toSvgPolylinePoints(activeRoute.coordinates, true)}
              fill="none"
              stroke={
                isWarnRoute ? '#D97706' : isNightMap ? '#B9FC01' : '#0131CD'
              }
              strokeWidth="4"
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
                  r="28"
                  fill="url(#pole-halo-lime)"
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

    return (
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        style={style}
        aria-label={`${node.shortName} — ${node.name}${roleSuffix}`}
        aria-pressed={isOrigin || isDest}
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B9FC01] rounded-full group"
      >
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tight border shadow-sm transition-transform duration-120 group-active:scale-95 whitespace-nowrap ${
            isOrigin
              ? 'bg-[#0131CD] text-[#B9FC01] border-[#B9FC01]'
              : isDest
                ? 'bg-[#B9FC01] text-[#0B1226] border-[#0131CD]'
                : isNightMap
                  ? 'bg-[#0B132B] text-[#FEF1CF] border-[#1F2E5C] hover:border-[#B9FC01]'
                  : 'bg-[#FFF9EA] text-[#0B1226] border-[#D8C89E] hover:border-[#0131CD]'
          }`}
        >
          {isOrigin && <span className="text-[10px] uppercase opacity-90">O</span>}
          {isDest && <span className="text-[10px] uppercase opacity-90">D</span>}
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
    const StatusIcon = meta.Icon;
    const style = useMemo<React.CSSProperties>(() => ({ left, top }), [left, top]);

    return (
      <button
        type="button"
        onClick={() => onSelect(isSelected ? null : post)}
        style={style}
        aria-label={`${post.id} — ${post.name} (${meta.label})`}
        aria-pressed={isSelected}
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B9FC01] rounded-full group"
      >
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-full border transition-transform duration-120 group-active:scale-95 ${
            isNightMap ? meta.nightBadgeClass : meta.dayBadgeClass
          } ${isSelected ? 'scale-110' : ''}`}
        >
          <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </button>
    );
  }
);
LampPostMarker.displayName = 'LampPostMarker';

interface CompanionMarkerProps {
  companion: CompanionMatch;
  isNightMap: boolean;
  left: string;
  top: string;
  onSelect?: (companionId: string) => void;
}

const CompanionMarker = React.memo<CompanionMarkerProps>(
  ({ companion, isNightMap, left, top, onSelect }) => {
    const style = useMemo<React.CSSProperties>(() => ({ left, top }), [left, top]);

    return (
      <button
        type="button"
        onClick={() => onSelect?.(companion.id)}
        style={style}
        aria-label={`Colega verificado Gov.br: ${companion.name} saindo às ${companion.departureTime}`}
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer rounded-full group"
      >
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 h-6 rounded-full text-[10px] font-semibold border shadow-sm transition-transform group-active:scale-95 ${
            isNightMap
              ? 'bg-[#0f172a] text-[#B9FC01] border-[#B9FC01]/60'
              : 'bg-[#0131CD] text-white border-white'
          }`}
        >
          <span>{companion.initials}</span>
          <ShieldCheck className="w-3 h-3 text-[#B9FC01]" aria-hidden="true" />
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

  // Switch tile layer cleanly between OSM Standard and Esri World Imagery
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

    try {
      const layer = L.tileLayer(TILE_URLS[mapStyle], {
        maxZoom: 19,
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
  }, [mapStyle]);

  // Sync local GeoJSON footprint, walkways, routes, dark zones, and active pole halos inside Leaflet
  useEffect(() => {
    const group = vectorLayerGroupRef.current;
    if (!group) return;

    try {
      group.clearLayers();

      // 1. UFSC Trindade campus perimeter GeoJSON
      L.geoJSON(toGeoJsonPolygon(UFSC_PERIMETER_RING), {
        style: {
          color: isNightMap ? 'rgba(185, 252, 1, 0.38)' : '#94a3b8',
          weight: 2,
          dashArray: '6 6',
          fillColor: isNightMap ? '#080E21' : '#FFF9EA',
          fillOpacity: isNightMap ? 0.35 : 0.2,
        },
        interactive: false,
      }).addTo(group);

      // 2. Bosque do CFH green polygon GeoJSON
      L.geoJSON(toGeoJsonPolygon(BOSQUE_RING), {
        style: {
          color: isNightMap ? 'rgba(185, 252, 1, 0.45)' : '#15803d',
          weight: 1.5,
          fillColor: '#15803d',
          fillOpacity: isNightMap ? 0.24 : 0.18,
        },
        interactive: false,
      }).addTo(group);

      // 3. Real OSM campus sidewalks & pedestrian walkways GeoJSON
      L.geoJSON(UFSC_WALKWAYS_GEOJSON, {
        style: {
          color: isNightMap ? '#23325b' : '#cbd5e1',
          weight: 1.5,
          opacity: isNightMap ? 0.65 : 0.72,
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
              ? '#FF3B30'
              : '#D70015'
            : isNightMap
              ? '#334155'
              : '#94a3b8',
          weight: showAsDarkZone ? 4 : 2.5,
          dashArray: showAsDarkZone ? '4 6' : undefined,
          opacity: showAsDarkZone ? 0.88 : 0.68,
          interactive: false,
        }).addTo(group);
      }

      // 5. Comparison route (dashed subtle preview)
      if (comparisonRoute.coordinates.length > 1) {
        L.polyline(comparisonRoute.coordinates, {
          color: isNightMap ? '#a1a1aa' : '#66646d',
          weight: 3,
          dashArray: '6 8',
          opacity: 0.55,
          interactive: false,
        }).addTo(group);
      }

      // 6. Active route polyline + luminous halo
      if (activeRoute.coordinates.length > 1) {
        const isWarnRoute = routeMode === 'fastest' && activeRoute.hasDarkWarning;
        L.polyline(activeRoute.coordinates, {
          color: isWarnRoute ? '#FF9F0A' : '#B9FC01',
          weight: 12,
          opacity: isNightMap ? 0.35 : 0.75,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(group);

        L.polyline(activeRoute.coordinates, {
          color: isWarnRoute
            ? isNightMap
              ? '#FF9F0A'
              : '#D97706'
            : isNightMap
              ? '#B9FC01'
              : '#0131CD',
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
              radius: 36,
              color: '#B9FC01',
              weight: 1,
              opacity: 0.45,
              fillColor: '#B9FC01',
              fillOpacity: 0.22,
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
        ? 'bg-[#080E21] brightness-75 contrast-110'
        : 'bg-[#080E21]'
      : isNightMap
        ? 'bg-[#080E21] rua-escura-night-tiles'
        : 'bg-[#FEF1CF] rua-escura-day-tiles';

  return (
    <div
      data-testid="campus-map"
      data-night={String(isNightMap)}
      data-map-style={mapStyle}
      className={`relative w-full h-full overflow-hidden select-none transition-colors duration-300 ${
        isNightMap ? 'bg-[#080E21] text-[#f3f3f4]' : 'bg-[#FEF1CF] text-[#0B1226]'
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

        {/* Verified Gov.br Companion Pins */}
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
                isNightMap={isNightMap}
                left={pos.left}
                top={pos.top}
                onSelect={onSelectCompanion}
              />
            );
          })}
      </div>

      {/* Compact Lamp Post Status Summary Callout (Opaque Surface) */}
      {selectedPost && (
        <div
          role="status"
          aria-live="polite"
          className={`absolute left-3 right-3 sm:left-auto sm:right-4 sm:w-80 top-[140px] z-20 rounded-2xl p-3.5 shadow-lg border flex items-start justify-between gap-3 ${
            isNightMap
              ? 'bg-[#0B132B] text-[#FEF1CF] border-[#1F2E5C]'
              : 'bg-[#FFF9EA] text-[#0B1226] border-[#D8C89E]'
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
              isNightMap ? 'hover:bg-white/10 text-[#f3f3f4]' : 'hover:bg-black/5 text-[#0B1226]'
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
