import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type {
  PersistedCampusState,
  LampPost,
  LampPostStatus,
  EdgeRatingSummary,
  IncidentReport,
  CompanionMatch,
  GroupMember,
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
  ScheduledDepartureSchema,
  WalkingGroupCreationSchema,
  CompanionMatchSchema,
} from '../security/schemas';
import {
  canUseWomenOnlyGroups,
  isMemberEligibleForWomenOnly,
} from '../security/genderGuard';
import { pickTrioVariant } from '../components/mascot/TrioMascotBadge';
import { useHaptics } from './useHaptics';

const SYNC_CHANNEL_NAME = 'rua-escura-campus-sync';
const LANDMARK_LABEL_BY_ID = new Map(UFSC_LANDMARKS.map((l) => [l.id, l.shortName]));

function createMessageId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildContextualReply(
  userText: string,
  responderName: string,
  routeLabel: string
): string {
  const lower = userText.toLowerCase();
  const firstName = responderName.split(' ')[0] || 'Colega';
  if (lower.includes('saio') || lower.includes('min') || lower.includes('cheg')) {
    return `Fechado! Já estou saindo também — te encontro em poucos minutos no trajeto (${routeLabel}).`;
  }
  if (lower.includes('bu') || lower.includes('entrada') || lower.includes('ru') || lower.includes('ctc')) {
    return `Combinado! Passo ali na entrada combinada seguindo por ${routeLabel}. Estou de mochila escura.`;
  }
  if (lower.includes('escuro') || lower.includes('poste') || lower.includes('luz')) {
    return `Boa, vamos pela via mais iluminada mesmo. Se vermos poste apagado já registramos no app.`;
  }
  if (lower.includes('?') || lower.includes('vamos') || lower.includes('bora') || lower.includes('oi')) {
    return `Bora sim! Aqui é ${firstName}, já deixei a rota ${routeLabel} aberta pra irmos juntos.`;
  }
  return `Recebido! Seguindo juntos por ${routeLabel} fica bem mais tranquilo.`;
}

export interface CreateWalkingGroupInput {
  title: string;
  originId: string;
  destinationId: string;
  departureTime: string;
  memberIds: string[];
  meetingPoint?: string;
  womenOnly?: boolean;
  maxSeats?: number;
}

export interface CampusStoreContextType {
  // State
  version: number;
  onboardingCompleted: boolean;
  selectedBuildings: string[];
  timeSlot: string;
  isNightMap: boolean;
  darkMode: boolean;
  hapticsEnabled: boolean;
  userSession: GovBrSession | null;
  posts: LampPost[];
  edgeRatings: Record<string, EdgeRatingSummary>;
  reports: IncidentReport[];
  companionMatches: CompanionMatch[];
  chatMessages: Record<string, ChatMessage[]>;
  typingByChannel: Record<string, string[]>;
  readByChannel: Record<string, Record<string, string>>;
  activeOriginId: string;
  activeDestinationId: string;
  routeMode: RouteMode;
  scheduledDeparture?: {
    time: string;
    updatedAt: string;
  };

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
  updateLampPostStatus: (
    postId: string,
    status: LampPostStatus,
    burnReason?: LampPost['burnReason']
  ) => void;
  rateEdgeLighting: (edgeId: string, rating: number) => { success: boolean; error?: string };
  submitReport: (input: {
    category: ReportCategory;
    location: string;
    description: string;
    isConfidential?: boolean;
    photoThumbnailUrl?: string;
  }) => { success: boolean; error?: string; report?: IncidentReport };
  toggleJoinCompanion: (companionId: string) => void;
  createWalkingGroup: (
    input: CreateWalkingGroupInput
  ) => { success: boolean; error?: string; group?: CompanionMatch };
  sendChatMessage: (companionId: string, text: string) => { success: boolean; error?: string };
  reactToChatMessage: (channelId: string, messageId: string, emoji: string) => void;
  sendArrivalCheckIn: (channelId: string) => void;
  setRouteEndpoints: (originId: string, destinationId: string) => void;
  swapEndpoints: () => void;
  setRouteMode: (mode: RouteMode) => void;
  scheduleDeparture: (time: string) => { success: boolean; error?: string };
  toggleNightMap: () => void;
  toggleDarkMode: () => void;
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
  const [typingByChannel, setTypingByChannel] = useState<Record<string, string[]>>({});
  const [readByChannel, setReadByChannel] = useState<Record<string, Record<string, string>>>({});
  const stateRef = useRef(state);
  stateRef.current = state;

  const haptics = useHaptics();
  const tabIdRef = useRef(createMessageId());
  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  const timersRef = useRef<number[]>([]);

  const broadcastSync = useCallback(
    (
      message:
        | { type: 'chat-message'; companionId: string; chatMessage: ChatMessage }
        | { type: 'group-created'; group: CompanionMatch; initialMessages: ChatMessage[] }
        | { type: 'chat-reaction'; channelId: string; messageId: string; emoji: string; reactorId: string }
    ) => {
      try {
        syncChannelRef.current?.postMessage({ ...message, tabId: tabIdRef.current });
      } catch {
        // Channel may be closed in test teardown
      }
    },
    []
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'rua_escura_campus_state_v1' && event.newValue && !initialState) {
        setState(loadCampusState());
      }
    };
    window.addEventListener('storage', onStorage);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      syncChannelRef.current = channel;
      channel.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || typeof data !== 'object' || data.tabId === tabIdRef.current) return;

        if (data.type === 'chat-message' && typeof data.companionId === 'string' && data.chatMessage) {
          const parsed = ChatMessageSchema.safeParse(data.chatMessage);
          if (!parsed.success) return;
          const incoming = data.chatMessage as ChatMessage;
          setState((prev) => {
            const existing = prev.chatMessages[data.companionId] || [];
            if (existing.some((m) => m.id === incoming.id)) return prev;
            const next = {
              ...prev,
              chatMessages: {
                ...prev.chatMessages,
                [data.companionId]: [...existing, incoming],
              },
            };
            if (!initialState) saveCampusState(next);
            return next;
          });
        } else if (data.type === 'group-created' && data.group) {
          const parsedGroup = CompanionMatchSchema.safeParse(data.group);
          if (!parsedGroup.success) return;
          const incomingGroup = parsedGroup.data;
          const initialMsgs = Array.isArray(data.initialMessages)
            ? (data.initialMessages as ChatMessage[])
            : [];
          setState((prev) => {
            if (prev.companionMatches.some((g) => g.id === incomingGroup.id)) return prev;
            const next = {
              ...prev,
              companionMatches: [incomingGroup, ...prev.companionMatches],
              chatMessages: {
                ...prev.chatMessages,
                [incomingGroup.id]: initialMsgs,
              },
            };
            if (!initialState) saveCampusState(next);
            return next;
          });
        } else if (
          data.type === 'chat-reaction' &&
          typeof data.channelId === 'string' &&
          typeof data.messageId === 'string' &&
          typeof data.emoji === 'string' &&
          typeof data.reactorId === 'string'
        ) {
          setState((prev) => {
            const list = prev.chatMessages[data.channelId];
            if (!list) return prev;
            const updated = list.map((msg) => {
              if (msg.id !== data.messageId) return msg;
              const currentReactions = msg.reactions ?? {};
              const users = currentReactions[data.emoji] ?? [];
              const nextUsers = users.includes(data.reactorId)
                ? users.filter((id) => id !== data.reactorId)
                : [...users, data.reactorId];
              const nextReactions = { ...currentReactions };
              if (nextUsers.length === 0) {
                delete nextReactions[data.emoji];
              } else {
                nextReactions[data.emoji] = nextUsers;
              }
              return { ...msg, reactions: nextReactions };
            });
            const next = {
              ...prev,
              chatMessages: {
                ...prev.chatMessages,
                [data.channelId]: updated,
              },
            };
            if (!initialState) saveCampusState(next);
            return next;
          });
        }
      };
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
      syncChannelRef.current = null;
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [initialState]);

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
    (postId: string, status: LampPostStatus, burnReason?: LampPost['burnReason']) => {
      updateState((prev) => ({
        ...prev,
        posts: prev.posts.map((post) => {
          if (post.id !== postId) return post;
          const nextBurnReason =
            status === 'queimado' ? burnReason ?? post.burnReason : undefined;
          return {
            ...post,
            status,
            burnReason: nextBurnReason,
            lastUpdated: new Date().toISOString(),
          };
        }),
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
      const target = stateRef.current.companionMatches.find((c) => c.id === companionId);
      if (target?.womenOnly && !canUseWomenOnlyGroups(stateRef.current.userSession)) {
        haptics.trigger('error');
        return;
      }

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

  const createWalkingGroup = useCallback(
    (
      input: CreateWalkingGroupInput
    ): { success: boolean; error?: string; group?: CompanionMatch } => {
      const validation = WalkingGroupCreationSchema.safeParse(input);
      if (!validation.success) {
        haptics.trigger('error');
        return {
          success: false,
          error: validation.error.errors[0]?.message ?? 'Dados do grupo inválidos',
        };
      }

      const {
        title,
        originId,
        destinationId,
        departureTime,
        memberIds,
        meetingPoint,
        womenOnly,
        maxSeats,
      } = validation.data;

      if (womenOnly && !canUseWomenOnlyGroups(stateRef.current.userSession)) {
        haptics.trigger('error');
        return {
          success: false,
          error:
            'A criação de grupos exclusivos para mulheres é restrita a contas femininas verificadas pelo e-mail @ufsc.br.',
        };
      }

      const originLabel = LANDMARK_LABEL_BY_ID.get(originId) ?? originId.toUpperCase();
      const destLabel = LANDMARK_LABEL_BY_ID.get(destinationId) ?? destinationId.toUpperCase();
      const routeLabel = `${originLabel} → ${destLabel}`;

      const rawPeers = stateRef.current.companionMatches.filter((c) => !c.isGroup);
      const eligiblePool = womenOnly ? rawPeers.filter(isMemberEligibleForWomenOnly) : rawPeers;
      const selectedPeers = eligiblePool.filter((c) => memberIds.includes(c.id));
      const fallbackPeer = eligiblePool[0];
      const finalPeers = selectedPeers.length > 0 ? selectedPeers : fallbackPeer ? [fallbackPeer] : [];

      if (womenOnly && finalPeers.length === 0) {
        haptics.trigger('error');
        return {
          success: false,
          error: 'Nenhuma colega elegível encontrada para o grupo feminino.',
        };
      }

      const members: GroupMember[] = finalPeers.map((peer, index) => ({
        id: peer.id,
        name: peer.name,
        initials: peer.initials,
        mascotVariant: pickTrioVariant(index),
      }));

      const groupId = `grp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const currentUserName = stateRef.current.userSession?.name ?? 'Você';
      const cleanedMeetingPoint = meetingPoint?.trim() || undefined;
      const newGroup: CompanionMatch = {
        id: groupId,
        name: members.map((m) => m.name.split(' ')[0]).join(', ') || currentUserName,
        initials: title.slice(0, 2).toUpperCase(),
        ufscAffiliation: `${members.length + 1} colegas • ${routeLabel}`,
        isGovBrVerified: true,
        originId,
        destinationId,
        departureTime,
        currentStatus: 'aguardando',
        isUserJoined: true,
        isGroup: true,
        groupTitle: title,
        members,
        ...(cleanedMeetingPoint ? { meetingPoint: cleanedMeetingPoint } : {}),
        ...(womenOnly ? { womenOnly: true } : {}),
        ...(maxSeats ? { maxSeats } : {}),
      };

      const welcomeResponder = members[0];
      const welcomeMessages: ChatMessage[] = [
        {
          id: createMessageId(),
          senderId: 'system',
          senderName: 'Grupo criado',
          text: `${currentUserName} criou o grupo "${title}" (${routeLabel} • saída ${departureTime}).`,
          timestamp: new Date().toISOString(),
          isSystem: true,
        },
        ...(welcomeResponder
          ? [
              {
                id: createMessageId(),
                senderId: welcomeResponder.id,
                senderName: welcomeResponder.name,
                text: `Oi pessoal! Confirmado para ${departureTime} no trajeto ${routeLabel}.`,
                timestamp: new Date().toISOString(),
              },
            ]
          : []),
      ];

      updateState((prev) => ({
        ...prev,
        companionMatches: [newGroup, ...prev.companionMatches],
        chatMessages: {
          ...prev.chatMessages,
          [groupId]: welcomeMessages,
        },
      }));

      broadcastSync({
        type: 'group-created',
        group: newGroup,
        initialMessages: welcomeMessages,
      });

      haptics.trigger('success');
      return { success: true, group: newGroup };
    },
    [updateState, broadcastSync, haptics]
  );

  const sendChatMessage = useCallback(
    (companionId: string, text: string): { success: boolean; error?: string } => {
      const senderId = stateRef.current.userSession ? 'user-current' : 'demo-user';
      const senderName = stateRef.current.userSession?.name ?? 'Você';

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

      const newMsg: ChatMessage = {
        id: createMessageId(),
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

      broadcastSync({
        type: 'chat-message',
        companionId,
        chatMessage: newMsg,
      });

      // Bidirectional peer / group member reply simulation with typing dots + read receipt
      const channelEntity = stateRef.current.companionMatches.find((c) => c.id === companionId);
      if (channelEntity) {
        const pool =
          channelEntity.members && channelEntity.members.length > 0
            ? channelEntity.members.map((m) => ({ id: m.id, name: m.name }))
            : [{ id: channelEntity.id, name: channelEntity.name }];
        const existingCount = (stateRef.current.chatMessages[companionId] || []).length;
        const responder = pool[existingCount % pool.length] ?? pool[0];

        if (responder) {
          setTypingByChannel((prev) => ({
            ...prev,
            [companionId]: [responder.id],
          }));

          const channelRouteLabel = `${LANDMARK_LABEL_BY_ID.get(channelEntity.originId) ?? channelEntity.originId.toUpperCase()} → ${LANDMARK_LABEL_BY_ID.get(channelEntity.destinationId) ?? channelEntity.destinationId.toUpperCase()}`;

          const timerId = window.setTimeout(() => {
            const replyMsg: ChatMessage = {
              id: createMessageId(),
              senderId: responder.id,
              senderName: responder.name,
              text: buildContextualReply(
                validation.data.text,
                responder.name,
                channelRouteLabel
              ),
              timestamp: new Date().toISOString(),
            };

            updateState((prev) => ({
              ...prev,
              chatMessages: {
                ...prev.chatMessages,
                [companionId]: [...(prev.chatMessages[companionId] || []), replyMsg],
              },
            }));

            setTypingByChannel((prev) => ({
              ...prev,
              [companionId]: [],
            }));

            setReadByChannel((prev) => ({
              ...prev,
              [companionId]: {
                ...(prev[companionId] || {}),
                [responder.id]: newMsg.id,
              },
            }));

            broadcastSync({
              type: 'chat-message',
              companionId,
              chatMessage: replyMsg,
            });
          }, 550);

          timersRef.current.push(timerId);
        }
      }

      haptics.trigger('light');
      return { success: true };
    },
    [updateState, broadcastSync, haptics]
  );

  const reactToChatMessage = useCallback(
    (channelId: string, messageId: string, emoji: string) => {
      const reactorId = stateRef.current.userSession ? 'user-current' : 'demo-user';
      updateState((prev) => {
        const list = prev.chatMessages[channelId];
        if (!list) return prev;
        const updated = list.map((msg) => {
          if (msg.id !== messageId) return msg;
          const currentReactions = msg.reactions ?? {};
          const users = currentReactions[emoji] ?? [];
          const nextUsers = users.includes(reactorId)
            ? users.filter((id) => id !== reactorId)
            : [...users, reactorId];
          const nextReactions = { ...currentReactions };
          if (nextUsers.length === 0) {
            delete nextReactions[emoji];
          } else {
            nextReactions[emoji] = nextUsers;
          }
          return { ...msg, reactions: nextReactions };
        });
        return {
          ...prev,
          chatMessages: {
            ...prev.chatMessages,
            [channelId]: updated,
          },
        };
      });
      broadcastSync({
        type: 'chat-reaction',
        channelId,
        messageId,
        emoji,
        reactorId,
      });
      haptics.trigger('selection');
    },
    [updateState, broadcastSync, haptics]
  );

  const sendArrivalCheckIn = useCallback(
    (channelId: string) => {
      const senderName = stateRef.current.userSession?.name ?? 'Você';
      const checkInMsg: ChatMessage = {
        id: createMessageId(),
        senderId: 'system',
        senderName,
        text: `${senderName}: Cheguei bem ao destino pelo trajeto iluminado ✓`,
        timestamp: new Date().toISOString(),
        isSystem: true,
      };

      updateState((prev) => ({
        ...prev,
        chatMessages: {
          ...prev.chatMessages,
          [channelId]: [...(prev.chatMessages[channelId] || []), checkInMsg],
        },
      }));

      broadcastSync({
        type: 'chat-message',
        companionId: channelId,
        chatMessage: checkInMsg,
      });
      haptics.trigger('success');
    },
    [updateState, broadcastSync, haptics]
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

  const toggleDarkMode = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      darkMode: !(prev.darkMode ?? false),
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

  const scheduleDeparture = useCallback(
    (time: string): { success: boolean; error?: string } => {
      const updatedAt = new Date().toISOString();
      const validation = ScheduledDepartureSchema.safeParse({ time, updatedAt });
      if (!validation.success) {
        haptics.trigger('error');
        return {
          success: false,
          error: validation.error.errors[0]?.message ?? 'Horário inválido',
        };
      }
      updateState((prev) => ({
        ...prev,
        scheduledDeparture: validation.data,
      }));
      haptics.trigger('success');
      return { success: true };
    },
    [updateState, haptics]
  );

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
    darkMode: state.darkMode ?? false,
    hapticsEnabled: state.hapticsEnabled,
    userSession: state.userSession,
    posts: state.posts,
    edgeRatings: state.edgeRatings,
    reports: state.reports,
    companionMatches: state.companionMatches,
    chatMessages: state.chatMessages,
    typingByChannel,
    readByChannel,
    activeOriginId: state.activeOriginId,
    activeDestinationId: state.activeDestinationId,
    routeMode: state.routeMode,
    scheduledDeparture: state.scheduledDeparture,

    brightestRoute,
    fastestRoute,
    activeRoute,

    completeOnboarding,
    updateLampPostStatus,
    rateEdgeLighting,
    submitReport,
    toggleJoinCompanion,
    createWalkingGroup,
    sendChatMessage,
    reactToChatMessage,
    sendArrivalCheckIn,
    setRouteEndpoints,
    swapEndpoints,
    setRouteMode,
    scheduleDeparture,
    toggleNightMap,
    toggleDarkMode,
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
