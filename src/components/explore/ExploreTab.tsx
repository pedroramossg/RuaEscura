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
import { UFSC_EDGES, UFSC_LANDMARKS } from '../../data/ufscTrindade';
import { findRoute } from '../../engine/routing';
import { LightRatingSchema } from '../../security/schemas';
import { PillButton } from '../ui/PillButton';

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
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>('edge-bu-reitoria');
  const [lastRatedScore, setLastRatedScore] = useState<number | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);

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
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return UFSC_LANDMARKS.filter(
      (node) =>
        node.shortName.toLowerCase().includes(q) ||
        node.name.toLowerCase().includes(q) ||
        node.id.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [searchQuery]);

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

  return (
    <section
      aria-label="Explorar campus UFSC Trindade"
      className="min-h-screen bg-[#f3f3f4] text-[#131314] px-4 pt-5 pb-28 sm:px-6"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Top Editorial Greeting + Gov.br Badge + Profile Trigger */}
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#66646d]">
              UFSC Campus Trindade • {timeSlot}
            </p>
            <div className="flex items-center gap-2.5 flex-wrap mt-1">
              <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-[#131314]">
                Olá, {firstName}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#131314] text-[#befc65]">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Gov.br</span>
              </span>
            </div>
            {userSession?.affiliation && (
              <p className="text-sm text-[#46444a] mt-0.5 truncate">{userSession.affiliation}</p>
            )}
          </div>

          <button
            ref={profileTriggerRef}
            type="button"
            onClick={onOpenProfile}
            aria-label="Abrir perfil e privacidade"
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-[#131314] text-[#befc65] text-sm font-medium flex items-center justify-center shrink-0 border border-[#dfe3e6] hover:bg-[#26262b] active:scale-[0.97] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#131314]"
          >
            {initials}
          </button>
        </header>

        {/* Quick Destination Search Bar -> Jumps directly to Map */}
        <div className="space-y-2">
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 bg-white border border-[#dfe3e6] rounded-full p-1.5 pl-4"
          >
            <Search className="w-4 h-4 text-[#66646d] shrink-0" aria-hidden="true" />
            <label htmlFor="explore-destination-search" className="sr-only">
              Para onde você vai na UFSC?
            </label>
            <input
              id="explore-destination-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Para onde você vai? Ex: RU, CCE, Santos Dumont"
              className="flex-1 min-w-0 min-h-[44px] bg-transparent text-sm sm:text-base text-[#131314] placeholder:text-[#66646d] focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-[44px] px-4 rounded-full bg-[#f3f3f4] hover:bg-[#e5e5e7] active:scale-[0.97] text-sm font-medium text-[#131314] shrink-0 transition-all cursor-pointer"
            >
              Ir ao Mapa
            </button>
          </form>

          {matchingLandmarks.length > 0 && (
            <div
              role="region"
              aria-label="Destinos encontrados"
              className="bg-white border border-[#dfe3e6] rounded-2xl p-2 flex flex-wrap gap-2"
            >
              {matchingLandmarks.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => handleJumpToLandmark(node.id)}
                  className="min-h-[44px] px-3.5 rounded-full bg-[#f3f3f4] hover:bg-[#befc65] text-sm font-medium text-[#131314] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{node.shortName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hero Dark Stage Card: Active Brightest Route Summary + Single Primary PillButton */}
        <article
          aria-label="Seu corredor agora"
          className="relative overflow-hidden rounded-3xl bg-[#131314] text-white p-6"
        >
          <div
            aria-hidden="true"
            className="absolute -top-16 -right-12 w-56 h-56 rounded-full bg-[#befc65]/20 blur-[48px] pointer-events-none"
          />

          <div className="relative space-y-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-[#befc65]">
                <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Seu corredor agora</span>
              </span>
              <span className="text-xs text-[#a1a1aa]">
                {originShort} → {destShort}
              </span>
            </div>

            <div>
              <h2 className="text-2xl font-normal tracking-tight text-white">
                Trajeto iluminado de {originShort} até {destShort}
              </h2>
              <p className="text-sm text-[#a1a1aa] mt-1">
                Caminho priorizando postes ativos e corredores movimentados da Trindade.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1 border-t border-white/15">
              <div className="pt-3">
                <p className="text-xs text-[#a1a1aa]">Duração</p>
                <p className="text-xl font-medium text-white mt-0.5">
                  ~{brightestRoute.estimatedMinutes} min
                </p>
                <p className="text-xs text-[#a1a1aa]">{brightestRoute.distanceMeters} m</p>
              </div>
              <div className="pt-3">
                <p className="text-xs text-[#a1a1aa]">Iluminação</p>
                <p className="text-xl font-medium text-[#befc65] mt-0.5">
                  {brightestRoute.illuminationPercentage}%
                </p>
                <p className="text-xs text-[#a1a1aa]">índice médio</p>
              </div>
              <div className="pt-3">
                <p className="text-xs text-[#a1a1aa]">Companhia</p>
                <p className="text-xl font-medium text-white mt-0.5">
                  {companionMatches.length} colegas
                </p>
                <p className="text-xs text-[#a1a1aa]">
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
              className="text-lg font-medium text-[#131314]"
            >
              Rotas seguras perto de você
            </h2>
            <span className="text-xs text-[#66646d]">Toque para traçar</span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {quickRoutes.map((item) => (
              <button
                key={`${item.originId}-${item.destId}`}
                type="button"
                onClick={() => handleSelectQuickRoute(item.originId, item.destId, item.title)}
                className="min-w-[232px] max-w-[248px] shrink-0 min-h-[44px] bg-white border border-[#dfe3e6] hover:border-[#131314] rounded-2xl p-4 text-left transition-colors active:scale-[0.98] cursor-pointer flex flex-col justify-between gap-3"
              >
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#befc65] text-[#131314]">
                    <Zap className="w-3 h-3" aria-hidden="true" />
                    <span>{item.route.illuminationPercentage}% iluminada</span>
                  </span>
                  <h3 className="text-base font-medium text-[#131314] mt-2.5">{item.title}</h3>
                  <p className="text-xs text-[#66646d] mt-1">{item.subtitle}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-[#46444a] pt-2 border-t border-[#dfe3e6]">
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
          className="bg-white border border-[#dfe3e6] rounded-[24px] p-5 space-y-4"
        >
          <div className="flex items-start gap-4">
            <div
              aria-hidden="true"
              className="w-10 h-10 rounded-full bg-[#131314] text-white text-sm font-medium flex items-center justify-center shrink-0"
            >
              1
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="explore-rating-heading" className="text-lg font-medium text-[#131314]">
                Avaliar iluminação de um trecho
              </h2>
              <p className="text-sm text-[#46444a] mt-0.5">
                Sua nota de 1 a 5 recalibra o peso das rotas no grafo da UFSC.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="explore-rate-edge"
                className="block text-xs font-medium text-[#66646d] mb-1.5"
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
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#dfe3e6] bg-[#f3f3f4] text-sm text-[#131314] focus:outline-2 focus:outline-[#131314] cursor-pointer"
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
                          ? 'bg-[#131314] text-[#befc65] border-[#131314]'
                          : 'bg-[#f3f3f4] text-[#131314] border-[#dfe3e6] hover:border-[#131314]'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{score}</span>
                    </button>
                  );
                })}
              </div>

              <span className="text-xs text-[#66646d]">
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

        {/* Recent Campus Highlights (Bejamas Ruled List with 40px Index Disks) */}
        <section aria-labelledby="explore-highlights-heading" className="space-y-3">
          <h2 id="explore-highlights-heading" className="text-lg font-medium text-[#131314]">
            Destaques do campus agora
          </h2>

          <div className="bg-white border border-[#dfe3e6] rounded-[24px] px-5 divide-y divide-[#dfe3e6]">
            {/* Row 1: Lamp Posts */}
            <div className="py-4 flex items-start gap-5">
              <div
                aria-hidden="true"
                className="w-10 h-10 rounded-full bg-[#131314] text-white text-sm font-medium flex items-center justify-center shrink-0"
              >
                1
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-base font-medium text-[#131314] inline-flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-[#15803d]" aria-hidden="true" />
                    <span>Rede de postes monitorados</span>
                  </h3>
                  <button
                    type="button"
                    onClick={onOpenLights}
                    className="min-h-[44px] px-3 rounded-full text-xs font-medium border border-[#dfe3e6] text-[#131314] hover:bg-[#f3f3f4] active:scale-[0.97] transition-all cursor-pointer"
                  >
                    Ver postes
                  </button>
                </div>
                <p className="text-sm text-[#46444a] mt-1">
                  {litPostsCount} de {posts.length} postes operando normalmente
                  {burnedPostsCount > 0 ? ` • ${burnedPostsCount} queimado(s) desviando rotas` : ''}.
                </p>
              </div>
            </div>

            {/* Row 2: Latest Incident Report */}
            <div className="py-4 flex items-start gap-5">
              <div
                aria-hidden="true"
                className="w-10 h-10 rounded-full bg-[#131314] text-white text-sm font-medium flex items-center justify-center shrink-0"
              >
                2
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-base font-medium text-[#131314] inline-flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-[#D97706]" aria-hidden="true" />
                    <span>Último registro comunitário</span>
                  </h3>
                  <button
                    type="button"
                    onClick={onOpenReports}
                    className="min-h-[44px] px-3 rounded-full text-xs font-medium border border-[#dfe3e6] text-[#131314] hover:bg-[#f3f3f4] active:scale-[0.97] transition-all cursor-pointer"
                  >
                    Ver denúncias
                  </button>
                </div>
                <p className="text-sm text-[#46444a] mt-1">
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
                className="w-10 h-10 rounded-full bg-[#131314] text-white text-sm font-medium flex items-center justify-center shrink-0"
              >
                3
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-base font-medium text-[#131314] inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#15803d]" aria-hidden="true" />
                    <span>Caminhada acompanhada</span>
                  </h3>
                  <button
                    type="button"
                    onClick={onOpenMap}
                    className="min-h-[44px] px-3 rounded-full text-xs font-medium border border-[#dfe3e6] text-[#131314] hover:bg-[#f3f3f4] active:scale-[0.97] transition-all cursor-pointer"
                  >
                    Ver colegas
                  </button>
                </div>
                <p className="text-sm text-[#46444a] mt-1">
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
