import React, { useMemo, useState } from 'react';
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
import { UFSC_EDGES, UFSC_LANDMARKS } from '../../data/ufscTrindade';
import { findRoute } from '../../engine/routing';
import { LightRatingSchema } from '../../security/schemas';
import { PillButton } from '../ui/PillButton';
import { DropletMascot, DROPLET_ALL_STATES } from '../mascot/DropletMascot';
import { getRouteMascotMood } from '../../mascot/moods';

type DropletState = (typeof DROPLET_ALL_STATES)[number];

export interface ExploreTabProps {
  onOpenMap: () => void;
  onOpenLights: () => void;
  onOpenReports: () => void;
  onOpenProfile: () => void;
  profileTriggerRef?: React.RefObject<HTMLButtonElement | null>;
  onNotify?: (message: string) => void;
}

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

function getInitials(name?: string | null): string {
  if (!name) return 'UF';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'UF';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Editorial Daylight Explore Hub:
 * Greeting & Gov.br profile trigger, quick destination jump to Map,
 * active brightest route hero card, nearby safe corridors carousel,
 * community edge lighting rating bar, and 40px-indexed campus highlights.
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
    setRouteEndpoints,
    rateEdgeLighting,
  } = useCampusStore();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 180);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>('edge-bu-reitoria');
  const [lastRatedScore, setLastRatedScore] = useState<number | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [dropletMood, setDropletMood] = useState<DropletState>('idle');

  const landmarkMap = useMemo(() => {
    const map = new Map(UFSC_LANDMARKS.map((n) => [n.id, n]));
    return map;
  }, []);

  const firstName = userSession?.name?.trim().split(/\s+/)[0] || 'Estudante';
  const initials = getInitials(userSession?.name);
  const originShort = landmarkMap.get(activeOriginId)?.shortName ?? activeOriginId.toUpperCase();
  const destShort =
    landmarkMap.get(activeDestinationId)?.shortName ?? activeDestinationId.toUpperCase();

  const litPostsCount = useMemo(
    () => posts.filter((p) => p.status === 'aceso').length,
    [posts]
  );
  const burnedPostsCount = useMemo(
    () => posts.filter((p) => p.status === 'queimado').length,
    [posts]
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
    setDropletMood(score <= 2 ? 'exclaim' : 'wink');
    const edgeLabel = rateableEdges.find((e) => e.id === selectedEdgeId)?.label ?? selectedEdgeId;
    onNotify?.(`Nota ${score}/5 registrada para ${edgeLabel}.`);
  };

  const routeMood = useMemo(
    () => getRouteMascotMood(brightestRoute, originShort, destShort),
    [brightestRoute, originShort, destShort]
  );

  const [tappedCycle, setTappedCycle] = useState(false);

  const handleCycleDroplet = () => {
    setTappedCycle(true);
    const cycle: DropletState[] = ['play', 'wink', 'orbit', 'idle'];
    setDropletMood((prev) => cycle[(cycle.indexOf(prev) + 1) % cycle.length]);
  };

  const heroGradient =
    routeMood.tone === 'danger'
      ? 'bg-gradient-to-b from-[#FFE6CE] via-[#FFF4E8] to-[#F6F8FC]'
      : routeMood.tone === 'caution'
        ? 'bg-gradient-to-b from-[#FEF3C7] via-[#FFFBEB] to-[#F6F8FC]'
        : 'bg-gradient-to-b from-[#E5ECFF] via-[#F2F6FF] to-[#F6F8FC]';

  const activeMascotState = tappedCycle ? dropletMood : routeMood.state;

  return (
    <section
      aria-label="Explorar campus UFSC Trindade"
      className={`min-h-screen ${heroGradient} text-[#111827] px-4 pt-5 pb-28 sm:px-6 transition-colors duration-300`}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Top Editorial Greeting + Gov.br Badge + Profile Trigger */}
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#4B5563]">
              UFSC Campus Trindade • {timeSlot}
            </p>
            <div className="flex items-center gap-2.5 flex-wrap mt-1">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111827]">
                Olá, {firstName}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
                <span>Gov.br</span>
              </span>
            </div>
            {userSession?.affiliation && (
              <p className="text-sm text-[#4B5563] mt-0.5 truncate">{userSession.affiliation}</p>
            )}
          </div>

          <button
            ref={profileTriggerRef}
            type="button"
            onClick={onOpenProfile}
            aria-label="Abrir perfil e privacidade"
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-white text-[#2563EB] text-sm font-semibold flex items-center justify-center shrink-0 border border-[#E5EAF4] hover:border-[#2563EB] active:scale-[0.97] transition-all cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
          >
            {initials}
          </button>
        </header>

        {/* Centerpiece Mascot Buddy Stage (Reference Image 2) */}
        <div className="relative flex flex-col items-center text-center pt-1 pb-2 space-y-3">
          {/* Speech Bubble */}
          <div className="relative max-w-xs sm:max-w-sm bg-white border border-[#E5EAF4] rounded-2xl px-4 py-2.5 shadow-sm text-xs sm:text-sm font-medium text-[#111827]">
            <span>{routeMood.bubble}</span>
          </div>

          {/* Semicircular Light Gauge + Interactive Centerpiece Mascot */}
          <div className="relative flex items-center justify-center pt-1">
            <svg
              aria-hidden="true"
              className="w-52 h-28 -mb-6 pointer-events-none"
              viewBox="0 0 200 108"
              fill="none"
            >
              <path
                d="M 24 98 A 76 76 0 0 1 176 98"
                stroke="#E5EAF4"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path
                d="M 24 98 A 76 76 0 0 1 176 98"
                stroke={routeMood.inkColor}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="239"
                strokeDashoffset={
                  239 - (239 * Math.min(100, Math.max(0, brightestRoute.illuminationPercentage))) / 100
                }
              />
            </svg>

            <div className="absolute bottom-0 drop-shadow-[0_10px_22px_rgba(37,99,235,0.22)]">
              <DropletMascot
                state={activeMascotState}
                expression={routeMood.expression}
                tremble={routeMood.tremble}
                inkColor={routeMood.inkColor}
                paperColor="#FFFFFF"
                notifColor={routeMood.notifColor}
                size={108}
                follow
                interactive
                onTap={handleCycleDroplet}
                ariaLabel="Mascote guia do corredor iluminado"
              />
            </div>
          </div>

          {/* 4 Quick Action Circles Beneath Mascot (Reference Image 2) */}
          <div className="grid grid-cols-4 gap-3 pt-2 w-full max-w-xs">
            <button
              type="button"
              onClick={onOpenMap}
              className="flex flex-col items-center gap-1 text-xs font-medium text-[#374151] hover:text-[#2563EB] cursor-pointer group"
            >
              <span className="w-11 h-11 rounded-full bg-white border border-[#E5EAF4] shadow-xs flex items-center justify-center group-hover:border-[#2563EB] transition-colors">
                <MapPin className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
              </span>
              <span>Mapa</span>
            </button>

            <button
              type="button"
              onClick={onOpenLights}
              className="flex flex-col items-center gap-1 text-xs font-medium text-[#374151] hover:text-[#2563EB] cursor-pointer group"
            >
              <span className="w-11 h-11 rounded-full bg-white border border-[#E5EAF4] shadow-xs flex items-center justify-center group-hover:border-[#2563EB] transition-colors">
                <Lightbulb className="w-4 h-4 text-[#10B981]" aria-hidden="true" />
              </span>
              <span>Postes</span>
            </button>

            <button
              type="button"
              onClick={onOpenMap}
              className="flex flex-col items-center gap-1 text-xs font-medium text-[#374151] hover:text-[#2563EB] cursor-pointer group"
            >
              <span className="w-11 h-11 rounded-full bg-white border border-[#E5EAF4] shadow-xs flex items-center justify-center group-hover:border-[#2563EB] transition-colors">
                <Users className="w-4 h-4 text-[#7C3AED]" aria-hidden="true" />
              </span>
              <span>Colegas</span>
            </button>

            <button
              type="button"
              onClick={onOpenReports}
              className="flex flex-col items-center gap-1 text-xs font-medium text-[#374151] hover:text-[#D70015] cursor-pointer group"
            >
              <span className="w-11 h-11 rounded-full bg-white border border-[#E5EAF4] shadow-xs flex items-center justify-center group-hover:border-[#D70015] transition-colors">
                <ShieldAlert className="w-4 h-4 text-[#D70015]" aria-hidden="true" />
              </span>
              <span>Alertas</span>
            </button>
          </div>
        </div>

        {/* Quick Destination Search Bar -> Jumps directly to Map */}
        <div className="space-y-2">
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 bg-white border border-[#E5EAF4] rounded-full p-1.5 pl-4 shadow-xs"
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
              className="flex-1 min-w-0 min-h-[44px] bg-transparent text-sm sm:text-base text-[#111827] placeholder:text-[#6B7280] focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-[44px] px-4 rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0] active:scale-[0.97] text-sm font-medium text-[#111827] shrink-0 transition-all cursor-pointer"
            >
              Ir ao Mapa
            </button>
          </form>

          {matchingLandmarks.length > 0 && (
            <div
              role="region"
              aria-label="Destinos encontrados"
              className="bg-white border border-[#E5EAF4] rounded-2xl p-2 flex flex-wrap gap-2 shadow-xs"
            >
              {matchingLandmarks.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => handleJumpToLandmark(node.id)}
                  className="min-h-[44px] px-3.5 rounded-full bg-[#F1F5F9] hover:bg-[#DBEAFE] text-sm font-medium text-[#111827] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />
                  <span>{node.shortName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hero Route Summary Card + Single Prominent Primary CTA */}
        <article
          aria-label="Seu corredor agora"
          className="relative overflow-hidden rounded-3xl bg-white text-[#111827] p-6 shadow-sm border border-[#E5EAF4]"
        >
          <div className="relative space-y-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#EFF6FF] text-[#2563EB]">
                <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Seu corredor agora</span>
              </span>
              <span className="text-xs font-medium text-[#6B7280]">
                {originShort} → {destShort}
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#111827]">
                Trajeto iluminado de {originShort} até {destShort}
              </h2>
              <p className="text-sm text-[#4B5563] mt-1">
                Caminho priorizando postes ativos e calçadas movimentadas da Trindade.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1 border-t border-[#E5EAF4]">
              <div className="pt-3">
                <p className="text-xs text-[#6B7280]">Duração</p>
                <p className="text-xl font-semibold text-[#111827] mt-0.5">
                  ~{brightestRoute.estimatedMinutes} min
                </p>
                <p className="text-xs text-[#6B7280]">{brightestRoute.distanceMeters} m</p>
              </div>
              <div className="pt-3">
                <p className="text-xs text-[#6B7280]">Iluminação</p>
                <p className="text-xl font-semibold text-[#10B981] mt-0.5">
                  {brightestRoute.illuminationPercentage}%
                </p>
                <p className="text-xs text-[#6B7280]">índice médio</p>
              </div>
              <div className="pt-3">
                <p className="text-xs text-[#6B7280]">Companhia</p>
                <p className="text-xl font-semibold text-[#111827] mt-0.5">
                  {companionMatches.length} colegas
                </p>
                <p className="text-xs text-[#6B7280]">
                  {litPostsCount}/{posts.length} postes acesos
                </p>
              </div>
            </div>

            <div className="pt-1">
              <PillButton
                variant="lime"
                size="compact"
                onClick={onOpenMap}
                className="w-full sm:w-auto font-medium gap-2"
              >
                <span>Abrir rota no Mapa</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </PillButton>
            </div>
          </div>
        </article>

        {/* Horizontal Safe Routes Near You */}
        <section aria-labelledby="explore-safe-routes-heading" className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2
              id="explore-safe-routes-heading"
              className="text-lg font-semibold text-[#111827]"
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
                className="min-w-[232px] max-w-[248px] shrink-0 min-h-[44px] bg-white border border-[#E5EAF4] hover:border-[#2563EB] rounded-2xl p-4 text-left transition-colors active:scale-[0.98] cursor-pointer flex flex-col justify-between gap-3 shadow-2xs"
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
        </section>

        {/* Quick Community Lighting Rating Bar */}
        <section
          aria-labelledby="explore-rating-heading"
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
              <h2 id="explore-rating-heading" className="text-lg font-medium text-[#111827]">
                Avaliar iluminação de um trecho
              </h2>
              <p className="text-sm text-[#4B5563] mt-0.5">
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
                      className={`min-w-[44px] min-h-[44px] px-2.5 rounded-full border text-sm font-medium inline-flex items-center justify-center gap-1 transition-all active:scale-[0.97] cursor-pointer ${
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
        </section>

        {/* Recent Campus Highlights */}
        <section aria-labelledby="explore-highlights-heading" className="space-y-3">
          <h2 id="explore-highlights-heading" className="text-lg font-semibold text-[#111827]">
            Destaques do campus agora
          </h2>

          <div className="bg-white border border-[#E5EAF4] rounded-[24px] px-5 divide-y divide-[#E5EAF4] shadow-2xs">
            {/* Row 1: Lamp Posts */}
            <div className="py-4 flex items-start gap-5">
              <div
                aria-hidden="true"
                className="w-10 h-10 rounded-full bg-[#2563EB] text-white text-sm font-medium flex items-center justify-center shrink-0"
              >
                1
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-base font-medium text-[#111827] inline-flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-[#10B981]" aria-hidden="true" />
                    <span>Rede de postes monitorados</span>
                  </h3>
                  <button
                    type="button"
                    onClick={onOpenLights}
                    className="min-h-[44px] px-3 rounded-full text-xs font-medium border border-[#E5EAF4] text-[#111827] hover:bg-[#F8FAFC] active:scale-[0.97] transition-all cursor-pointer"
                  >
                    Ver postes
                  </button>
                </div>
                <p className="text-sm text-[#4B5563] mt-1">
                  {litPostsCount} de {posts.length} postes operando normalmente
                  {burnedPostsCount > 0 ? ` • ${burnedPostsCount} queimado(s) desviando rotas` : ''}.
                </p>
              </div>
            </div>

            {/* Row 2: Latest Incident Report */}
            <div className="py-4 flex items-start gap-5">
              <div
                aria-hidden="true"
                className="w-10 h-10 rounded-full bg-[#2563EB] text-white text-sm font-medium flex items-center justify-center shrink-0"
              >
                2
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-base font-medium text-[#111827] inline-flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-[#F59E0B]" aria-hidden="true" />
                    <span>Último registro comunitário</span>
                  </h3>
                  <button
                    type="button"
                    onClick={onOpenReports}
                    className="min-h-[44px] px-3 rounded-full text-xs font-medium border border-[#E5EAF4] text-[#111827] hover:bg-[#F8FAFC] active:scale-[0.97] transition-all cursor-pointer"
                  >
                    Ver denúncias
                  </button>
                </div>
                <p className="text-sm text-[#4B5563] mt-1">
                  {latestReport
                    ? `${latestReport.locationName}: ${latestReport.description}`
                    : 'Nenhuma ocorrência recente registrada no campus.'}
                </p>
              </div>
            </div>

            {/* Row 3: Verified Companions */}
            <div className="py-4 flex items-start gap-5">
              <div
                aria-hidden="true"
                className="w-10 h-10 rounded-full bg-[#2563EB] text-white text-sm font-medium flex items-center justify-center shrink-0"
              >
                3
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-base font-medium text-[#111827] inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                    <span>Caminhada acompanhada</span>
                  </h3>
                  <button
                    type="button"
                    onClick={onOpenMap}
                    className="min-h-[44px] px-3 rounded-full text-xs font-medium border border-[#E5EAF4] text-[#111827] hover:bg-[#F8FAFC] active:scale-[0.97] transition-all cursor-pointer"
                  >
                    Ver colegas
                  </button>
                </div>
                <p className="text-sm text-[#4B5563] mt-1">
                  {companionMatches.length} estudantes verificados via Gov.br com saída entre{' '}
                  {companionMatches[0]?.departureTime ?? '21:30'} e 22:00.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
};
