import React, { useCallback, useMemo, useState } from 'react';
import {
  Building2,
  Clock,
  LogOut,
  Moon,
  RotateCcw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useCampusStore } from '../../hooks/useCampusStore';
import { UFSC_LANDMARKS } from '../../data/ufscTrindade';
import { maskCpf } from '../../security/schemas';
import { getPerfSnapshot } from '../../utils/perfMonitor';
import { ArcBottomSheet } from '../ui/ArcBottomSheet';
import { SfIcon } from '../ui/SfIcon';
import { DropletMascot } from '../mascot/DropletMascot';

export interface ProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  dark?: boolean;
  onOpenWelcomeBack?: () => void;
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>;
  onNotify?: (message: string) => void;
}

function toSafeMaskedCpf(raw?: string | null): string {
  if (!raw) return '***.***.***-**';
  if (/^\*\*\*\.\d{3}\.\d{3}-\*\*$/.test(raw)) {
    return raw;
  }
  return maskCpf(raw);
}

/**
 * Profile & Privacy Sheet (Single-Sheet compliant):
 * Uses Radix-powered ArcBottomSheet with native detents, scrim, swipe-down, Escape & focus trap.
 * Exposes Gov.br identity with strictly masked CPF, frequent UFSC buildings & time slot,
 * Night Map & Haptics toggles, and distinct "Encerrar sessão Gov.br" vs "Resetar dados demo" controls.
 */
export const ProfileSheet: React.FC<ProfileSheetProps> = ({
  isOpen,
  onClose,
  dark,
  onOpenWelcomeBack,
  returnFocusRef,
  onNotify,
}) => {
  const {
    userSession,
    selectedBuildings,
    timeSlot,
    isNightMap,
    darkMode,
    hapticsEnabled,
    toggleNightMap,
    toggleDarkMode,
    setHapticsEnabled,
    resetSessionOnly,
    resetAllDemoData,
  } = useCampusStore();

  const isDarkSurface = dark ?? (darkMode || isNightMap);

  const [confirmReset, setConfirmReset] = useState(false);

  const handleClose = useCallback(() => {
    setConfirmReset(false);
    onClose();
    window.requestAnimationFrame(() => {
      returnFocusRef?.current?.focus();
    });
  }, [onClose, returnFocusRef]);

  const buildingLabels = useMemo(() => {
    const landmarkMap = new Map(UFSC_LANDMARKS.map((n) => [n.id, n.shortName]));
    return selectedBuildings.map((id) => landmarkMap.get(id) ?? id.toUpperCase());
  }, [selectedBuildings]);

  if (!isOpen) {
    return null;
  }

  const safeCpf = toSafeMaskedCpf(userSession?.cpfMasked);
  const perf = getPerfSnapshot();

  const handleResetSessionOnly = () => {
    setConfirmReset(false);
    resetSessionOnly();
    onNotify?.('Sessão Gov.br encerrada. Registros do campus mantidos.');
    onClose();
  };

  const handleResetAllDemo = () => {
    setConfirmReset(false);
    resetAllDemoData();
    onNotify?.('Dados de demonstração restaurados ao padrão inicial.');
    onClose();
  };

  return (
    <ArcBottomSheet
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
      dark={isDarkSurface}
      detents={[0.82, 0.94]}
      initialDetent={0}
      title="Perfil & Privacidade"
      description="Conta verificada UFSC Trindade"
      closeLabel="Fechar perfil"
    >
      <div className="space-y-5 pt-1 pb-4">
        {/* Identity Card (Mascot + Gov.br Badge + Masked CPF Only) */}
        <div className="ios-grouped-section ios-grouped-divider">
          <div className="px-4 py-3.5 flex items-center gap-3">
            <DropletMascot
              state={isNightMap ? 'sleep' : 'play'}
              expression={isNightMap ? 'somnolent' : 'heureux'}
              inkColor={isDarkSurface ? '#5EC2F3' : '#2563EB'}
              paperColor="var(--bg-elevated)"
              notifColor="#10B981"
              size={52}
              interactive
              ariaLabel="Mascote do perfil"
            />
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-fill-secondary)] text-[var(--accent-primary)] border border-[var(--separator)]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
                <span>Gov.br verificado</span>
              </span>
              <p className="text-base font-semibold text-[var(--label-primary)] mt-1.5 truncate">
                {userSession?.name ?? 'Estudante UFSC'}
              </p>
              <p className="text-sm text-[var(--label-secondary)] truncate">
                {userSession?.affiliation ?? 'UFSC Campus Trindade'}
              </p>
            </div>
          </div>

          <div className="px-4 py-3 flex items-center justify-between text-xs">
            <span className="text-[var(--label-tertiary)]">CPF verificado (mascarado)</span>
            <span className="font-mono font-medium text-[var(--label-primary)]">{safeCpf}</span>
          </div>

          <div className="px-4 py-3 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-[var(--label-tertiary)]">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Horário habitual</span>
            </span>
            <span className="font-medium text-[var(--label-primary)]">{timeSlot}</span>
          </div>

          <div className="px-4 py-3 flex items-start justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 text-[var(--label-tertiary)] shrink-0 pt-1">
              <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Prédios frequentes</span>
            </span>
            <div className="flex flex-wrap justify-end gap-1.5">
              {buildingLabels.map((label) => (
                <span
                  key={label}
                  className="px-2.5 py-0.5 rounded-full bg-[var(--bg-fill-secondary)] text-xs font-medium text-[var(--label-primary)]"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Preferences Toggles */}
        <div className="ios-grouped-section ios-grouped-divider">
          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <SfIcon
                name={darkMode ? 'moon' : 'sun'}
                filled
                size={16}
                className="text-[var(--accent-primary)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--label-primary)]">Modo Escuro</p>
                <p className="text-xs text-[var(--label-secondary)]">
                  Tema Opal escuro em Onyx e vidro fosco
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={darkMode}
              aria-label="Modo Escuro"
              onClick={toggleDarkMode}
              className={`min-w-[52px] min-h-[44px] px-1.5 inline-flex items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                darkMode ? 'bg-[#2563EB] justify-end' : 'bg-[#64748B]/40 justify-start'
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-white shadow-xs transition-transform" />
            </button>
          </div>

          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Moon className="w-4 h-4 text-[var(--accent-primary)] shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-[var(--label-primary)]">Luz Noturna no mapa</p>
                <p className="text-xs text-[var(--label-secondary)]">
                  Realce escuro com halos nos postes ativos
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isNightMap}
              aria-label="Luz Noturna no mapa"
              onClick={toggleNightMap}
              className={`min-w-[52px] min-h-[44px] px-1.5 inline-flex items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                isNightMap ? 'bg-[#2563EB] justify-end' : 'bg-[#64748B]/40 justify-start'
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-white shadow-xs transition-transform" />
            </button>
          </div>

          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Smartphone className="w-4 h-4 text-[var(--accent-primary)] shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-[var(--label-primary)]">
                  Feedback tátil (hápticos)
                </p>
                <p className="text-xs text-[var(--label-secondary)]">
                  Vibração sutil em alertas e atualizações
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={hapticsEnabled}
              aria-label="Feedback tátil (hápticos)"
              onClick={() => setHapticsEnabled(!hapticsEnabled)}
              className={`min-w-[52px] min-h-[44px] px-1.5 inline-flex items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                hapticsEnabled ? 'bg-[#2563EB] justify-end' : 'bg-[#64748B]/40 justify-start'
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-white shadow-xs transition-transform" />
            </button>
          </div>
        </div>

        {/* Local Web Vitals & Span Telemetry (Read-only, zero PII) */}
        <div
          aria-label="Telemetria local de desempenho"
          className="ios-grouped-section px-4 py-3 text-xs text-[var(--label-secondary)] flex items-center justify-between gap-2 flex-wrap"
        >
          <span>
            Telemetria RUM:{' '}
            {typeof perf.vitals.LCP === 'number' ? `LCP ${Math.round(perf.vitals.LCP)}ms` : 'LCP —'} •{' '}
            {typeof perf.vitals.INP === 'number' ? `INP ${Math.round(perf.vitals.INP)}ms` : 'INP —'}
          </span>
          <span className="font-mono text-[11px] text-[var(--label-tertiary)]">
            {perf.totalRecorded} spans ({perf.slowCount} lentos)
          </span>
        </div>

        {/* Distinct Account Reset vs Full Demo Reset */}
        <div className="ios-grouped-section ios-grouped-divider">
          {onOpenWelcomeBack && (
            <button
              type="button"
              onClick={onOpenWelcomeBack}
              className="w-full min-h-[48px] px-4 py-3 text-sm font-medium text-[var(--accent-primary)] hover:bg-[var(--bg-fill-secondary)]/60 active:bg-[var(--bg-fill-secondary)] inline-flex items-center justify-start gap-2.5 text-left transition-colors cursor-pointer"
            >
              <span>Abrir tela de boas-vindas</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetSessionOnly}
            className="w-full min-h-[48px] px-4 py-3 text-sm font-medium text-[var(--label-primary)] hover:bg-[var(--bg-fill-secondary)]/60 active:bg-[var(--bg-fill-secondary)] inline-flex items-center justify-start gap-2.5 text-left transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-[var(--label-secondary)] shrink-0" aria-hidden="true" />
            <span>Encerrar sessão Gov.br</span>
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="w-full min-h-[48px] px-4 py-3 text-sm font-medium text-[#EF4444] hover:bg-[#EF4444]/8 active:bg-[#EF4444]/14 inline-flex items-center justify-start gap-2.5 text-left transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Resetar dados demo</span>
            </button>
          ) : (
            <div className="px-4 py-3.5 space-y-2.5 bg-[#EF4444]/6">
              <p className="text-xs font-medium text-[var(--label-primary)] leading-snug">
                Restaurar postes, rotas e denúncias ao estado inicial?
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleResetAllDemo}
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-full bg-[#EF4444] text-white text-xs sm:text-sm font-semibold hover:bg-[#DC2626] active:scale-[0.98] inline-flex items-center justify-center gap-1.5 transition-[transform,background-color] duration-150 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Confirmar restauração</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[44px] px-4 py-2 rounded-full bg-[var(--bg-fill-secondary)] text-[var(--label-primary)] text-xs sm:text-sm font-medium hover:bg-[var(--bg-fill-secondary)]/80 active:scale-[0.98] inline-flex items-center justify-center transition-[transform,background-color] duration-150 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ArcBottomSheet>
  );
};
