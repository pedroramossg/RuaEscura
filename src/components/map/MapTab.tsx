import React, { useState } from 'react';
import { useCampusStore } from '../../hooks/useCampusStore';
import { useHaptics } from '../../hooks/useHaptics';
import type { SheetDetent } from '../ui/BottomSheet';
import type { LampPost } from '../../types/campus';
import { CampusMap, MapLayerFilters } from './CampusMap';
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
    toggleNightMap,
    setRouteEndpoints,
    swapEndpoints,
    setRouteMode,
    toggleJoinCompanion,
    sendChatMessage,
  } = useCampusStore();

  const { trigger } = useHaptics();

  const [filters, setFilters] = useState<MapLayerFilters>({
    companions: true,
    posts: true,
    darkZones: true,
  });
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
    if (detent === 'peek') {
      setDetent('medium');
    }
  };

  const handleCloseChat = () => {
    trigger('light');
    setActiveChatCompanionId(null);
  };

  return (
    <section
      aria-label="Mapa de iluminação segura da UFSC"
      className="relative w-full h-[100dvh] min-h-[600px] overflow-hidden"
    >
      <CampusMap
        isNightMap={isNightMap}
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
        isNightMap={isNightMap}
        filters={filters}
        onChangeEndpoints={setRouteEndpoints}
        onSwapEndpoints={swapEndpoints}
        onToggleFilter={handleToggleFilter}
        onToggleNightMap={toggleNightMap}
        onOpenReportsShortcut={onOpenReportsShortcut}
      />

      <RouteSheet
        detent={detent}
        onDetentChange={(nextDetent) => {
          trigger('selection');
          setDetent(nextDetent);
        }}
        isNightMap={isNightMap}
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
