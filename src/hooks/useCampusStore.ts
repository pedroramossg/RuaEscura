import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type {
  PersistedCampusState,
  LampPost,
  LampPostStatus,
  EdgeRatingSummary,
  IncidentReport,
  CompanionMatch,
  ChatMessage,
  GovBrSession,
  RouteMode,
  RouteResult,
  ReportCategory,
} from '../types/campus';
import { getSeedCampusState, UFSC_LANDMARKS } from '../data/ufscTrindade';
import { findRoute } from '../engine/routing';
import { loadCampusState, saveCampusState } from '../security/storage';
import {
  LightRatingSchema,
  ReportSubmissionSchema,
  ChatMessageSchema,
} from '../security/schemas';
import { useHaptics } from './useHaptics';

export interface CampusStoreContextType {
  // State
  version: number;
  onboardingCompleted: boolean;
  selectedBuildings: string[];
  timeSlot: string;
  isNightMap: boolean;
  hapticsEnabled: boolean;
  userSession: GovBrSession | null;
  posts: LampPost[];
  edgeRatings: Record<string, EdgeRatingSummary>;
  reports: IncidentReport[];
  companionMatches: CompanionMatch[];
  chatMessages: Record<string, ChatMessage[]>;
  activeOriginId: string;
  activeDestinationId: string;
  routeMode: RouteMode;

  // Computed routes
  brightestRoute: RouteResult;
  fastestRoute: RouteResult;
  activeRoute: RouteResult;

  // Actions
  completeOnboarding: (params: {
    selectedBuildings: string[];
    timeSlot: string;
    isNightMap: boolean;
    session: GovBrSession;
  }) => void;
  updateLampPostStatus: (postId: string, status: LampPostStatus) => void;
  rateEdgeLighting: (edgeId: string, rating: number) => { success: boolean; error?: string };
  submitReport: (input: {
    category: ReportCategory;
    location: string;
    description: string;
    isConfidential?: boolean;
    photoThumbnailUrl?: string;
  }) => { success: boolean; error?: string; report?: IncidentReport };
  toggleJoinCompanion: (companionId: string) => void;
  sendChatMessage: (companionId: string, text: string) => { success: boolean; error?: string };
  setRouteEndpoints: (originId: string, destinationId: string) => void;
  swapEndpoints: () => void;
  setRouteMode: (mode: RouteMode) => void;
  toggleNightMap: () => void;
  setHapticsEnabled: (enabled: boolean) => void;
  resetSessionOnly: () => void;
  resetAllDemoData: () => void;
}

const CampusStoreContext = createContext<CampusStoreContextType | null>(null);

export interface CampusStoreProviderProps {
  children: React.ReactNode;
  initialState?: PersistedCampusState;
}

export const CampusStoreProvider: React.FC<CampusStoreProviderProps> = ({
  children,
  initialState,
}) => {
  const [state, setState] = useState<PersistedCampusState>(() => {
    if (initialState) return initialState;
    return loadCampusState();
  });

  const haptics = useHaptics();

  const updateState = useCallback(
    (updater: (prev: PersistedCampusState) => PersistedCampusState) => {
      setState((prev) => {
        const next = updater(prev);
        saveCampusState(next);
        return next;
      });
    },
    []
  );

  const completeOnboarding = useCallback(
    ({
      selectedBuildings,
      timeSlot,
      isNightMap,
      session,
    }: {
      selectedBuildings: string[];
      timeSlot: string;
      isNightMap: boolean;
      session: GovBrSession;
    }) => {
      const activeOriginId = selectedBuildings[0] || 'bu';
      const activeDestinationId =
        selectedBuildings[1] || (activeOriginId === 'ru' ? 'bu' : 'ru');

      updateState((prev) => ({
        ...prev,
        onboardingCompleted: true,
        selectedBuildings,
        timeSlot,
        isNightMap,
        userSession: session,
        activeOriginId,
        activeDestinationId,
      }));
      haptics.trigger('success');
    },
    [updateState, haptics]
  );

  const updateLampPostStatus = useCallback(
    (postId: string, status: LampPostStatus) => {
      updateState((prev) => ({
        ...prev,
        posts: prev.posts.map((post) =>
          post.id === postId
            ? { ...post, status, lastUpdated: new Date().toISOString() }
            : post
        ),
      }));
      haptics.trigger('medium');
    },
    [updateState, haptics]
  );

  const rateEdgeLighting = useCallback(
    (edgeId: string, rating: number): { success: boolean; error?: string } => {
      const validation = LightRatingSchema.safeParse({ edgeId, rating });
      if (!validation.success) {
        haptics.trigger('error');
        return {
          success: false,
          error: validation.error.errors[0]?.message ?? 'Avaliação inválida',
        };
      }

      updateState((prev) => {
        const current = prev.edgeRatings[edgeId];
        let updatedSummary: EdgeRatingSummary;
        if (!current || current.count === 0) {
          updatedSummary = {
            averageRating: rating,
            count: 1,
          };
        } else {
          const newCount = current.count + 1;
          const newAvg = Number(
            ((current.averageRating * current.count + rating) / newCount).toFixed(1)
          );
          updatedSummary = {
            averageRating: newAvg,
            count: newCount,
          };
        }

        return {
          ...prev,
          edgeRatings: {
            ...prev.edgeRatings,
            [edgeId]: updatedSummary,
          },
        };
      });

      haptics.trigger('selection');
      return { success: true };
    },
    [updateState, haptics]
  );

  const submitReport = useCallback(
    (input: {
      category: ReportCategory;
      location: string;
      description: string;
      isConfidential?: boolean;
      photoThumbnailUrl?: string;
    }): { success: boolean; error?: string; report?: IncidentReport } => {
      const validation = ReportSubmissionSchema.safeParse(input);
      if (!validation.success) {
        haptics.trigger('error');
        return {
          success: false,
          error: validation.error.errors[0]?.message ?? 'Dados de denúncia inválidos',
        };
      }

      const locationLower = validation.data.location.toLowerCase();
      const matchedNode = UFSC_LANDMARKS.find(
        (node) =>
          node.name.toLowerCase().includes(locationLower) ||
          locationLower.includes(node.shortName.toLowerCase()) ||
          node.id.toLowerCase() === locationLower
      );

      const newId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const newReport: IncidentReport = {
        id: newId,
        category: validation.data.category,
        locationName: validation.data.location,
        locationNodeId: matchedNode?.id,
        description: validation.data.description,
        isConfidential: validation.data.isConfidential ?? true,
        createdAt: new Date().toISOString(),
        status: 'pendente',
        photoThumbnailUrl: validation.data.photoThumbnailUrl,
      };

      updateState((prev) => ({
        ...prev,
        reports: [newReport, ...prev.reports],
      }));

      haptics.trigger('success');
      return { success: true, report: newReport };
    },
    [updateState, haptics]
  );

  const toggleJoinCompanion = useCallback(
    (companionId: string) => {
      updateState((prev) => ({
        ...prev,
        companionMatches: prev.companionMatches.map((comp) =>
          comp.id === companionId ? { ...comp, isUserJoined: !comp.isUserJoined } : comp
        ),
      }));
      haptics.trigger('selection');
    },
    [updateState, haptics]
  );

  const sendChatMessage = useCallback(
    (companionId: string, text: string): { success: boolean; error?: string } => {
      const senderId = state.userSession ? 'user-current' : 'demo-user';
      const senderName = state.userSession?.name ?? 'Você';

      const validation = ChatMessageSchema.safeParse({
        senderId,
        senderName,
        text,
      });

      if (!validation.success) {
        haptics.trigger('error');
        return {
          success: false,
          error: validation.error.errors[0]?.message ?? 'Mensagem inválida',
        };
      }

      const msgId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const newMsg: ChatMessage = {
        id: msgId,
        senderId,
        senderName,
        text: validation.data.text,
        timestamp: new Date().toISOString(),
      };

      updateState((prev) => ({
        ...prev,
        chatMessages: {
          ...prev.chatMessages,
          [companionId]: [...(prev.chatMessages[companionId] || []), newMsg],
        },
      }));

      haptics.trigger('light');
      return { success: true };
    },
    [state.userSession, updateState, haptics]
  );

  const setRouteEndpoints = useCallback(
    (originId: string, destinationId: string) => {
      updateState((prev) => ({
        ...prev,
        activeOriginId: originId,
        activeDestinationId: destinationId,
      }));
      haptics.trigger('selection');
    },
    [updateState, haptics]
  );

  const swapEndpoints = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      activeOriginId: prev.activeDestinationId,
      activeDestinationId: prev.activeOriginId,
    }));
    haptics.trigger('selection');
  }, [updateState, haptics]);

  const setRouteMode = useCallback(
    (mode: RouteMode) => {
      updateState((prev) => ({
        ...prev,
        routeMode: mode,
      }));
      haptics.trigger('selection');
    },
    [updateState, haptics]
  );

  const toggleNightMap = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      isNightMap: !prev.isNightMap,
    }));
    haptics.trigger('light');
  }, [updateState, haptics]);

  const setHapticsEnabled = useCallback(
    (enabled: boolean) => {
      haptics.setEnabled(enabled);
      updateState((prev) => ({
        ...prev,
        hapticsEnabled: enabled,
      }));
    },
    [haptics, updateState]
  );

  const resetSessionOnly = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      onboardingCompleted: false,
      userSession: null,
    }));
    haptics.trigger('warning');
  }, [updateState, haptics]);

  const resetAllDemoData = useCallback(() => {
    const seed = getSeedCampusState();
    updateState(() => seed);
    haptics.trigger('warning');
  }, [updateState, haptics]);

  const brightestRoute = useMemo(() => {
    return findRoute(
      state.activeOriginId,
      state.activeDestinationId,
      'brightest',
      state.posts,
      state.edgeRatings,
      state.reports
    );
  }, [
    state.activeOriginId,
    state.activeDestinationId,
    state.posts,
    state.edgeRatings,
    state.reports,
  ]);

  const fastestRoute = useMemo(() => {
    return findRoute(
      state.activeOriginId,
      state.activeDestinationId,
      'fastest',
      state.posts,
      state.edgeRatings,
      state.reports
    );
  }, [
    state.activeOriginId,
    state.activeDestinationId,
    state.posts,
    state.edgeRatings,
    state.reports,
  ]);

  const activeRoute = state.routeMode === 'brightest' ? brightestRoute : fastestRoute;

  const contextValue: CampusStoreContextType = {
    version: state.version,
    onboardingCompleted: state.onboardingCompleted,
    selectedBuildings: state.selectedBuildings,
    timeSlot: state.timeSlot,
    isNightMap: state.isNightMap,
    hapticsEnabled: state.hapticsEnabled,
    userSession: state.userSession,
    posts: state.posts,
    edgeRatings: state.edgeRatings,
    reports: state.reports,
    companionMatches: state.companionMatches,
    chatMessages: state.chatMessages,
    activeOriginId: state.activeOriginId,
    activeDestinationId: state.activeDestinationId,
    routeMode: state.routeMode,

    brightestRoute,
    fastestRoute,
    activeRoute,

    completeOnboarding,
    updateLampPostStatus,
    rateEdgeLighting,
    submitReport,
    toggleJoinCompanion,
    sendChatMessage,
    setRouteEndpoints,
    swapEndpoints,
    setRouteMode,
    toggleNightMap,
    setHapticsEnabled,
    resetSessionOnly,
    resetAllDemoData,
  };

  return React.createElement(
    CampusStoreContext.Provider,
    { value: contextValue },
    children
  );
};

export function useCampusStore(): CampusStoreContextType {
  const context = useContext(CampusStoreContext);
  if (!context) {
    throw new Error('useCampusStore must be used within a CampusStoreProvider');
  }
  return context;
}
