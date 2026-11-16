import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  CAMPUS_BOUNDS,
  CAMPUS_CENTER,
  UFSC_EDGES,
  UFSC_LANDMARKS,
} from '../../data/ufscTrindade';

export interface MapLayerFilters {
  companions: boolean;
  posts: boolean;
  darkZones: boolean;
}

export interface CampusMapProps {
  isNightMap: boolean;
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

const UFSC_PERIMETER_RING: Coordinates[] = [
  [-27.5973, -48.5245],
  [-27.5971, -48.5198],
  [-27.5985, -48.5162],
  [-27.6028, -48.5162],
  [-27.6051, -48.5193],
  [-27.6052, -48.5238],
  [-27.6025, -48.5260],
  [-27.5991, -48.5256],
];

const BOSQUE_RING: Coordinates[] = [
  [-27.5993, -48.5198],
  [-27.5993, -48.5184],
  [-27.6008, -48.5183],
  [-27.6008, -48.5198],
];

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
    dayBadgeClass: 'bg-[#befc65] text-[#131314] border-[#131314]',
    nightBadgeClass:
      'bg-[#befc65] text-[#131314] border-[#befc65] shadow-[0_0_16px_rgba(190,252,101,0.85)] ring-4 ring-[#befc65]/35',
  },
  oscilando: {
    label: 'Oscilando',
    Icon: AlertTriangle,
    dayBadgeClass: 'bg-[#D97706] text-white border-[#92400E]',
    nightBadgeClass: 'bg-[#FF9F0A] text-[#131314] border-[#FF9F0A] ring-4 ring-[#FF9F0A]/30',
  },
  queimado: {
    label: 'Queimado',
    Icon: Flame,
    dayBadgeClass: 'bg-[#D70015] text-white border-[#7F1D1D]',
    nightBadgeClass: 'bg-[#FF3B30] text-white border-[#FF3B30] ring-4 ring-[#FF3B30]/35',
  },
};

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

/**
 * Projects lat/lng coordinates to normalized percentages inside CAMPUS_BOUNDS.
 */
function projectToPercent(coords: Coordinates): { xPct: number; yPct: number } {
  const [[minLat, minLng], [maxLat, maxLng]] = CAMPUS_BOUNDS;
  const xPct = ((coords[1] - minLng) / (maxLng - minLng)) * 100;
  const yPct = ((maxLat - coords[0]) / (maxLat - minLat)) * 100;
  return {
    xPct: Math.max(4, Math.min(96, xPct)),
    yPct: Math.max(8, Math.min(92, yPct)),
  };
}

/**
 * Interactive UFSC Trindade campus map powered by Leaflet (bounded to CAMPUS_BOUNDS)
 * plus a local GeoJSON/SVG vector campus footprint layer for offline resilience and accessibility.
 */
export const CampusMap: React.FC<CampusMapProps> = ({
  isNightMap,
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

  const nodeMap = useMemo(() => {
    const m = new Map<string, CampusNode>();
    for (const n of UFSC_LANDMARKS) {
      m.set(n.id, n);
    }
    return m;
  }, []);

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

  // Initialize Leaflet map once
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || leafletMapRef.current) return;

    let mapInstance: L.Map | null = null;
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

      const syncViewport = () => {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          setHasMeasuredViewport(true);
        }
        setProjectionVersion((v) => v + 1);
      };

      mapInstance.on('move zoom moveend zoomend resize viewreset', syncViewport);
      syncViewport();
    } catch {
      // Safe fallback to pure SVG vector layer when DOM/WebGL layout is unavailable (e.g. JSDOM)
      setHasMeasuredViewport(false);
    }

    return () => {
      if (mapInstance) {
        try {
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

  // Update raster TileLayer when Night Mode toggles
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    try {
      if (tileLayerRef.current) {
        tileLayerRef.current.remove();
        tileLayerRef.current = null;
      }

      const tileUrl = isNightMap
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

      const layer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: 'abcd',
      });

      layer.on('tileerror', () => setTilesOffline(true));
      layer.on('tileload', () => setTilesOffline(false));
      layer.addTo(map);
      tileLayerRef.current = layer;
    } catch {
      setTilesOffline(true);
    }
  }, [isNightMap]);

  // Sync local GeoJSON footprint, walkways, routes, dark zones, and active pole halos inside Leaflet
  useEffect(() => {
    const group = vectorLayerGroupRef.current;
    if (!group) return;

    try {
      group.clearLayers();

      // 1. UFSC Trindade campus perimeter GeoJSON
      L.geoJSON(toGeoJsonPolygon(UFSC_PERIMETER_RING), {
        style: {
          color: isNightMap ? 'rgba(190, 252, 101, 0.35)' : '#94a3b8',
          weight: 2,
          dashArray: '6 6',
          fillColor: isNightMap ? '#1c1c1e' : '#ffffff',
          fillOpacity: isNightMap ? 0.35 : 0.25,
        },
        interactive: false,
      }).addTo(group);

      // 2. Bosque UFSC green polygon GeoJSON
      L.geoJSON(toGeoJsonPolygon(BOSQUE_RING), {
        style: {
          color: isNightMap ? 'rgba(190, 252, 101, 0.4)' : '#15803d',
          weight: 1.5,
          fillColor: '#15803d',
          fillOpacity: isNightMap ? 0.22 : 0.16,
        },
        interactive: false,
      }).addTo(group);

      // 3. All campus walkway edges
      for (const edge of UFSC_EDGES) {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (!fromNode || !toNode) continue;

        const isDark = darkEdgeIds.has(edge.id);
        const showAsDarkZone = filters.darkZones && isDark;

        L.polyline([fromNode.coordinates, toNode.coordinates], {
          color: showAsDarkZone
            ? isNightMap
              ? '#FF3B30'
              : '#D70015'
            : isNightMap
              ? '#3f3f46'
              : '#cbd5e1',
          weight: showAsDarkZone ? 4 : 2.5,
          dashArray: showAsDarkZone ? '4 6' : undefined,
          opacity: showAsDarkZone ? 0.85 : 0.7,
          interactive: false,
        }).addTo(group);
      }

      // 4. Comparison route (dashed subtle preview)
      if (comparisonRoute.coordinates.length > 1) {
        L.polyline(comparisonRoute.coordinates, {
          color: isNightMap ? '#a1a1aa' : '#66646d',
          weight: 3,
          dashArray: '6 8',
          opacity: 0.55,
          interactive: false,
        }).addTo(group);
      }

      // 5. Active route polyline + luminous halo
      if (activeRoute.coordinates.length > 1) {
        const isWarnRoute = routeMode === 'fastest' && activeRoute.hasDarkWarning;
        L.polyline(activeRoute.coordinates, {
          color: isWarnRoute ? '#FF9F0A' : '#befc65',
          weight: 12,
          opacity: isNightMap ? 0.35 : 0.75,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(group);

        L.polyline(activeRoute.coordinates, {
          color: isWarnRoute ? '#D97706' : isNightMap ? '#befc65' : '#131314',
          weight: 4.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(group);
      }

      // 6. Night-mode glowing pole halos & dark-zone warning rings
      if (filters.posts && isNightMap) {
        for (const post of posts) {
          if (post.status === 'aceso') {
            L.circle(post.coordinates, {
              radius: 36,
              color: '#befc65',
              weight: 1,
              opacity: 0.45,
              fillColor: '#befc65',
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
          const n = nodeMap.get(nodeId);
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
    nodeMap,
  ]);

  // Project lat/lng to either live Leaflet screen pixels or normalized bounds percentage
  const getMarkerStyle = (
    coords: Coordinates,
    offsetPx: [number, number] = [0, 0]
  ): React.CSSProperties => {
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
  };

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) ?? null,
    [posts, selectedPostId]
  );

  const projectSvgPoint = (coords: Coordinates) => {
    const { xPct, yPct } = projectToPercent(coords);
    return `${(xPct * 8).toFixed(1)},${(yPct * 6).toFixed(1)}`;
  };

  return (
    <div
      data-testid="campus-map"
      data-night={String(isNightMap)}
      className={`relative w-full h-full overflow-hidden select-none transition-colors duration-300 ${
        isNightMap ? 'bg-[#131314] text-[#f3f3f4]' : 'bg-[#f3f3f4] text-[#131314]'
      }`}
    >
      {/* Leaflet Geographic Canvas */}
      <div
        ref={mapContainerRef}
        aria-label="Mapa interativo do Campus Trindade da UFSC"
        className={`absolute inset-0 z-0 ${isNightMap ? 'bg-[#131314]' : 'bg-[#f3f3f4]'}`}
      />

      {/* Resilient Local Vector Campus Footprint Fallback (always present for offline/JSDOM/zero-tile rendering) */}
      <svg
        data-testid="campus-vector-fallback"
        viewBox="0 0 800 600"
        preserveAspectRatio="none"
        aria-hidden="true"
        className={`absolute inset-0 w-full h-full z-[1] pointer-events-none transition-opacity duration-300 ${
          hasMeasuredViewport && !tilesOffline ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <defs>
          <radialGradient id="pole-halo-lime" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#befc65" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#befc65" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Campus Perimeter Polygon */}
        <polygon
          points={UFSC_PERIMETER_RING.map(projectSvgPoint).join(' ')}
          fill={isNightMap ? '#1c1c1e' : '#ffffff'}
          fillOpacity={isNightMap ? 0.65 : 0.75}
          stroke={isNightMap ? '#befc65' : '#cbd5e1'}
          strokeOpacity={isNightMap ? 0.35 : 1}
          strokeWidth="2"
          strokeDasharray="8 6"
        />

        {/* Bosque Green Polygon */}
        <polygon
          points={BOSQUE_RING.map(projectSvgPoint).join(' ')}
          fill="#15803d"
          fillOpacity={isNightMap ? 0.25 : 0.16}
          stroke="#15803d"
          strokeOpacity={isNightMap ? 0.55 : 0.45}
          strokeWidth="1.5"
        />

        {/* Campus Walkways */}
        {UFSC_EDGES.map((edge) => {
          const fromNode = nodeMap.get(edge.from);
          const toNode = nodeMap.get(edge.to);
          if (!fromNode || !toNode) return null;
          const p1 = projectToPercent(fromNode.coordinates);
          const p2 = projectToPercent(toNode.coordinates);
          const isDark = darkEdgeIds.has(edge.id);
          const showAsDark = filters.darkZones && isDark;

          return (
            <line
              key={edge.id}
              x1={p1.xPct * 8}
              y1={p1.yPct * 6}
              x2={p2.xPct * 8}
              y2={p2.yPct * 6}
              stroke={
                showAsDark
                  ? isNightMap
                    ? '#FF3B30'
                    : '#D70015'
                  : isNightMap
                    ? '#3f3f46'
                    : '#cbd5e1'
              }
              strokeWidth={showAsDark ? 3.5 : 2}
              strokeDasharray={showAsDark ? '5 5' : undefined}
            />
          );
        })}

        {/* Comparison Route (Subtle Dashed) */}
        {comparisonRoute.coordinates.length > 1 && (
          <polyline
            points={comparisonRoute.coordinates.map(projectSvgPoint).join(' ')}
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
              points={activeRoute.coordinates.map(projectSvgPoint).join(' ')}
              fill="none"
              stroke={routeMode === 'fastest' && activeRoute.hasDarkWarning ? '#FF9F0A' : '#befc65'}
              strokeWidth="12"
              strokeOpacity={isNightMap ? 0.35 : 0.85}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={activeRoute.coordinates.map(projectSvgPoint).join(' ')}
              fill="none"
              stroke={
                routeMode === 'fastest' && activeRoute.hasDarkWarning
                  ? '#D97706'
                  : isNightMap
                    ? '#befc65'
                    : '#131314'
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
            const node = nodeMap.get(nodeId);
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

      {/* Interactive Accessible Marker Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Campus Building & Landmark Pins */}
        {UFSC_LANDMARKS.map((node) => {
          const isOrigin = node.id === activeOriginId;
          const isDest = node.id === activeDestinationId;
          const roleSuffix = isOrigin ? ' (Origem)' : isDest ? ' (Destino)' : '';
          const style = getMarkerStyle(node.coordinates);

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectLandmark(node.id)}
              style={style}
              aria-label={`${node.shortName} — ${node.name}${roleSuffix}`}
              aria-pressed={isOrigin || isDest}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#befc65] rounded-full group"
            >
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tight border shadow-sm transition-transform duration-120 group-active:scale-95 whitespace-nowrap ${
                  isOrigin
                    ? 'bg-[#131314] text-[#befc65] border-[#befc65]'
                    : isDest
                      ? 'bg-[#befc65] text-[#131314] border-[#131314]'
                      : isNightMap
                        ? 'bg-[#1c1c1e] text-[#f3f3f4] border-[#2e2e32] hover:border-[#befc65]'
                        : 'bg-white text-[#131314] border-[#dfe3e6] hover:border-[#131314]'
                }`}
              >
                {isOrigin && <span className="text-[10px] uppercase opacity-90">O</span>}
                {isDest && <span className="text-[10px] uppercase opacity-90">D</span>}
                <span>{node.shortName}</span>
              </span>
            </button>
          );
        })}

        {/* Lamp Post Status Markers (Never color-only: Zap / AlertTriangle / Flame + ARIA status) */}
        {filters.posts &&
          posts.map((post) => {
            const meta = LAMP_STATUS_META[post.status];
            const StatusIcon = meta.Icon;
            const isSelected = post.id === selectedPostId;
            const style = getMarkerStyle(post.coordinates);

            return (
              <button
                key={post.id}
                type="button"
                onClick={() => onSelectPost(isSelected ? null : post)}
                style={style}
                aria-label={`${post.id} — ${post.name} (${meta.label})`}
                aria-pressed={isSelected}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#befc65] rounded-full group"
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
          })}

        {/* Verified Gov.br Companion Pins */}
        {filters.companions &&
          companionMatches.map((comp, idx) => {
            const originNode = nodeMap.get(comp.originId);
            if (!originNode) return null;
            const offset: [number, number] = [20 + (idx % 2) * 8, -20];
            const style = getMarkerStyle(originNode.coordinates, offset);

            return (
              <button
                key={comp.id}
                type="button"
                onClick={() => onSelectCompanion?.(comp.id)}
                style={style}
                aria-label={`Colega verificado Gov.br: ${comp.name} saindo às ${comp.departureTime}`}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer rounded-full group"
              >
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 h-6 rounded-full text-[10px] font-semibold border shadow-sm transition-transform group-active:scale-95 ${
                    isNightMap
                      ? 'bg-[#1c1c1e] text-[#befc65] border-[#befc65]/60'
                      : 'bg-[#131314] text-white border-white'
                  }`}
                >
                  <span>{comp.initials}</span>
                  <ShieldCheck className="w-3 h-3 text-[#befc65]" aria-hidden="true" />
                </span>
              </button>
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
              ? 'bg-[#1c1c1e] text-[#f3f3f4] border-[#2e2e32]'
              : 'bg-white text-[#131314] border-[#dfe3e6]'
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
              isNightMap ? 'hover:bg-white/10 text-[#f3f3f4]' : 'hover:bg-black/5 text-[#131314]'
            }`}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
