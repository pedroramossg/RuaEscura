import React, { Suspense, lazy, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Clock,
  Lightbulb,
  MapPin,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  Users,
  Zap,
} from 'lucide-react';
import { useCampusStore } from '../../hooks/useCampusStore';
import { useDebounce } from '../../hooks/useDebounce';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { UFSC_EDGES, UFSC_LANDMARKS } from '../../data/ufscTrindade';
import { findRoute } from '../../engine/routing';
import { LightRatingSchema } from '../../security/schemas';
import { PillButton } from '../ui/PillButton';
import { DropletMascot } from '../mascot/DropletMascot';
import { getRouteMascotMood } from '../../mascot/moods';
import { RouteStatusCard } from './RouteStatusCard';
import type { ExploreSheetMode } from './ScheduleAndDetailsSheet';

const ScheduleAndDetailsSheet = lazy(() =>
  import('./ScheduleAndDetailsSheet').then((m) => ({ default: m.ScheduleAndDetailsSheet }))
);

export interface ExploreTabProps {
  onOpenMap: () => void;
  onOpenLights: () => void;
  onOpenReports: () => void;
  onOpenProfile: () => void;
  profileTriggerRef?: React.RefObject<HTMLButtonElement | null>;
  onNotify?: (message: string) => void;
}

type HeroTelemetryMode = 'corridor' | 'campus';
type UpdatesFilter = 'all' | 'routes' | 'rating' | 'highlights';

interface QuickRoutePreset {
  originId: string;
  destId: string;
  title: string;
  subtitle: string;
}

const QUICK_ROUTE_PRESETS: QuickRoutePreset[] = [
  {
    originId: 'bu',
    destId: 'santos_dumont',
    title: 'BU → Praça Santos Dumont',
    subtitle: 'Corredor principal para pontos de ônibus',
  },
  {
    originId: 'ru',
    destId: 'cce',
    title: 'RU → CCE',
    subtitle: 'Via Praça da Cidadania iluminada',
  },
  {
    originId: 'cse',
    destId: 'eps',
    title: 'CSE → EPS / CTC',
    subtitle: 'Passagem Des. Vítor Lima',
  },
  {
    originId: 'cfh',
    destId: 'ru',
    title: 'CFH → RU Trindade',
    subtitle: 'Acesso pelo Centro de Eventos',
  },
];

const RATEABLE_EDGE_IDS = [
  'edge-bu-reitoria',
  'edge-reitoria-ru',
  'edge-bosque-reitoria',
  'edge-cce-bu',
  'edge-ccj-reitoria',
  'edge-bu-ru-shortcut',
];

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function getInitials(name?: string | null): string {
  if (!name) return 'UF';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'UF';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Home Telemetry & Editorial Hub inspired by Reference 4f402bbc ("001" Sky-Blue Telemetry):
 * - Sky-blue atmospheric header fading cleanly to pure white
 * - Segmented glass switcher (Corredor | Campus) with layoutId spring physics
 * - Oversized animated count-up metric + 3 frosted telemetry tiles + single primary CTA
 * - Continuous safety gradient bar with subtle reactive mascot companion
 */
export const ExploreTab: React.FC<ExploreTabProps> = ({
  onOpenMap,
  onOpenLights,
  onOpenReports,
  onOpenProfile,
  profileTriggerRef,
  onNotify,
}) => {
  const {
    userSession,
    timeSlot,
    posts,
    reports,
    edgeRatings,
    companionMatches,
    activeOriginId,
    activeDestinationId,
    brightestRoute,
    scheduledDeparture,
    setRouteEndpoints,
    swapEndpoints,
    scheduleDeparture,
    rateEdgeLighting,
  } = useCampusStore();

  const prefersReducedMotion = usePrefersReducedMotion();
  const [heroMode, setHeroMode] = useState<HeroTelemetryMode>('corridor');
  const [updatesFilter, setUpdatesFilter] = useState<UpdatesFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 180);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>('edge-bu-reitoria');
  const [lastRatedScore, setLastRatedScore] = useState<number | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<ExploreSheetMode>(null);

  const landmarkMap = useMemo(
    () => new Map(UFSC_LANDMARKS.map((n) => [n.id, n])),
    []
  );

  const firstName = userSession?.name?.trim().split(/\s+/)[0] || 'Estudante';
  const initials = getInitials(userSession?.name);
  const originNode = landmarkMap.get(activeOriginId);
  const destNode = landmarkMap.get(activeDestinationId);
  const originShort = originNode?.shortName ?? activeOriginId.toUpperCase();
  const destShort = destNode?.shortName ?? activeDestinationId.toUpperCase();
  const originName = originNode?.name ?? originShort;
  const destName = destNode?.name ?? destShort;

  const litPostsCount = useMemo(
    () => posts.filter((p) => p.status === 'aceso').length,
    [posts]
  );
  const oscillatingPostsCount = useMemo(
    () => posts.filter((p) => p.status === 'oscilando').length,
    [posts]
  );
  const burnedPostsCount = useMemo(
    () => posts.filter((p) => p.status === 'queimado').length,
    [posts]
  );

  const routeLitPostsCount = useMemo(
    () => brightestRoute.posts.filter((p) => p.status === 'aceso').length,
    [brightestRoute.posts]
  );

  const routeMood = useMemo(
    () => getRouteMascotMood(brightestRoute, originShort, destShort),
    [brightestRoute, originShort, destShort]
  );

  const matchingLandmarks = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return UFSC_LANDMARKS.filter(
      (node) =>
        node.shortName.toLowerCase().includes(q) ||
        node.name.toLowerCase().includes(q) ||
        node.id.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [debouncedSearchQuery]);

  const quickRoutes = useMemo(() => {
    return QUICK_ROUTE_PRESETS.map((preset) => ({
      ...preset,
      route: findRoute(
        preset.originId,
        preset.destId,
        'brightest',
        posts,
        edgeRatings,
        reports
      ),
    }));
  }, [posts, edgeRatings, reports]);

  const rateableEdges = useMemo(() => {
    return RATEABLE_EDGE_IDS.map((edgeId) => {
      const edge = UFSC_EDGES.find((e) => e.id === edgeId);
      if (!edge) return null;
      const fromShort = landmarkMap.get(edge.from)?.shortName ?? edge.from;
      const toShort = landmarkMap.get(edge.to)?.shortName ?? edge.to;
      return {
        id: edge.id,
        label:
          edge.id === 'edge-bu-ru-shortcut'
            ? `${fromShort} ↔ ${toShort} (Atalho)`
            : `${fromShort} ↔ ${toShort}`,
      };
    }).filter((item): item is { id: string; label: string } => item !== null);
  }, [landmarkMap]);

  const selectedEdgeSummary = edgeRatings[selectedEdgeId];
  const latestReport = reports[0];

  const handleJumpToLandmark = (destId: string) => {
    const nextOrigin =
      destId === activeOriginId ? (destId === 'bu' ? 'ru' : 'bu') : activeOriginId;
    setRouteEndpoints(nextOrigin, destId);
    const destName = landmarkMap.get(destId)?.shortName ?? destId;
    onNotify?.(`Destino atualizado para ${destName}.`);
    setSearchQuery('');
    onOpenMap();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (matchingLandmarks.length > 0) {
      handleJumpToLandmark(matchingLandmarks[0].id);
      return;
    }
    onOpenMap();
  };

  const handleSelectQuickRoute = (originId: string, destId: string, title: string) => {
    setRouteEndpoints(originId, destId);
    onNotify?.(`Trajeto selecionado: ${title}.`);
    onOpenMap();
  };

  const handleRateEdge = (score: number) => {
    setRatingError(null);
    const check = LightRatingSchema.safeParse({ edgeId: selectedEdgeId, rating: score });
    if (!check.success) {
      setRatingError(check.error.errors[0]?.message ?? 'Nota inválida.');
      return;
    }

    const res = rateEdgeLighting(selectedEdgeId, score);
    if (!res.success) {
      setRatingError(res.error ?? 'Não foi possível registrar a avaliação.');
      return;
    }

    setLastRatedScore(score);
    const edgeLabel = rateableEdges.find((e) => e.id === selectedEdgeId)?.label ?? selectedEdgeId;
    onNotify?.(`Nota ${score}/5 registrada para ${edgeLabel}.`);
  };

  const showRoutes = updatesFilter === 'all' || updatesFilter === 'routes';
  const showRating = updatesFilter === 'all' || updatesFilter === 'rating';
  const showHighlights = updatesFilter === 'all' || updatesFilter === 'highlights';

  const enter = (delay: number) =>
    prefersReducedMotion
      ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: { duration: 0.34, delay, ease: EASE_OUT },
        };

  const heroGradientClass =
    routeMood.tone === 'danger'
      ? 'from-[#FFEDD5] via-[#FFF7ED] via-60% to-white'
      : 'from-[#E2EEFF] via-[#F2F7FF] via-65% to-white';

  const markerPercent = Math.min(96, Math.max(4, brightestRoute.illuminationPercentage));

  const openProfileClean = () => {
    setSheetMode(null);
    onOpenProfile();
  };

  const openMapClean = () => {
    setSheetMode(null);
    onOpenMap();
  };

  return (
    <section
      aria-label="Explorar campus UFSC Trindade"
      className="min-h-screen bg-white text-[#111827] pb-28"
    >
      {/* Top Light Atmospheric Stage + Light-Mode FlightStatusCard Hero */}
      <div className={`bg-gradient-to-b ${heroGradientClass} px-4 pt-5 pb-6 sm:px-6 transition-colors duration-300`}>
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Compact Top Greeting + Gov.br Pill + Profile Avatar */}
          <header className="flex items-center justify-between gap-3 text-[#111827]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#111827]">
                  Olá, {firstName}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/85 backdrop-blur-md text-[#1D4ED8] border border-[#BFDBFE] shadow-2xs">
                  <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                  <span>Gov.br</span>
                </span>
              </div>
              <p className="text-xs text-[#475569] truncate mt-0.5">
                UFSC Trindade • {scheduledDeparture ? `Saída ${scheduledDeparture.time}` : timeSlot}
                {userSession?.affiliation ? ` • ${userSession.affiliation}` : ''}
              </p>
            </div>

            <button
              ref={profileTriggerRef}
              type="button"
              onClick={openProfileClean}
              aria-label="Abrir perfil e privacidade"
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-white/90 backdrop-blur-md text-[#111827] text-sm font-semibold flex items-center justify-center shrink-0 border border-[#CBD5E1] shadow-xs hover:bg-white enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
            >
              {initials}
            </button>
          </header>

          {/* Frosted Segmented Mode Switcher (Corredor | Campus) */}
          <div className="flex justify-center">
            <div
              role="group"
              aria-label="Modo de leitura do painel"
              className="inline-flex items-center p-1 rounded-full bg-white/80 backdrop-blur-md border border-[#DCE7F7] shadow-2xs"
            >
              {(
                [
                  { id: 'corridor', label: 'Corredor' },
                  { id: 'campus', label: 'Campus' },
                ] as const
              ).map((tab) => {
                const isActive = heroMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setHeroMode(tab.id)}
                    className={`relative min-h-[36px] px-4 rounded-full text-xs font-medium transition-colors duration-150 cursor-pointer ${
                      isActive ? 'text-white' : 'text-[#475569] hover:text-[#111827]'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId={prefersReducedMotion ? undefined : 'hero-telemetry-pill'}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.01 }
                            : { type: 'spring', duration: 0.3, bounce: 0 }
                        }
                        className="absolute inset-0 rounded-full bg-[#111827] shadow-xs"
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hero Switch: Light-Mode RouteStatusCard (Componentry FlightStatusCard) vs Campus Network */}
          {heroMode === 'corridor' ? (
            <RouteStatusCard
              originShort={originShort}
              destShort={destShort}
              originName={originName}
              destName={destName}
              estimatedMinutes={brightestRoute.estimatedMinutes}
              distanceMeters={brightestRoute.distanceMeters}
              litPostsCount={routeLitPostsCount}
              totalPostsCount={brightestRoute.posts.length}
              companionsCount={companionMatches.length}
              hasDarkWarning={brightestRoute.hasDarkWarning}
              progress={brightestRoute.illuminationPercentage}
              scheduledTime={scheduledDeparture?.time}
              timeSlot={timeSlot}
              onSwapRoute={() => {
                swapEndpoints();
                onNotify?.(`Sentido invertido: ${destShort} → ${originShort}.`);
              }}
              onOpenSchedule={() => setSheetMode('schedule')}
              onOpenDetails={() => setSheetMode('details')}
            />
          ) : (
            <motion.div
              {...enter(0.05)}
              className="rounded-[28px] bg-white border border-[#DCE7F7] p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                    Rede UFSC Trindade
                  </p>
                  <p className="text-base font-semibold text-[#111827] mt-0.5">
                    {litPostsCount} de {posts.length} postes ativos agora
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetMode('schedule')}
                  className="min-h-[44px] px-3.5 rounded-full bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#DCE7F7] text-xs font-semibold text-[#111827] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />
                  <span>{scheduledDeparture?.time ? `Saída ${scheduledDeparture.time}` : 'Marcar horário'}</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={onOpenLights}
                  className="rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] px-3 py-3 text-center hover:bg-[#D1FAE5] enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer"
                >
                  <p className="text-[11px] font-medium text-[#065F46]">Acesos</p>
                  <p className="text-lg font-semibold text-[#047857] mt-0.5 tabular-nums">
                    {litPostsCount}
                  </p>
                  <p className="text-[11px] text-[#065F46]">operando</p>
                </button>

                <button
                  type="button"
                  onClick={onOpenLights}
                  className="rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] px-3 py-3 text-center hover:bg-[#FEF3C7] enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer"
                >
                  <p className="text-[11px] font-medium text-[#92400E]">Oscilando</p>
                  <p className="text-lg font-semibold text-[#B45309] mt-0.5 tabular-nums">
                    {oscillatingPostsCount}
                  </p>
                  <p className="text-[11px] text-[#92400E]">em alerta</p>
                </button>

                <button
                  type="button"
                  onClick={onOpenReports}
                  className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] px-3 py-3 text-center hover:bg-[#FEE2E2] enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer"
                >
                  <p className="text-[11px] font-medium text-[#991B1B]">Queimados</p>
                  <p className="text-lg font-semibold text-[#B91C1C] mt-0.5 tabular-nums">
                    {burnedPostsCount}
                  </p>
                  <p className="text-[11px] text-[#991B1B]">desviando</p>
                </button>
              </div>
            </motion.div>
          )}

          {/* Single Prominent Primary CTA + Clean Quick Search */}
          <motion.div {...enter(0.14)} className="space-y-3 pt-1">
            <PillButton
              variant="lime"
              size="compact"
              onClick={openMapClean}
              className="w-full font-semibold gap-2 shadow-md"
            >
              <span>Abrir rota no Mapa</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </PillButton>

            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-2 bg-white border border-[#E5EAF4] rounded-full p-1.5 pl-4 shadow-sm"
            >
              <Search className="w-4 h-4 text-[#6B7280] shrink-0" aria-hidden="true" />
              <label htmlFor="explore-destination-search" className="sr-only">
                Para onde você vai na UFSC?
              </label>
              <input
                id="explore-destination-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Para onde você vai? Ex: RU, CCE, Santos Dumont"
                className="flex-1 min-w-0 min-h-[44px] bg-transparent text-sm text-[#111827] placeholder:text-[#6B7280] focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0] enabled:active:scale-[0.96] text-xs sm:text-sm font-medium text-[#111827] shrink-0 transition-[transform,background-color] duration-150 cursor-pointer"
              >
                Ir ao Mapa
              </button>
            </form>

            {matchingLandmarks.length > 0 && (
              <div
                role="region"
                aria-label="Destinos encontrados"
                className="bg-white border border-[#E5EAF4] rounded-2xl p-2 flex flex-wrap gap-2 shadow-sm"
              >
                {matchingLandmarks.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleJumpToLandmark(node.id)}
                    className="min-h-[44px] px-3.5 rounded-full bg-[#F8FAFC] hover:bg-[#EFF6FF] text-sm font-medium text-[#111827] inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />
                    <span>{node.shortName}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* White Lower Canvas: Daily Campus Updates + Sub-tabs + Continuous Gradient Gauge */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6 pt-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-[#111827]">
              Atualizações do Campus
            </h2>
            <span className="text-xs font-medium text-[#6B7280]">Tempo real</span>
          </div>

          {/* Animated Segmented Sub-Tab Strip (Meals | Advises | Water style) */}
          <div
            role="group"
            aria-label="Filtrar seções do campus"
            className="grid grid-cols-4 p-1 rounded-2xl bg-[#F3F5FA] border border-[#E8ECF4]"
          >
            {(
              [
                { id: 'all', label: 'Tudo' },
                { id: 'routes', label: 'Rotas' },
                { id: 'rating', label: 'Avaliar' },
                { id: 'highlights', label: 'Alertas' },
              ] as const
            ).map((tab) => {
              const active = updatesFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setUpdatesFilter(tab.id)}
                  aria-pressed={active}
                  className={`relative min-h-[38px] rounded-xl text-xs font-medium transition-colors duration-150 cursor-pointer ${
                    active ? 'text-[#111827]' : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId={prefersReducedMotion ? undefined : 'updates-segment-pill'}
                      transition={
                        prefersReducedMotion
                          ? { duration: 0.01 }
                          : { type: 'spring', duration: 0.3, bounce: 0 }
                      }
                      className="absolute inset-0 rounded-xl bg-white shadow-xs border border-[#E5EAF4]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Continuous Safety Gradient Card (Reference 4f402bbc "Improve Melatonin") + Subtle Mascot */}
        <article
          aria-label="Seu corredor agora"
          className="bg-[#F8FAFC] border border-[#E5EAF4] rounded-3xl p-5 space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111827]">
                Índice de Iluminação ({originShort} → {destShort})
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5">{routeMood.bubble}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSheetMode('details')}
                className="min-h-[36px] px-3 rounded-full bg-white border border-[#DCE7F7] text-xs font-semibold text-[#111827] tabular-nums hover:bg-[#F1F5F9] cursor-pointer"
              >
                {routeLitPostsCount}/{brightestRoute.posts.length} postes
              </button>
              <DropletMascot
                state={routeMood.state}
                expression={routeMood.expression}
                tremble={routeMood.tremble}
                inkColor={routeMood.inkColor}
                paperColor="#FFFFFF"
                notifColor={routeMood.notifColor}
                size={40}
                interactive
                ariaLabel="Mascote indicador do corredor"
              />
            </div>
          </div>

          {/* Animated Gradient Bar Gauge */}
          <div className="space-y-2 pt-1">
            <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-[#FB923C] via-[#93C5FD] to-[#10B981]">
              <motion.div
                initial={false}
                animate={{ left: `${markerPercent}%` }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.01 }
                    : { type: 'spring', duration: 0.45, bounce: 0 }
                }
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#111827] shadow-sm"
                aria-hidden="true"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
              <span>0% Escuro</span>
              <span
                className={`font-semibold ${
                  routeMood.tone === 'danger' ? 'text-[#EA580C]' : 'text-[#10B981]'
                }`}
              >
                ● {routeMood.tone === 'danger' ? 'Trecho com alerta' : 'Caminho seguro'}
              </span>
              <span>100% Claro</span>
            </div>
          </div>
        </article>

        <AnimatePresence initial={false}>
          {showRoutes && (
            <motion.section
              key="section-routes"
              aria-labelledby="explore-safe-routes-heading"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="space-y-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2
                  id="explore-safe-routes-heading"
                  className="text-base font-semibold text-[#111827]"
                >
                  Rotas seguras perto de você
                </h2>
                <span className="text-xs text-[#6B7280]">Toque para traçar</span>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                {quickRoutes.map((item) => (
                  <button
                    key={`${item.originId}-${item.destId}`}
                    type="button"
                    onClick={() => handleSelectQuickRoute(item.originId, item.destId, item.title)}
                    className="min-w-[232px] max-w-[248px] shrink-0 min-h-[44px] bg-white border border-[#E5EAF4] hover:border-[#2563EB] rounded-2xl p-4 text-left transition-[transform,border-color] duration-150 enabled:active:scale-[0.96] cursor-pointer flex flex-col justify-between gap-3 shadow-2xs"
                  >
                    <div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#D1FAE5] text-[#065F46]">
                        <Zap className="w-3 h-3" aria-hidden="true" />
                        <span>{item.route.illuminationPercentage}% iluminada</span>
                      </span>
                      <h3 className="text-base font-medium text-[#111827] mt-2.5">{item.title}</h3>
                      <p className="text-xs text-[#6B7280] mt-1">{item.subtitle}</p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#4B5563] pt-2 border-t border-[#E5EAF4]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>~{item.route.estimatedMinutes} min</span>
                      </span>
                      <span>{item.route.distanceMeters} m</span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.section>
          )}

          {showRating && (
            <motion.section
              key="section-rating"
              aria-labelledby="explore-rating-heading"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="bg-white border border-[#E5EAF4] rounded-[24px] p-5 space-y-4 shadow-2xs"
            >
              <div className="flex items-start gap-4">
                <div
                  aria-hidden="true"
                  className="w-10 h-10 rounded-full bg-[#2563EB] text-white text-sm font-medium flex items-center justify-center shrink-0"
                >
                  1
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="explore-rating-heading" className="text-base font-semibold text-[#111827]">
                    Avaliar iluminação de um trecho
                  </h2>
                  <p className="text-xs sm:text-sm text-[#4B5563] mt-0.5">
                    Sua nota de 1 a 5 recalibra o peso das rotas no grafo da UFSC.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="explore-rate-edge"
                    className="block text-xs font-medium text-[#6B7280] mb-1.5"
                  >
                    Trecho caminhado
                  </label>
                  <select
                    id="explore-rate-edge"
                    aria-label="Trecho para avaliar"
                    value={selectedEdgeId}
                    onChange={(e) => {
                      setSelectedEdgeId(e.target.value);
                      setLastRatedScore(null);
                      setRatingError(null);
                    }}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#E5EAF4] bg-[#F8FAFC] text-sm text-[#111827] focus:outline-2 focus:outline-[#2563EB] cursor-pointer"
                  >
                    {rateableEdges.map((edge) => (
                      <option key={edge.id} value={edge.id}>
                        {edge.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5" role="group" aria-label="Nota de iluminação">
                    {[1, 2, 3, 4, 5].map((score) => {
                      const isActive = lastRatedScore === score;
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => handleRateEdge(score)}
                          aria-label={`Avaliar trecho com nota ${score} de 5`}
                          aria-pressed={isActive}
                          className={`min-w-[44px] min-h-[44px] px-2.5 rounded-full border text-sm font-medium inline-flex items-center justify-center gap-1 transition-[transform,background-color,border-color] duration-150 enabled:active:scale-[0.96] cursor-pointer ${
                            isActive
                              ? 'bg-[#2563EB] text-white border-[#2563EB]'
                              : 'bg-[#F8FAFC] text-[#111827] border-[#E5EAF4] hover:border-[#2563EB]'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{score}</span>
                        </button>
                      );
                    })}
                  </div>

                  <span className="text-xs text-[#6B7280]">
                    {selectedEdgeSummary
                      ? `Média ${selectedEdgeSummary.averageRating.toFixed(1)}/5 (${selectedEdgeSummary.count} votos)`
                      : 'Sem avaliações ainda'}
                  </span>
                </div>

                {ratingError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#D70015] font-medium"
                  >
                    {ratingError}
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {showHighlights && (
            <motion.section
              key="section-highlights"
              aria-labelledby="explore-highlights-heading"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="space-y-3"
            >
              <h2 id="explore-highlights-heading" className="text-base font-semibold text-[#111827]">
                Destaques do campus agora
              </h2>

              <div className="bg-white border border-[#E5EAF4] rounded-[24px] px-5 divide-y divide-[#E5EAF4] shadow-2xs">
                {/* Row 1: Lamp Posts */}
                <div className="py-4 flex items-start gap-4">
                  <div
                    aria-hidden="true"
                    className="w-10 h-10 rounded-full bg-[#EFF6FF] text-[#2563EB] text-sm font-semibold flex items-center justify-center shrink-0"
                  >
                    1
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-medium text-[#111827] inline-flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4 text-[#10B981]" aria-hidden="true" />
                        <span>Rede de postes monitorados</span>
                      </h3>
                      <button
                        type="button"
                        onClick={onOpenLights}
                        className="min-h-[44px] px-3 rounded-full text-xs font-medium border border-[#E5EAF4] text-[#111827] hover:bg-[#F8FAFC] enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer"
                      >
                        Ver postes
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-[#4B5563] mt-1">
                      {litPostsCount} de {posts.length} postes operando normalmente
                      {burnedPostsCount > 0 ? ` • ${burnedPostsCount} queimado(s) desviando rotas` : ''}.
                    </p>
                  </div>
                </div>

                {/* Row 2: Latest Incident Report */}
                <div className="py-4 flex items-start gap-4">
                  <div
                    aria-hidden="true"
                    className="w-10 h-10 rounded-full bg-[#EFF6FF] text-[#2563EB] text-sm font-semibold flex items-center justify-center shrink-0"
                  >
                    2
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-medium text-[#111827] inline-flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-[#F59E0B]" aria-hidden="true" />
                        <span>Último registro comunitário</span>
                      </h3>
                      <button
                        type="button"
                        onClick={onOpenReports}
                        className="min-h-[44px] px-3 rounded-full text-xs font-medium border border-[#E5EAF4] text-[#111827] hover:bg-[#F8FAFC] enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer"
                      >
                        Ver denúncias
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-[#4B5563] mt-1">
                      {latestReport
                        ? `${latestReport.locationName}: ${latestReport.description}`
                        : 'Nenhuma ocorrência recente registrada no campus.'}
                    </p>
                  </div>
                </div>

                {/* Row 3: Verified Companions */}
                <div className="py-4 flex items-start gap-4">
                  <div
                    aria-hidden="true"
                    className="w-10 h-10 rounded-full bg-[#EFF6FF] text-[#2563EB] text-sm font-semibold flex items-center justify-center shrink-0"
                  >
                    3
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-medium text-[#111827] inline-flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                        <span>Caminhada acompanhada</span>
                      </h3>
                      <button
                        type="button"
                        onClick={onOpenMap}
                        className="min-h-[44px] px-3 rounded-full text-xs font-medium border border-[#E5EAF4] text-[#111827] hover:bg-[#F8FAFC] enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer"
                      >
                        Ver colegas
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-[#4B5563] mt-1">
                      {companionMatches.length === 1
                        ? '1 estudante verificado'
                        : `${companionMatches.length} estudantes verificados`}{' '}
                      via Gov.br com saída entre{' '}
                      {companionMatches[0]?.departureTime ?? '21:30'} e 22:00.
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Single-Sheet Schedule Departure & Route Details UIArc Bottom Sheet */}
      {sheetMode !== null && (
        <Suspense fallback={null}>
          <ScheduleAndDetailsSheet
            mode={sheetMode}
            onClose={() => setSheetMode(null)}
            onSwitchMode={(next) => setSheetMode(next)}
            originShort={originShort}
            destShort={destShort}
            route={brightestRoute}
            edgeRatings={edgeRatings}
            companions={companionMatches}
            scheduledTime={scheduledDeparture?.time}
            onConfirmDeparture={(timeHHMM) => {
              const res = scheduleDeparture(timeHHMM);
              if (res.success) {
                onNotify?.(`Saída marcada para ${timeHHMM} (${originShort} → ${destShort}).`);
              }
            }}
            onOpenMap={openMapClean}
          />
        </Suspense>
      )}
    </section>
  );
};
