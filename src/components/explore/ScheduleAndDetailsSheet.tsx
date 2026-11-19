import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Lightbulb,
  MapPin,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { ArcBottomSheet } from '../ui/ArcBottomSheet';
import { Scrub, formatMinutesToHHMM } from '../ui/TimeScrubber';
import { SlideConfirm } from '../ui/SlideToConfirm';
import { PillButton } from '../ui/PillButton';
import { UFSC_LANDMARKS } from '../../data/ufscTrindade';
import { TrioCharacterAvatar, TrioMascotStack, pickTrioVariant } from '../mascot/TrioMascotBadge';
import type { CompanionMatch, EdgeRatingSummary, RouteResult } from '../../types/campus';

export type ExploreSheetMode = 'schedule' | 'details' | null;

export interface ScheduleAndDetailsSheetProps {
  mode: ExploreSheetMode;
  onClose: () => void;
  onSwitchMode: (mode: 'schedule' | 'details') => void;
  originShort: string;
  destShort: string;
  route: RouteResult;
  edgeRatings: Record<string, EdgeRatingSummary>;
  companions: CompanionMatch[];
  scheduledTime?: string;
  onConfirmDeparture: (timeHHMM: string) => void;
  onOpenMap: () => void;
}

const PRESET_DEPARTURES = [
  { label: '21:00', minutes: 21 * 60 },
  { label: '21:30', minutes: 21 * 60 + 30 },
  { label: '22:00', minutes: 22 * 60 },
  { label: '22:30', minutes: 22 * 60 + 30 },
];

function parseHHMMToMinutes(time?: string): number {
  if (!time) return 21 * 60 + 30;
  const [h, m] = time.split(':').map(Number);
  if (Number.isFinite(h) && Number.isFinite(m)) {
    return h * 60 + m;
  }
  return 21 * 60 + 30;
}

export const ScheduleAndDetailsSheet: React.FC<ScheduleAndDetailsSheetProps> = ({
  mode,
  onClose,
  onSwitchMode,
  originShort,
  destShort,
  route,
  edgeRatings,
  companions,
  scheduledTime,
  onConfirmDeparture,
  onOpenMap,
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(() =>
    parseHHMMToMinutes(scheduledTime)
  );
  const [scrubKey, setScrubKey] = useState(0);
  const [justConfirmedTime, setJustConfirmedTime] = useState<string | null>(null);
  const [isPostsAccordionOpen, setIsPostsAccordionOpen] = useState(true);
  const prevModeRef = React.useRef<ExploreSheetMode>(null);

  useEffect(() => {
    if (mode === 'schedule' && prevModeRef.current !== 'schedule') {
      setSelectedMinutes(parseHHMMToMinutes(scheduledTime));
      setJustConfirmedTime(null);
      setScrubKey((k) => k + 1);
    }
    prevModeRef.current = mode;
  }, [mode, scheduledTime]);

  const currentHHMM = formatMinutesToHHMM(selectedMinutes);
  const etaMinutes = (selectedMinutes + Math.max(1, route.estimatedMinutes)) % 1440;
  const etaHHMM = formatMinutesToHHMM(etaMinutes);

  const landmarkNames = new Map(UFSC_LANDMARKS.map((n) => [n.id, n.shortName]));

  const handlePresetClick = (minutes: number) => {
    setSelectedMinutes(minutes);
    setJustConfirmedTime(null);
    setScrubKey((k) => k + 1);
  };

  const handleSlideConfirm = () => {
    onConfirmDeparture(currentHHMM);
    setJustConfirmedTime(currentHHMM);
  };

  const isSchedule = mode === 'schedule';

  return (
    <ArcBottomSheet
      open={mode !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={isSchedule ? 'Marcar horário para sair' : `Detalhes • ${originShort} → ${destShort}`}
      description={
        isSchedule
          ? 'Arraste a régua abaixo para escolher quando você sai pela Trindade'
          : `${route.distanceMeters} m • ~${route.estimatedMinutes} min • ${route.posts.length} postes monitorados`
      }
      detents={[0.68, 0.92]}
      initialDetent={0}
      closeLabel="Fechar painel"
    >
      {isSchedule ? (
        <div className="space-y-5 pt-1">
          {/* Corridor & Predicted Arrival Summary (t-stagger transitions.dev) */}
          <div className="t-stagger is-shown rounded-2xl bg-[var(--bg-fill-secondary)] border border-[var(--separator)] p-4 space-y-2">
            <div className="t-stagger-line flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--label-primary)]">
                <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                <span>
                  {originShort} → {destShort}
                </span>
              </span>
              <span className="text-xs font-medium text-[#10B981] bg-[var(--bg-elevated)] px-2.5 py-0.5 rounded-full border border-[#10B981]/35">
                Chegada prevista ~{etaHHMM}
              </span>
            </div>
            <p className="t-stagger-line t-stagger-line--2 text-xs text-[var(--label-secondary)] flex items-center gap-2">
              <TrioMascotStack size={20} />
              <span>
                {companions.length === 1
                  ? '1 colega confirmado na rota próximo a essa janela de saída.'
                  : companions.length > 1
                    ? `${companions.length} colegas confirmados na rota próximos a essa janela de saída.`
                    : 'Sua saída fica visível apenas para colegas verificados da UFSC.'}
              </span>
            </p>
          </div>

          {/* Bencho TimeScrubber (MIT) */}
          <div className="flex flex-col items-center gap-3">
            <Scrub
              key={scrubKey}
              format="24h"
              step="15"
              momentum={55}
              corner={20}
              start={selectedMinutes}
              onChange={(m) => {
                setSelectedMinutes(m);
                setJustConfirmedTime(null);
              }}
            />

            {/* Quick Time Chips (>=44px accessible touch target fallback) */}
            <div
              role="group"
              aria-label="Atalhos de horário"
              className="flex flex-wrap items-center justify-center gap-2"
            >
              {PRESET_DEPARTURES.map((preset) => {
                const active = currentHHMM === preset.label;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handlePresetClick(preset.minutes)}
                    className={`min-h-[44px] px-3.5 rounded-full text-xs font-semibold tabular-nums transition-colors duration-150 cursor-pointer border ${
                      active
                        ? 'bg-[var(--label-primary)] text-[var(--bg-elevated)] border-[var(--label-primary)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--label-secondary)] border-[var(--separator)] hover:bg-[var(--bg-fill-secondary)]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bencho SlideToConfirm + Transitions.dev Success Check Feedback */}
          <div className="flex flex-col items-center gap-3 pt-1">
            <SlideConfirm
              width={300}
              corner={28}
              speed={55}
              label={`Deslize p/ sair às ${currentHHMM}`}
              confirmedLabel={`Marcado • ${currentHHMM}`}
              onConfirm={handleSlideConfirm}
            />

            {justConfirmedTime && (
              <div
                role="status"
                className="w-full max-w-[300px] rounded-2xl bg-[#10B981]/14 border border-[#10B981]/35 p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="t-success-check text-[#10B981] shrink-0" data-state="in">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M4 10.5l4 4 8-8"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--label-primary)]">
                      Saída marcada para {justConfirmedTime}
                    </p>
                    <p className="text-[11px] text-[var(--label-secondary)] truncate">
                      Corredor {originShort} → {destShort} pronto no Mapa
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenMap();
                  }}
                  className="min-h-[36px] px-3 rounded-full bg-[#059669] text-white text-[11px] font-semibold shrink-0 hover:bg-[#047857] cursor-pointer"
                >
                  Mapa
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => onSwitchMode('details')}
              className="min-h-[44px] text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
            >
              Ver postes e trechos desta rota
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Illumination Alert or Safe Status Banner */}
          <div
            className={`rounded-2xl p-4 border flex items-start gap-3 ${
              route.hasDarkWarning
                ? 'bg-[#F59E0B]/14 border-[#F59E0B]/35 text-[var(--label-primary)]'
                : 'bg-[var(--bg-fill-secondary)] border-[var(--separator)] text-[var(--label-primary)]'
            }`}
          >
            {route.hasDarkWarning ? (
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-[#D97706]" aria-hidden="true" />
            ) : (
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-[var(--accent-primary)]" aria-hidden="true" />
            )}
            <div className="text-xs leading-relaxed">
              <p className="font-semibold">
                {route.hasDarkWarning
                  ? 'Trecho com iluminação reduzida detectada'
                  : 'Rota priorizando calçadas iluminadas da Trindade'}
              </p>
              <p className="text-[var(--label-secondary)] mt-0.5">
                {route.posts.filter((p) => p.status === 'aceso').length} de {route.posts.length}{' '}
                postes ativos agora ao longo de {route.edges.length} segmentos.
              </p>
            </div>
          </div>

          {/* Segments List */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
              Segmentos do caminho
            </h3>
            <div className="space-y-2">
              {route.edges.map((edge) => {
                const fromName = landmarkNames.get(edge.from) ?? edge.from.toUpperCase();
                const toName = landmarkNames.get(edge.to) ?? edge.to.toUpperCase();
                const summary = edgeRatings[edge.id];
                return (
                  <div
                    key={edge.id}
                    className="rounded-xl bg-[var(--bg-fill-secondary)] border border-[var(--separator)] px-3.5 py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--label-primary)] truncate">
                        {fromName} → {toName}
                      </p>
                      <p className="text-[11px] text-[var(--label-secondary)]">
                        {edge.distance} m • base {edge.baseIllumination}% iluminada
                      </p>
                    </div>
                    {summary && (
                      <span className="text-xs font-semibold text-[var(--label-primary)] tabular-nums shrink-0">
                        ★ {summary.averageRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transitions.dev Accordion for Lamp Posts on Route */}
          <div
            className="t-acc rounded-2xl border border-[var(--separator)] bg-[var(--bg-elevated)] overflow-hidden"
            data-open={isPostsAccordionOpen ? 'true' : 'false'}
          >
            <button
              type="button"
              onClick={() => setIsPostsAccordionOpen((o) => !o)}
              aria-expanded={isPostsAccordionOpen}
              className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between text-xs font-semibold text-[var(--label-primary)] hover:bg-[var(--bg-elevated-secondary)] cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
                <span>Postes monitorados no trajeto ({route.posts.length})</span>
              </span>
              <span className="t-acc-chevron" aria-hidden="true">
                <ChevronDown className="w-4 h-4 text-[var(--label-tertiary)]" />
              </span>
            </button>

            <div className="t-acc-panel">
              <div className="t-acc-panel-inner border-t border-[var(--separator)] px-4 py-2.5 space-y-2">
                {route.posts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between gap-2 text-xs py-1"
                  >
                    <span className="text-[var(--label-secondary)] truncate">{post.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
                        post.status === 'aceso'
                          ? 'bg-[#10B981]/15 text-[#10B981]'
                          : post.status === 'oscilando'
                            ? 'bg-[#F59E0B]/15 text-[#D97706]'
                            : 'bg-[#EF4444]/15 text-[#EF4444]'
                      }`}
                    >
                      {post.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Group Companions */}
          <div className="rounded-2xl bg-[var(--bg-fill-secondary)] border border-[var(--separator)] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--label-primary)]">
                <TrioMascotStack size={20} />
                <span>Colegas confirmados na rota ({companions.length})</span>
              </span>
              {scheduledTime && (
                <span className="text-[11px] font-semibold text-[var(--accent-primary)]">
                  Saída {scheduledTime}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {companions.slice(0, 4).map((c, idx) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--separator)] text-[11px] font-medium text-[var(--label-primary)] shadow-2xs"
                >
                  <TrioCharacterAvatar variant={pickTrioVariant(idx)} size={16} />
                  <span>{c.name.split(' ')[0]}</span>
                  <span className="text-[var(--label-secondary)]">• {c.departureTime}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Sheet Actions */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onSwitchMode('schedule')}
              className="min-h-[44px] flex-1 px-4 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-fill-secondary)] border border-[var(--separator)] text-xs font-semibold text-[var(--label-primary)] inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
              <span>{scheduledTime ? `Mudar saída (${scheduledTime})` : 'Marcar horário'}</span>
            </button>
            <PillButton
              variant="lime"
              size="compact"
              onClick={() => {
                onClose();
                onOpenMap();
              }}
              className="flex-1 font-semibold gap-1.5"
            >
              <span>Abrir rota no Mapa</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </PillButton>
          </div>
        </div>
      )}
    </ArcBottomSheet>
  );
};
