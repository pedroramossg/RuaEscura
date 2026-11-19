import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  Route as RouteIcon,
  Share2,
  ShieldCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { BottomSheet, SheetDetent } from '../ui/BottomSheet';
import { SfIcon } from '../ui/SfIcon';
import { CompanionChatView } from './CompanionChatView';
import { DropletMascot } from '../mascot/DropletMascot';
import {
  TrioCharacterAvatar,
  TrioMascotStack,
  pickTrioVariant,
  type TrioVariant,
} from '../mascot/TrioMascotBadge';
import { getRouteMascotMood } from '../../mascot/moods';
import { UFSC_LANDMARKS } from '../../data/ufscTrindade';
import { useCampusStore } from '../../hooks/useCampusStore';
import type {
  ChatMessage,
  CompanionMatch,
  Coordinates,
  RouteMode,
  RouteResult,
} from '../../types/campus';

export interface RouteSheetProps {
  detent: SheetDetent;
  onDetentChange: (detent: SheetDetent) => void;
  isNightMap: boolean;
  activeOriginId: string;
  activeDestinationId: string;
  routeMode: RouteMode;
  brightestRoute: RouteResult;
  fastestRoute: RouteResult;
  activeRoute: RouteResult;
  companionMatches: CompanionMatch[];
  chatMessages: Record<string, ChatMessage[]>;
  activeChatCompanionId: string | null;
  onSelectRouteMode: (mode: RouteMode) => void;
  onToggleJoinCompanion: (companionId: string) => void;
  onOpenChat: (companionId: string) => void;
  onCloseChat: () => void;
  onSendChatMessage: (companionId: string, text: string) => { success: boolean; error?: string };
  onNotify?: (message: string) => void;
}

type CompanionWithMeta = CompanionMatch & {
  womenOnly?: boolean;
  meetingPoint?: string;
  maxSeats?: number;
};

function getVariantForId(id: string): TrioVariant {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return pickTrioVariant(hash);
}

function isValidCoordinate(coord: Coordinates): boolean {
  const [lat, lng] = coord;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function formatCoord(coord: Coordinates): string {
  return `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`;
}

/**
 * Builds strictly validated numeric Google Maps & Apple Maps walking URLs
 * from activeRoute.coordinates, sampling up to 3 intermediate waypoints.
 */
function buildExternalWalkingUrls(
  coordinates: Coordinates[]
): { googleMapsUrl: string; appleMapsUrl: string } | null {
  const valid = coordinates.filter(isValidCoordinate);
  if (valid.length < 2) {
    return null;
  }

  const origin = formatCoord(valid[0]);
  const destination = formatCoord(valid[valid.length - 1]);
  const intermediate = valid.slice(1, -1);

  let sampled: Coordinates[] = [];
  if (intermediate.length <= 3) {
    sampled = intermediate;
  } else {
    const indices = [
      0,
      Math.floor((intermediate.length - 1) / 2),
      intermediate.length - 1,
    ];
    sampled = indices.map((idx) => intermediate[idx]);
  }

  const waypoints = sampled.map(formatCoord).join('|');
  const googleMapsUrl = waypoints
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}&travelmode=walking`
    : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`;

  const appleMapsUrl = `https://maps.apple.com/?saddr=${origin}&daddr=${destination}&dirflg=w`;

  return { googleMapsUrl, appleMapsUrl };
}

/**
 * Single unified BottomSheet for the Map tab (Apple HIG Single-Sheet Rule).
 * Displays route comparison ("Mais Iluminada" vs "Mais Rápida"), walking groups
 * with inline group creation, and transitions in-place to CompanionChatView.
 */
export const RouteSheet: React.FC<RouteSheetProps> = ({
  detent,
  onDetentChange,
  isNightMap,
  activeOriginId,
  activeDestinationId,
  routeMode,
  brightestRoute,
  fastestRoute,
  activeRoute,
  companionMatches,
  chatMessages,
  activeChatCompanionId,
  onSelectRouteMode,
  onToggleJoinCompanion,
  onOpenChat,
  onCloseChat,
  onSendChatMessage,
  onNotify,
}) => {
  const { createWalkingGroup } = useCampusStore();

  const individualPeers = useMemo(
    () => companionMatches.filter((c) => !c.isGroup),
    [companionMatches]
  );

  // Companion filter state (Canvas Bloco 9: Todos | Grupo Feminino)
  const [companionFilter, setCompanionFilter] = useState<'all' | 'womenOnly'>('all');
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Inline group creation state (Apple HIG Single-Sheet Rule: no nested modal)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupOriginId, setGroupOriginId] = useState(activeOriginId);
  const [groupDestId, setGroupDestId] = useState(activeDestinationId);
  const [groupTime, setGroupTime] = useState('21:30');
  const [groupMeetingPoint, setGroupMeetingPoint] = useState('');
  const [groupMaxSeats, setGroupMaxSeats] = useState<number>(4);
  const [groupWomenOnly, setGroupWomenOnly] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() =>
    individualPeers[0] ? [individualPeers[0].id] : []
  );
  const [groupError, setGroupError] = useState<string | null>(null);

  const landmarkShortMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of UFSC_LANDMARKS) {
      map.set(node.id, node.shortName);
    }
    return map;
  }, []);

  const originShort = landmarkShortMap.get(activeOriginId) ?? activeOriginId;
  const destShort = landmarkShortMap.get(activeDestinationId) ?? activeDestinationId;

  const activeChatCompanion = useMemo(
    () => companionMatches.find((c) => c.id === activeChatCompanionId) ?? null,
    [companionMatches, activeChatCompanionId]
  );

  const pathSet = useMemo(() => new Set(activeRoute.path), [activeRoute.path]);

  // Prioritize groups and companions on or intersecting the active route corridor
  const sortedCompanions = useMemo(() => {
    return [...companionMatches].sort((a, b) => {
      const aGroup = a.isGroup ? 2 : 0;
      const bGroup = b.isGroup ? 2 : 0;
      const aMatch = pathSet.has(a.originId) || pathSet.has(a.destinationId) ? 1 : 0;
      const bMatch = pathSet.has(b.originId) || pathSet.has(b.destinationId) ? 1 : 0;
      return bGroup + bMatch - (aGroup + aMatch);
    });
  }, [companionMatches, pathSet]);

  const womenOnlyCount = useMemo(
    () => sortedCompanions.filter((c) => Boolean((c as CompanionWithMeta).womenOnly)).length,
    [sortedCompanions]
  );

  const visibleCompanions = useMemo(() => {
    if (companionFilter === 'womenOnly') {
      return sortedCompanions.filter((c) => Boolean((c as CompanionWithMeta).womenOnly));
    }
    return sortedCompanions;
  }, [companionFilter, sortedCompanions]);

  const routeBreadcrumb = useMemo(() => {
    return activeRoute.path.map((id) => landmarkShortMap.get(id) ?? id).join(' → ');
  }, [activeRoute.path, landmarkShortMap]);

  const externalUrls = useMemo(
    () => buildExternalWalkingUrls(activeRoute.coordinates),
    [activeRoute.coordinates]
  );

  const mutedTextClass = isNightMap ? 'text-[#94A3B8]' : 'text-[#475569]';
  const inputClass = isNightMap
    ? 'bg-[#0B1120] text-[#F8FAFC] border-[#1E293B] placeholder:text-[#64748B] focus:border-[#5EC2F3]'
    : 'bg-[#FFFFFF] text-[#0F172A] border-[#D5E0EE] placeholder:text-[#94A3B8] focus:border-[#2563EB]';

  const routeMood = useMemo(
    () => getRouteMascotMood(activeRoute, originShort, destShort),
    [activeRoute, originShort, destShort]
  );

  const sheetMascotState =
    sortedCompanions.some((c) => c.isUserJoined) && !routeMood.tremble
      ? 'notify'
      : routeMood.state;

  const handleOpenCreateGroup = () => {
    setGroupOriginId(activeOriginId);
    setGroupDestId(activeDestinationId);
    setGroupError(null);
    if (selectedMemberIds.length === 0 && individualPeers[0]) {
      setSelectedMemberIds([individualPeers[0].id]);
    }
    setIsCreatingGroup((prev) => {
      const next = !prev;
      if (next && detent !== 'expanded') {
        onDetentChange('expanded');
      }
      return next;
    });
  };

  const toggleMember = (memberId: string) => {
    setGroupError(null);
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGroupError(null);

    const trimmedMeetingPoint = groupMeetingPoint.trim();
    const groupPayload = {
      title: groupTitle,
      originId: groupOriginId,
      destinationId: groupDestId,
      departureTime: groupTime,
      memberIds: selectedMemberIds,
      ...(trimmedMeetingPoint ? { meetingPoint: trimmedMeetingPoint } : {}),
      womenOnly: groupWomenOnly,
      maxSeats: groupMaxSeats,
    };

    const res = createWalkingGroup(groupPayload);

    if (!res.success || !res.group) {
      setGroupError(res.error ?? 'Não foi possível criar o grupo.');
      return;
    }

    setGroupTitle('');
    setGroupMeetingPoint('');
    setGroupMaxSeats(4);
    setGroupWomenOnly(false);
    setIsCreatingGroup(false);
    onOpenChat(res.group.id);
  };

  const handleCopyInvite = (compId: string, inviteText: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(inviteText).catch(() => {});
    }
    setCopiedInviteId(compId);
    onNotify?.('Convite copiado e pronto para enviar!');
  };

  return (
    <BottomSheet
      detent={detent}
      onDetentChange={onDetentChange}
      dark={isNightMap}
      grabberLabel="Alternar painel de rota e colegas"
    >
      {activeChatCompanion ? (
        <CompanionChatView
          companion={activeChatCompanion}
          messages={chatMessages[activeChatCompanion.id] || []}
          isNightMap={isNightMap}
          onBack={onCloseChat}
          onSendMessage={onSendChatMessage}
          onToggleJoin={onToggleJoinCompanion}
          onNotify={onNotify}
        />
      ) : (
        <div className="space-y-4">
          {/* Summary Header + Live Mascot Reaction */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold tracking-tight truncate">
                  {originShort} → {destShort}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    activeRoute.hasDarkWarning
                      ? isNightMap
                        ? 'bg-[#FF3B30]/20 text-[#FCA5A5]'
                        : 'bg-[#FFF1F2] text-[#D70015]'
                      : isNightMap
                        ? 'bg-[#10B981]/20 text-[#6EE7B7]'
                        : 'bg-[#D1FAE5] text-[#065F46]'
                  }`}
                >
                  {activeRoute.hasDarkWarning ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Trecho escuro</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{activeRoute.illuminationPercentage}% iluminada</span>
                    </>
                  )}
                </span>
              </div>
              <p className={`text-xs mt-0.5 truncate ${mutedTextClass}`}>
                {activeRoute.estimatedMinutes} min a pé • {activeRoute.distanceMeters} m •{' '}
                {routeBreadcrumb}
              </p>
            </div>

            <DropletMascot
              state={sheetMascotState}
              expression={routeMood.expression}
              tremble={routeMood.tremble}
              inkColor={isNightMap && !routeMood.tremble ? '#5EC2F3' : routeMood.inkColor}
              paperColor={isNightMap ? '#0B1120' : '#FFFFFF'}
              notifColor={routeMood.notifColor}
              size={58}
              interactive
              ariaLabel="Status animado da rota"
              className="shrink-0"
            />
          </div>

          {/* Mascot Speech Reaction Bubble */}
          <div
            className={`rounded-2xl px-3.5 py-2 text-xs font-medium border ${
              routeMood.tremble
                ? isNightMap
                  ? 'bg-[#FF3B30]/12 border-[#FF3B30]/35 text-[#FECACA]'
                  : 'bg-[#FFF7ED] border-[#FDBA74] text-[#9A3412]'
                : isNightMap
                  ? 'bg-[#111C34] border-[#1E293B] text-[#E2E8F0]'
                  : 'bg-[#EFF6FF] border-[#DBEAFE] text-[#1E3A8A]'
            }`}
          >
            {routeMood.bubble}
          </div>

          {/* Route Mode Comparison Switcher */}
          <div
            role="group"
            aria-label="Comparação de rotas"
            className="grid grid-cols-2 gap-2.5"
          >
            {/* Mais Iluminada */}
            <button
              type="button"
              onClick={() => onSelectRouteMode('brightest')}
              aria-pressed={routeMode === 'brightest'}
              className={`min-h-[44px] rounded-2xl p-3 text-left border transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                routeMode === 'brightest'
                  ? isNightMap
                    ? 'bg-[#5EC2F3] text-[#0B1120] border-[#5EC2F3] shadow-sm'
                    : 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                  : isNightMap
                    ? 'bg-[#111C34] text-[#F8FAFC] border-[#1E293B] hover:border-[#5EC2F3]/60'
                    : 'bg-[#F8FAFC] text-[#0F172A] border-[#D5E0EE] hover:border-[#2563EB]/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1 text-xs font-semibold">
                  <SfIcon name="sun" filled={routeMode === 'brightest'} size={14} />
                  <span>Mais Iluminada</span>
                </span>
                {brightestRoute.hasDarkWarning && (
                  <AlertTriangle
                    className="w-3.5 h-3.5 text-[#D97706] shrink-0"
                    aria-label="Alerta de trecho escuro"
                  />
                )}
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-lg font-medium">{brightestRoute.estimatedMinutes} min</span>
                <span
                  className={`text-xs ${
                    routeMode === 'brightest'
                      ? isNightMap
                        ? 'text-[#0B1120]/80'
                        : 'text-white/85'
                      : mutedTextClass
                  }`}
                >
                  ({brightestRoute.distanceMeters} m)
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 font-medium ${
                  routeMode === 'brightest'
                    ? isNightMap
                      ? 'text-[#0B1120]'
                      : 'text-[#DBEAFE]'
                    : isNightMap
                      ? 'text-[#34D399]'
                      : 'text-[#059669]'
                }`}
              >
                {brightestRoute.illuminationPercentage}% iluminada
              </p>
            </button>

            {/* Mais Rápida */}
            <button
              type="button"
              onClick={() => onSelectRouteMode('fastest')}
              aria-pressed={routeMode === 'fastest'}
              className={`min-h-[44px] rounded-2xl p-3 text-left border transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                routeMode === 'fastest'
                  ? isNightMap
                    ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                    : 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
                  : isNightMap
                    ? 'bg-[#111C34] text-[#F8FAFC] border-[#1E293B] hover:border-[#5EC2F3]/60'
                    : 'bg-[#F8FAFC] text-[#0F172A] border-[#D5E0EE] hover:border-[#2563EB]/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1 text-xs font-semibold">
                  <RouteIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Mais Rápida</span>
                </span>
                {fastestRoute.hasDarkWarning && (
                  <AlertTriangle
                    className={`w-3.5 h-3.5 shrink-0 ${
                      routeMode === 'fastest' ? 'text-[#FCD34D]' : 'text-[#D70015]'
                    }`}
                    aria-label="Alerta de trecho escuro"
                  />
                )}
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-lg font-medium">{fastestRoute.estimatedMinutes} min</span>
                <span
                  className={`text-xs ${
                    routeMode === 'fastest' ? 'text-white/85' : mutedTextClass
                  }`}
                >
                  ({fastestRoute.distanceMeters} m)
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 font-medium ${
                  fastestRoute.hasDarkWarning
                    ? routeMode === 'fastest'
                      ? 'text-[#FDE68A]'
                      : isNightMap
                        ? 'text-[#FCA5A5]'
                        : 'text-[#D70015]'
                    : routeMode === 'fastest'
                      ? 'text-[#A7F3D0]'
                      : mutedTextClass
                }`}
              >
                {fastestRoute.illuminationPercentage}% iluminada
                {fastestRoute.hasDarkWarning ? ' • Alerta escuro' : ''}
              </p>
            </button>
          </div>

          {/* External Walking Navigation Export (Google Maps & Apple Maps) */}
          {externalUrls && (
            <div
              role="group"
              aria-label="Abrir trajeto em aplicativo de navegação"
              className="grid grid-cols-2 gap-2.5"
            >
              <a
                href={externalUrls.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir rota no Google Maps"
                className={`min-h-[44px] px-3 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 border transition-all active:scale-[0.98] ${
                  isNightMap
                    ? 'bg-[#111C34] text-[#F8FAFC] border-[#1E293B] hover:border-[#5EC2F3]'
                    : 'bg-[#F8FAFC] text-[#0F172A] border-[#D5E0EE] hover:border-[#2563EB]'
                }`}
              >
                <Navigation
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isNightMap ? 'text-[#5EC2F3]' : 'text-[#2563EB]'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">Abrir no Google Maps</span>
              </a>

              <a
                href={externalUrls.appleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir rota no Apple Maps"
                className={`min-h-[44px] px-3 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 border transition-all active:scale-[0.98] ${
                  isNightMap
                    ? 'bg-[#111C34] text-[#F8FAFC] border-[#1E293B] hover:border-[#5EC2F3]'
                    : 'bg-[#F8FAFC] text-[#0F172A] border-[#D5E0EE] hover:border-[#2563EB]'
                }`}
              >
                <ExternalLink
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isNightMap ? 'text-[#34D399]' : 'text-[#059669]'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">Abrir no Apple Maps</span>
              </a>
            </div>
          )}

          {/* Dark Warning Banner when active route passes through dark/burned segments */}
          {activeRoute.hasDarkWarning && (
            <div
              role="note"
              className={`rounded-2xl p-3 border flex items-start gap-2.5 text-xs ${
                isNightMap
                  ? 'bg-[#FF3B30]/15 border-[#FF3B30]/40 text-[#FEE2E2]'
                  : 'bg-[#FFF1F2] border-[#FECDD3] text-[#881337]'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  isNightMap ? 'text-[#FF6B6B]' : 'text-[#D70015]'
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">Trecho escuro ou poste queimado neste trajeto</p>
                <p className={`mt-0.5 ${isNightMap ? 'text-[#FECACA]' : 'text-[#9F1239]'}`}>
                  Considere a rota Mais Iluminada ou caminhe em grupo pelo corredor central.
                </p>
              </div>
            </div>
          )}

          {/* Walking Groups & Campus Companions Section */}
          <div className="pt-1 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <TrioMascotStack size={22} />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate">Colegas e grupos na rota</h3>
                  <p className={`text-[11px] ${mutedTextClass}`}>
                    {sortedCompanions.length} ativos no campus
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateGroup}
                aria-expanded={isCreatingGroup}
                className={`min-h-[44px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 border transition-all active:scale-[0.97] cursor-pointer shrink-0 ${
                  isCreatingGroup
                    ? isNightMap
                      ? 'bg-[#1E293B] text-[#F8FAFC] border-[#334155]'
                      : 'bg-[#F1F5F9] text-[#0F172A] border-[#CBD5E1]'
                    : 'bg-[#2563EB] text-white border-[#2563EB] hover:bg-[#1D4ED8]'
                }`}
              >
                {isCreatingGroup ? (
                  <>
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Cancelar</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Criar grupo</span>
                  </>
                )}
              </button>
            </div>

            {/* Companion Filter Pills: Todos | Grupo Feminino */}
            <div
              role="group"
              aria-label="Filtrar colegas e grupos"
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setCompanionFilter('all')}
                aria-pressed={companionFilter === 'all'}
                className={`min-h-[44px] px-3.5 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer ${
                  companionFilter === 'all'
                    ? isNightMap
                      ? 'bg-[#5EC2F3] text-[#0B1120] border-[#5EC2F3]'
                      : 'bg-[#0F172A] text-white border-[#0F172A]'
                    : isNightMap
                      ? 'bg-[#111C34] text-[#E2E8F0] border-[#1E293B] hover:border-[#5EC2F3]/60'
                      : 'bg-[#F8FAFC] text-[#0F172A] border-[#D5E0EE] hover:border-[#2563EB]/60'
                }`}
              >
                <span>Todos</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                    companionFilter === 'all'
                      ? isNightMap
                        ? 'bg-[#0B1120]/15 text-[#0B1120]'
                        : 'bg-white/20 text-white'
                      : isNightMap
                        ? 'bg-white/10 text-[#CBD5E1]'
                        : 'bg-[#E2E8F0] text-[#334155]'
                  }`}
                >
                  {sortedCompanions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCompanionFilter('womenOnly')}
                aria-pressed={companionFilter === 'womenOnly'}
                className={`min-h-[44px] px-3.5 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer ${
                  companionFilter === 'womenOnly'
                    ? isNightMap
                      ? 'bg-[#EC4899] text-white border-[#EC4899]'
                      : 'bg-[#BE185D] text-white border-[#BE185D]'
                    : isNightMap
                      ? 'bg-[#111C34] text-[#FBCFE8] border-[#1E293B] hover:border-[#F472B6]/60'
                      : 'bg-[#FDF2F8] text-[#9D174D] border-[#FBCFE8] hover:border-[#DB2777]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Grupo Feminino</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                    companionFilter === 'womenOnly'
                      ? 'bg-white/20 text-white'
                      : isNightMap
                        ? 'bg-[#EC4899]/25 text-[#F9A8D4]'
                        : 'bg-[#FCE7F3] text-[#9D174D]'
                  }`}
                >
                  {womenOnlyCount}
                </span>
              </button>
            </div>

            {/* Inline Group Creation Panel (no nested sheet/modal) */}
            {isCreatingGroup && (
              <form
                onSubmit={handleCreateGroupSubmit}
                noValidate
                className={`rounded-2xl p-3.5 border space-y-3 ${
                  isNightMap
                    ? 'bg-[#111C34] border-[#334155]'
                    : 'bg-[#F8FAFC] border-[#D5E0EE]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold inline-flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />
                    <span>Novo grupo de caminhada</span>
                  </span>
                  <span className={`text-[11px] ${mutedTextClass}`}>
                    Abre o chat ao criar
                  </span>
                </div>

                <div>
                  <label htmlFor="group-title-input" className="sr-only">
                    Nome do grupo
                  </label>
                  <input
                    id="group-title-input"
                    type="text"
                    value={groupTitle}
                    onChange={(e) => {
                      setGroupTitle(e.target.value);
                      if (groupError) setGroupError(null);
                    }}
                    placeholder="Ex: Volta CTC → Terminal"
                    aria-label="Nome do grupo"
                    className={`w-full min-h-[44px] px-3.5 rounded-xl border text-sm outline-none transition-colors ${inputClass}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="group-origin-select"
                      className={`block text-[11px] font-medium mb-1 ${mutedTextClass}`}
                    >
                      Saída
                    </label>
                    <select
                      id="group-origin-select"
                      value={groupOriginId}
                      onChange={(e) => setGroupOriginId(e.target.value)}
                      aria-label="Origem do grupo"
                      className={`w-full min-h-[44px] px-2.5 rounded-xl border text-xs font-medium outline-none ${inputClass}`}
                    >
                      {UFSC_LANDMARKS.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.shortName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="group-dest-select"
                      className={`block text-[11px] font-medium mb-1 ${mutedTextClass}`}
                    >
                      Destino
                    </label>
                    <select
                      id="group-dest-select"
                      value={groupDestId}
                      onChange={(e) => setGroupDestId(e.target.value)}
                      aria-label="Destino do grupo"
                      className={`w-full min-h-[44px] px-2.5 rounded-xl border text-xs font-medium outline-none ${inputClass}`}
                    >
                      {UFSC_LANDMARKS.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.shortName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="group-time-input"
                    className={`block text-[11px] font-medium mb-1 ${mutedTextClass}`}
                  >
                    Horário de saída
                  </label>
                  <input
                    id="group-time-input"
                    type="time"
                    value={groupTime}
                    onChange={(e) => {
                      setGroupTime(e.target.value);
                      if (groupError) setGroupError(null);
                    }}
                    aria-label="Horário de saída"
                    className={`w-full min-h-[44px] px-3 rounded-xl border text-sm outline-none ${inputClass}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="group-meeting-point-input"
                    className={`block text-[11px] font-medium mb-1 ${mutedTextClass}`}
                  >
                    Ponto de encontro
                  </label>
                  <input
                    id="group-meeting-point-input"
                    type="text"
                    maxLength={80}
                    value={groupMeetingPoint}
                    onChange={(e) => {
                      setGroupMeetingPoint(e.target.value);
                      if (groupError) setGroupError(null);
                    }}
                    placeholder="Ex: Catraca principal da BU"
                    aria-label="Ponto de encontro"
                    className={`w-full min-h-[44px] px-3.5 rounded-xl border text-sm outline-none transition-colors ${inputClass}`}
                  />
                </div>

                <div className="space-y-2">
                  <div>
                    <p className={`text-[11px] font-medium mb-1 ${mutedTextClass}`}>
                      Vagas no grupo
                    </p>
                    <div
                      role="group"
                      aria-label="Vagas no grupo"
                      className="grid grid-cols-4 gap-1.5"
                    >
                      {[3, 4, 5, 6].map((seats) => {
                        const active = groupMaxSeats === seats;
                        return (
                          <button
                            key={seats}
                            type="button"
                            onClick={() => setGroupMaxSeats(seats)}
                            aria-pressed={active}
                            className={`min-h-[44px] rounded-xl text-xs font-semibold border transition-all active:scale-[0.97] cursor-pointer ${
                              active
                                ? 'bg-[#2563EB] text-white border-[#2563EB]'
                                : isNightMap
                                  ? 'bg-[#0B1120] text-[#E2E8F0] border-[#1E293B] hover:border-[#5EC2F3]'
                                  : 'bg-[#FFFFFF] text-[#0F172A] border-[#D5E0EE] hover:border-[#2563EB]'
                            }`}
                          >
                            {seats} vagas
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGroupWomenOnly((prev) => !prev)}
                    aria-pressed={groupWomenOnly}
                    className={`w-full min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-between gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                      groupWomenOnly
                        ? isNightMap
                          ? 'bg-[#EC4899]/20 text-[#FBCFE8] border-[#EC4899]/60'
                          : 'bg-[#FDF2F8] text-[#9D174D] border-[#F472B6]'
                        : isNightMap
                          ? 'bg-[#0B1120] text-[#E2E8F0] border-[#1E293B] hover:border-[#F472B6]/50'
                          : 'bg-[#FFFFFF] text-[#0F172A] border-[#D5E0EE] hover:border-[#DB2777]/50'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck
                        className={`w-4 h-4 shrink-0 ${
                          groupWomenOnly
                            ? isNightMap
                              ? 'text-[#F472B6]'
                              : 'text-[#BE185D]'
                            : mutedTextClass
                        }`}
                        aria-hidden="true"
                      />
                      <span>Grupo feminino verificado</span>
                    </span>
                    <span className="text-[11px] font-bold">
                      {groupWomenOnly ? 'Ativo' : 'Opcional'}
                    </span>
                  </button>
                </div>

                <div>
                  <p className={`text-[11px] font-medium mb-1.5 ${mutedTextClass}`}>
                    Convidar colegas ({selectedMemberIds.length} selecionado
                    {selectedMemberIds.length === 1 ? '' : 's'})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {individualPeers.map((peer, idx) => {
                      const selected = selectedMemberIds.includes(peer.id);
                      return (
                        <button
                          key={peer.id}
                          type="button"
                          onClick={() => toggleMember(peer.id)}
                          aria-pressed={selected}
                          className={`min-h-[44px] px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 border transition-all active:scale-[0.97] cursor-pointer ${
                            selected
                              ? 'bg-[#2563EB] text-white border-[#2563EB]'
                              : isNightMap
                                ? 'bg-[#0B1120] text-[#E2E8F0] border-[#1E293B] hover:border-[#5EC2F3]'
                                : 'bg-[#FFFFFF] text-[#0F172A] border-[#D5E0EE] hover:border-[#2563EB]'
                          }`}
                        >
                          <TrioCharacterAvatar
                            variant={pickTrioVariant(idx)}
                            size={20}
                          />
                          <span>{peer.name.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {groupError && (
                  <p
                    role="alert"
                    className={`text-xs font-medium ${
                      isNightMap ? 'text-[#FF6B6B]' : 'text-[#D70015]'
                    }`}
                  >
                    {groupError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full min-h-[44px] px-4 rounded-full bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] active:scale-[0.98] transition-all cursor-pointer"
                >
                  Criar e abrir chat
                </button>
              </form>
            )}

            {visibleCompanions.length === 0 ? (
              <div
                className={`rounded-2xl p-4 border text-xs text-center ${
                  isNightMap
                    ? 'bg-[#111C34] border-white/10 text-[#94A3B8]'
                    : 'bg-[#F8FAFC] border-[var(--separator)] text-[#475569]'
                }`}
              >
                Nenhum grupo feminino ativo no momento. Use &ldquo;Criar grupo&rdquo; acima para organizar uma caminhada segura.
              </div>
            ) : (
              <ul
                className={`rounded-2xl overflow-hidden divide-y ${
                  isNightMap
                    ? 'bg-[#111C34] divide-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'bg-[#F8FAFC] divide-[var(--separator)] shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.65)]'
                }`}
              >
                {visibleCompanions.map((comp) => {
                  const compMeta = comp as CompanionWithMeta;
                  const onCorridor =
                    pathSet.has(comp.originId) || pathSet.has(comp.destinationId);
                  const compOrigin = landmarkShortMap.get(comp.originId) ?? comp.originId;
                  const compDest =
                    landmarkShortMap.get(comp.destinationId) ?? comp.destinationId;
                  const members = comp.isGroup && comp.members ? comp.members : [];
                  const title = comp.groupTitle || comp.name;
                  const occupiedSeats = comp.isGroup
                    ? members.length + (comp.isUserJoined ? 1 : 0)
                    : comp.isUserJoined
                      ? 2
                      : 1;
                  const inviteLines = [
                    `RuaEscura UFSC • ${title}`,
                    `Trajeto: ${compOrigin} → ${compDest} às ${comp.departureTime}`,
                    compMeta.meetingPoint ? `Encontro: ${compMeta.meetingPoint}` : null,
                    compMeta.womenOnly ? 'Grupo feminino verificado' : null,
                  ]
                    .filter(Boolean)
                    .join(' • ');
                  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(inviteLines)}`;

                  return (
                    <li
                      key={comp.id}
                      className="p-3.5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {members.length > 0 ? (
                            <span
                              className="inline-flex items-center -space-x-2 shrink-0 pt-0.5"
                              aria-hidden="true"
                            >
                              {members.slice(0, 3).map((member, idx) => (
                                <TrioCharacterAvatar
                                  key={member.id}
                                  variant={member.mascotVariant}
                                  size={30}
                                  className={idx === 1 ? 'z-10' : ''}
                                />
                              ))}
                            </span>
                          ) : (
                            <TrioCharacterAvatar
                              variant={getVariantForId(comp.id)}
                              size={40}
                              className="shrink-0"
                            />
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold truncate">{title}</span>
                              {compMeta.womenOnly && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    isNightMap
                                      ? 'bg-[#EC4899]/20 text-[#F9A8D4] border border-[#EC4899]/35'
                                      : 'bg-[#FDF2F8] text-[#BE185D] border border-[#FBCFE8]'
                                  }`}
                                >
                                  <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                                  <span>Grupo feminino</span>
                                </span>
                              )}
                              {comp.isGroup && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                    isNightMap
                                      ? 'bg-[#5EC2F3]/15 text-[#5EC2F3]'
                                      : 'bg-[#EFF6FF] text-[#2563EB]'
                                  }`}
                                >
                                  <Users className="w-3 h-3" aria-hidden="true" />
                                  <span>{members.length + 1} no grupo</span>
                                </span>
                              )}
                              {typeof compMeta.maxSeats === 'number' && (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums ${
                                    isNightMap
                                      ? 'bg-white/10 text-[#E2E8F0]'
                                      : 'bg-[#E2E8F0]/70 text-[#334155]'
                                  }`}
                                >
                                  {occupiedSeats}/{compMeta.maxSeats} vagas
                                </span>
                              )}
                              {onCorridor && (
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                    isNightMap
                                      ? 'bg-white/10 text-[#F8FAFC]'
                                      : 'bg-[#F8FAFC] text-[#0F172A] border border-[#D5E0EE]'
                                  }`}
                                >
                                  No seu corredor
                                </span>
                              )}
                            </div>

                            <p className={`text-xs truncate mt-0.5 ${mutedTextClass}`}>
                              {comp.isGroup && members.length > 0
                                ? `Com ${members.map((m) => m.name.split(' ')[0]).join(', ')}`
                                : comp.ufscAffiliation}
                            </p>

                            <p className={`text-xs mt-1 font-medium ${mutedTextClass}`}>
                              {compOrigin} → {compDest} •{' '}
                              <Clock className="inline w-3 h-3 -mt-0.5" aria-hidden="true" />{' '}
                              {comp.departureTime}
                            </p>

                            {compMeta.meetingPoint && (
                              <p className={`text-xs mt-0.5 truncate ${mutedTextClass}`}>
                                <MapPin className="inline w-3 h-3 -mt-0.5 mr-1" aria-hidden="true" />
                                Encontro: {compMeta.meetingPoint}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleJoinCompanion(comp.id)}
                          aria-pressed={Boolean(comp.isUserJoined)}
                          className={`flex-1 min-w-[116px] min-h-[44px] px-3 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 border transition-all active:scale-[0.97] cursor-pointer ${
                            comp.isUserJoined
                              ? 'bg-[#2563EB] text-white border-[#2563EB]'
                              : isNightMap
                                ? 'bg-[#0B1120] text-[#F8FAFC] border-[#1E293B] hover:border-[#5EC2F3]'
                                : 'bg-white text-[#0F172A] border-[#D5E0EE] hover:border-[#2563EB]'
                          }`}
                        >
                          {comp.isUserJoined && (
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>{comp.isUserJoined ? 'No grupo' : 'Entrar no grupo'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenChat(comp.id)}
                          className={`flex-1 min-w-[126px] min-h-[44px] px-3 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer ${
                            isNightMap
                              ? 'bg-[#F8FAFC] text-[#0B1120] hover:bg-white'
                              : 'bg-[#0F172A] text-white hover:bg-[#1E293B]'
                          }`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Combinar trajeto</span>
                        </button>

                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleCopyInvite(comp.id, inviteLines)}
                          aria-label={`Compartilhar no WhatsApp convite de ${title}`}
                          className={`min-h-[44px] px-3 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 border transition-all active:scale-[0.97] shrink-0 ${
                            copiedInviteId === comp.id
                              ? isNightMap
                                ? 'bg-[#10B981]/20 text-[#6EE7B7] border-[#10B981]/45'
                                : 'bg-[#D1FAE5] text-[#065F46] border-[#10B981]/40'
                              : isNightMap
                                ? 'bg-[#0B1120] text-[#E2E8F0] border-[#1E293B] hover:border-[#5EC2F3]'
                                : 'bg-white text-[#0F172A] border-[#D5E0EE] hover:border-[#2563EB]'
                          }`}
                        >
                          <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{copiedInviteId === comp.id ? 'Copiado' : 'Convidar'}</span>
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
};
