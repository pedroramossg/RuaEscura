import React, { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageCircle,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { BottomSheet, SheetDetent } from '../ui/BottomSheet';
import { CompanionChatView } from './CompanionChatView';
import { DropletMascot } from '../mascot/DropletMascot';
import { UFSC_LANDMARKS } from '../../data/ufscTrindade';
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

/**
 * Single unified BottomSheet for the Map tab (Apple HIG Single-Sheet Rule).
 * Displays route comparison ("Mais Iluminada" vs "Mais Rápida") and Gov.br companions,
 * and transitions in-place to CompanionChatView when coordinating a walk.
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

  // Prioritize companions on or intersecting the active route corridor
  const sortedCompanions = useMemo(() => {
    return [...companionMatches].sort((a, b) => {
      const aMatch =
        pathSet.has(a.originId) || pathSet.has(a.destinationId) ? 1 : 0;
      const bMatch =
        pathSet.has(b.originId) || pathSet.has(b.destinationId) ? 1 : 0;
      return bMatch - aMatch;
    });
  }, [companionMatches, pathSet]);

  const routeBreadcrumb = useMemo(() => {
    return activeRoute.path
      .map((id) => landmarkShortMap.get(id) ?? id)
      .join(' → ');
  }, [activeRoute.path, landmarkShortMap]);

  const mutedTextClass = isNightMap ? 'text-[#9FB0D8]' : 'text-[#4D5775]';
  const cardBgClass = isNightMap
    ? 'bg-[#121D3D] border-[#1F2E5C]'
    : 'bg-[#FEF1CF]/70 border-[#D8C89E]';

  const sheetMascotState = activeRoute.hasDarkWarning
    ? 'alert'
    : sortedCompanions.some((c) => c.isUserJoined)
      ? 'notify'
      : routeMode === 'brightest'
        ? 'orbit'
        : 'hexagon';

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
          dark={isNightMap}
          onBack={onCloseChat}
          onSendMessage={onSendChatMessage}
          onToggleJoin={onToggleJoinCompanion}
        />
      ) : (
        <div className="space-y-4">
          {/* Summary Header (visible in peek & expanded detents) */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-medium tracking-tight truncate">
                  {originShort} → {destShort}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    activeRoute.hasDarkWarning
                      ? isNightMap
                        ? 'bg-[#FF3B30]/20 text-[#FF3B30]'
                        : 'bg-[#D70015]/10 text-[#D70015]'
                      : 'bg-[#B9FC01] text-[#0B1226]'
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
              size={44}
              interactive
              ariaLabel="Status animado da rota"
              className="shrink-0"
            />
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
                    ? 'bg-[#B9FC01] text-[#0B1226] border-[#B9FC01] shadow-sm'
                    : 'bg-[#0131CD] text-[#FEF1CF] border-[#0131CD] shadow-sm'
                  : isNightMap
                    ? 'bg-[#121D3D] text-[#FEF1CF] border-[#1F2E5C] hover:border-[#B9FC01]/60'
                    : 'bg-[#FEF1CF]/70 text-[#0B1226] border-[#D8C89E] hover:border-[#0131CD]/50'
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
                        ? 'text-[#0B1226]/80'
                        : 'text-[#FEF1CF]/80'
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
                      ? 'text-[#0B1226]'
                      : 'text-[#B9FC01]'
                    : isNightMap
                      ? 'text-[#B9FC01]'
                      : 'text-[#15803d]'
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
                    ? 'bg-[#B9FC01] text-[#0B1226] border-[#B9FC01] shadow-sm'
                    : 'bg-[#0131CD] text-[#FEF1CF] border-[#0131CD] shadow-sm'
                  : isNightMap
                    ? 'bg-[#121D3D] text-[#FEF1CF] border-[#1F2E5C] hover:border-[#B9FC01]/60'
                    : 'bg-[#FEF1CF]/70 text-[#0B1226] border-[#D8C89E] hover:border-[#0131CD]/50'
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
                      routeMode === 'fastest' && !isNightMap
                        ? 'text-[#FF9F0A]'
                        : 'text-[#D70015]'
                    }`}
                    aria-label="Alerta de trecho escuro"
                  />
                )}
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-lg font-medium">{fastestRoute.estimatedMinutes} min</span>
                <span
                  className={`text-xs ${
                    routeMode === 'fastest'
                      ? isNightMap
                        ? 'text-[#0B1226]/80'
                        : 'text-[#FEF1CF]/80'
                      : mutedTextClass
                  }`}
                >
                  ({fastestRoute.distanceMeters} m)
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 font-medium ${
                  fastestRoute.hasDarkWarning
                    ? routeMode === 'fastest' && !isNightMap
                      ? 'text-[#FF9F0A]'
                      : isNightMap && routeMode !== 'fastest'
                        ? 'text-[#FF9F0A]'
                        : 'text-[#D70015]'
                    : routeMode === 'fastest'
                      ? isNightMap
                        ? 'text-[#0B1226]'
                        : 'text-[#B9FC01]'
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
                  ? 'bg-[#FF3B30]/15 border-[#FF3B30]/35 text-[#FEF1CF]'
                  : 'bg-[#D70015]/8 border-[#D70015]/25 text-[#0B1226]'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  isNightMap ? 'text-[#FF3B30]' : 'text-[#D70015]'
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">Trecho escuro ou poste queimado neste trajeto</p>
                <p className={`mt-0.5 ${mutedTextClass}`}>
                  Considere a rota Mais Iluminada ou caminhe em grupo pelo corredor central.
                </p>
              </div>
            </div>
          )}

          {/* Gov.br-Verified Companions Section */}
          <div className="pt-1 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck
                  className={`w-4 h-4 ${isNightMap ? 'text-[#B9FC01]' : 'text-[#15803d]'}`}
                  aria-hidden="true"
                />
                <h3 className="text-sm font-semibold">Estudantes verificados Gov.br</h3>
              </div>
              <span className={`text-xs ${mutedTextClass}`}>
                {sortedCompanions.length} ativos agora
              </span>
            </div>

            <ul className="space-y-2.5">
              {sortedCompanions.map((comp) => {
                const onCorridor =
                  pathSet.has(comp.originId) || pathSet.has(comp.destinationId);
                const compOrigin = landmarkShortMap.get(comp.originId) ?? comp.originId;
                const compDest =
                  landmarkShortMap.get(comp.destinationId) ?? comp.destinationId;

                return (
                  <li
                    key={comp.id}
                    className={`rounded-2xl p-3.5 border transition-colors ${cardBgClass}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold ${
                            isNightMap
                              ? 'bg-[#B9FC01] text-[#0B1226]'
                              : 'bg-[#0131CD] text-[#FEF1CF]'
                          }`}
                        >
                          {comp.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold truncate">{comp.name}</span>
                            {comp.isGovBrVerified && (
                              <span
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium ${
                                  isNightMap
                                    ? 'bg-[#B9FC01]/15 text-[#B9FC01]'
                                    : 'bg-[#15803d]/10 text-[#15803d]'
                                }`}
                              >
                                <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                                <span>Gov.br</span>
                              </span>
                            )}
                            {onCorridor && (
                              <span
                                className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                                  isNightMap
                                    ? 'bg-white/10 text-[#FEF1CF]'
                                    : 'bg-[#FFF9EA] text-[#0B1226] border border-[#D8C89E]'
                                }`}
                              >
                                No seu corredor
                              </span>
                            )}
                          </div>
                          <p className={`text-xs truncate mt-0.5 ${mutedTextClass}`}>
                            {comp.ufscAffiliation}
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
                            ? 'bg-[#B9FC01] text-[#0B1226] border-[#B9FC01]'
                            : isNightMap
                              ? 'bg-[#0B132B] text-[#FEF1CF] border-[#1F2E5C] hover:border-[#B9FC01]'
                              : 'bg-[#FFF9EA] text-[#0B1226] border-[#D8C89E] hover:border-[#0131CD]'
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
                            ? 'bg-[#FEF1CF] text-[#0B1226] hover:bg-white'
                            : 'bg-[#0131CD] text-[#FEF1CF] hover:bg-[#0025A1]'
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
