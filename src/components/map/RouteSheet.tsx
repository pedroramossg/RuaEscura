import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageCircle,
  Plus,
  Route as RouteIcon,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { BottomSheet, SheetDetent } from '../ui/BottomSheet';
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
}

function getVariantForId(id: string): TrioVariant {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return pickTrioVariant(hash);
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
}) => {
  const { createWalkingGroup } = useCampusStore();

  const individualPeers = useMemo(
    () => companionMatches.filter((c) => !c.isGroup),
    [companionMatches]
  );

  // Inline group creation state (Apple HIG Single-Sheet Rule: no nested modal)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupOriginId, setGroupOriginId] = useState(activeOriginId);
  const [groupDestId, setGroupDestId] = useState(activeDestinationId);
  const [groupTime, setGroupTime] = useState('21:30');
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

  const routeBreadcrumb = useMemo(() => {
    return activeRoute.path.map((id) => landmarkShortMap.get(id) ?? id).join(' → ');
  }, [activeRoute.path, landmarkShortMap]);

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

    const res = createWalkingGroup({
      title: groupTitle,
      originId: groupOriginId,
      destinationId: groupDestId,
      departureTime: groupTime,
      memberIds: selectedMemberIds,
    });

    if (!res.success || !res.group) {
      setGroupError(res.error ?? 'Não foi possível criar o grupo.');
      return;
    }

    setGroupTitle('');
    setIsCreatingGroup(false);
    onOpenChat(res.group.id);
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
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
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

            <ul
              className={`rounded-2xl overflow-hidden divide-y ${
                isNightMap
                  ? 'bg-[#111C34] divide-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'bg-[#F8FAFC] divide-[var(--separator)] shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.65)]'
              }`}
            >
              {sortedCompanions.map((comp) => {
                const onCorridor =
                  pathSet.has(comp.originId) || pathSet.has(comp.destinationId);
                const compOrigin = landmarkShortMap.get(comp.originId) ?? comp.originId;
                const compDest =
                  landmarkShortMap.get(comp.destinationId) ?? comp.destinationId;
                const members = comp.isGroup && comp.members ? comp.members : [];
                const title = comp.groupTitle || comp.name;

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
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleJoinCompanion(comp.id)}
                        aria-pressed={Boolean(comp.isUserJoined)}
                        className={`flex-1 min-h-[44px] px-3 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 border transition-all active:scale-[0.97] cursor-pointer ${
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
                        className={`flex-1 min-h-[44px] px-3 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer ${
                          isNightMap
                            ? 'bg-[#F8FAFC] text-[#0B1120] hover:bg-white'
                            : 'bg-[#0F172A] text-white hover:bg-[#1E293B]'
                        }`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Combinar trajeto</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </BottomSheet>
  );
};
