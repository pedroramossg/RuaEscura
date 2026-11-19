import React, { useState } from 'react';
import { useCampusStore } from '../../hooks/useCampusStore';
import { useHaptics } from '../../hooks/useHaptics';
import type { SheetDetent } from '../ui/BottomSheet';
import type { LampPost } from '../../types/campus';
import { CampusMap, MapLayerFilters, type MapStyle } from './CampusMap';
import { RouteControlsOverlay } from './RouteControlsOverlay';
import { RouteSheet } from './RouteSheet';

export interface MapTabProps {
  onOpenReportsShortcut?: () => void;
}

/**
 * Main interactive Map tab integrating:
 * - Bounded UFSC Trindade Leaflet + vector campus map
 * - Floating Liquid Glass RouteControlsOverlay
 * - Single unified RouteSheet with route comparison, Gov.br peers, and in-sheet chat
 */
export const MapTab: React.FC<MapTabProps> = ({ onOpenReportsShortcut }) => {
  const {
    activeOriginId,
    activeDestinationId,
    routeMode,
    brightestRoute,
    fastestRoute,
    activeRoute,
    posts,
    reports,
    companionMatches,
    chatMessages,
    isNightMap,
    darkMode,
    toggleNightMap,
    toggleDarkMode,
    setRouteEndpoints,
    swapEndpoints,
    setRouteMode,
    toggleJoinCompanion,
    sendChatMessage,
  } = useCampusStore();

  const { trigger } = useHaptics();
  const effectiveNightMap = darkMode || isNightMap;

  const [filters, setFilters] = useState<MapLayerFilters>({
    companions: false,
    posts: true,
    darkZones: true,
  });
  const [mapStyle, setMapStyle] = useState<MapStyle>('osm');
  const [detent, setDetent] = useState<SheetDetent>('medium');
  const [activeChatCompanionId, setActiveChatCompanionId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const comparisonRoute = routeMode === 'brightest' ? fastestRoute : brightestRoute;

  const handleToggleFilter = (key: keyof MapLayerFilters) => {
    trigger('selection');
    setFilters((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectLandmark = (nodeId: string) => {
    if (nodeId === activeDestinationId) {
      trigger('light');
      return;
    }
    if (nodeId === activeOriginId) {
      swapEndpoints();
      return;
    }
    setRouteEndpoints(activeOriginId, nodeId);
  };

  const handleSelectPost = (post: LampPost | null) => {
    trigger('light');
    setSelectedPostId(post ? post.id : null);
  };

  const handleOpenChat = (companionId: string) => {
    trigger('selection');
    setActiveChatCompanionId(companionId);
    setDetent('expanded');
  };

  const handleCloseChat = () => {
    trigger('light');
    setActiveChatCompanionId(null);
  };

  const handleToggleNightMap = () => {
    trigger('selection');
    if (darkMode) {
      toggleDarkMode();
      if (isNightMap) {
        toggleNightMap();
      }
    } else {
      toggleNightMap();
    }
  };

  return (
    <section
      aria-label="Mapa de iluminação segura da UFSC"
      className="relative w-full h-[100dvh] min-h-[600px] overflow-hidden"
    >
      <CampusMap
        isNightMap={effectiveNightMap}
        mapStyle={mapStyle}
        activeOriginId={activeOriginId}
        activeDestinationId={activeDestinationId}
        routeMode={routeMode}
        activeRoute={activeRoute}
        comparisonRoute={comparisonRoute}
        posts={posts}
        reports={reports}
        companionMatches={companionMatches}
        filters={filters}
        selectedPostId={selectedPostId}
        onSelectLandmark={handleSelectLandmark}
        onSelectPost={handleSelectPost}
        onSelectCompanion={handleOpenChat}
      />

      <RouteControlsOverlay
        activeOriginId={activeOriginId}
        activeDestinationId={activeDestinationId}
        isNightMap={effectiveNightMap}
        mapStyle={mapStyle}
        filters={filters}
        onChangeEndpoints={setRouteEndpoints}
        onSwapEndpoints={swapEndpoints}
        onToggleFilter={handleToggleFilter}
        onToggleNightMap={handleToggleNightMap}
        onToggleMapStyle={() => {
          trigger('selection');
          setMapStyle((prev) => (prev === 'osm' ? 'satellite' : 'osm'));
        }}
        onOpenReportsShortcut={onOpenReportsShortcut}
      />

      <RouteSheet
        detent={detent}
        onDetentChange={(nextDetent) => {
          trigger('selection');
          setDetent(nextDetent);
        }}
        isNightMap={effectiveNightMap}
        activeOriginId={activeOriginId}
        activeDestinationId={activeDestinationId}
        routeMode={routeMode}
        brightestRoute={brightestRoute}
        fastestRoute={fastestRoute}
        activeRoute={activeRoute}
        companionMatches={companionMatches}
        chatMessages={chatMessages}
        activeChatCompanionId={activeChatCompanionId}
        onSelectRouteMode={setRouteMode}
        onToggleJoinCompanion={toggleJoinCompanion}
        onOpenChat={handleOpenChat}
        onCloseChat={handleCloseChat}
        onSendChatMessage={sendChatMessage}
      />
    </section>
  );
};
