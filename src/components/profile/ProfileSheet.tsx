import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Clock,
  LogOut,
  Moon,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { useCampusStore } from '../../hooks/useCampusStore';
import { UFSC_LANDMARKS } from '../../data/ufscTrindade';
import { maskCpf } from '../../security/schemas';
import { getPerfSnapshot } from '../../utils/perfMonitor';
import { BottomSheet, SheetDetent } from '../ui/BottomSheet';
import { DropletMascot } from '../mascot/DropletMascot';

export interface ProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
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
 * Only renders its BottomSheet when opened. Exposes Gov.br identity with strictly masked CPF,
 * frequent UFSC buildings & time slot, Night Map & Haptics toggles,
 * and distinct "Encerrar sessão Gov.br" vs "Resetar dados demo" controls.
 */
export const ProfileSheet: React.FC<ProfileSheetProps> = ({
  isOpen,
  onClose,
  onOpenWelcomeBack,
  returnFocusRef,
  onNotify,
}) => {
  const {
    userSession,
    selectedBuildings,
    timeSlot,
    isNightMap,
    hapticsEnabled,
    toggleNightMap,
    setHapticsEnabled,
    resetSessionOnly,
    resetAllDemoData,
  } = useCampusStore();

  const [detent, setDetent] = useState<SheetDetent>('expanded');

  const handleClose = useCallback(() => {
    onClose();
    window.requestAnimationFrame(() => {
      returnFocusRef?.current?.focus();
    });
  }, [onClose, returnFocusRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

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
    resetSessionOnly();
    onNotify?.('Sessão Gov.br encerrada. Registros do campus mantidos.');
    onClose();
  };

  const handleResetAllDemo = () => {
    resetAllDemoData();
    onNotify?.('Dados de demonstração restaurados ao padrão inicial.');
    onClose();
  };

  return (
    <BottomSheet
      detent={detent}
      onDetentChange={setDetent}
      dark={false}
      isModal={true}
      grabberLabel="Perfil e Privacidade"
    >
      <div className="space-y-5 pb-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <DropletMascot
              state={isNightMap ? 'sleep' : 'play'}
              expression={isNightMap ? 'somnolent' : 'heureux'}
              inkColor="#2563EB"
              paperColor="#FFFFFF"
              notifColor="#10B981"
              size={52}
              interactive
              ariaLabel="Mascote do perfil"
            />
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
                <span>Gov.br verificado</span>
              </span>
              <h2 className="text-xl font-semibold text-[#111827] mt-1.5">
                Perfil & Privacidade
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar perfil"
            className="min-w-[44px] min-h-[44px] rounded-full inline-flex items-center justify-center border border-[#E5EAF4] text-[#111827] hover:bg-[#F8FAFC] active:scale-[0.97] transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Identity Card (Masked CPF Only) */}
        <div className="rounded-2xl bg-[#F8FAFC] border border-[#E5EAF4] p-4 space-y-3">
          <div>
            <p className="text-base font-semibold text-[#111827]">
              {userSession?.name ?? 'Estudante UFSC'}
            </p>
            <p className="text-sm text-[#4B5563]">
              {userSession?.affiliation ?? 'UFSC Campus Trindade'}
            </p>
          </div>

          <div className="pt-2.5 border-t border-[#E5EAF4] flex items-center justify-between text-xs">
            <span className="text-[#6B7280]">CPF verificado (mascarado)</span>
            <span className="font-mono font-medium text-[#111827]">{safeCpf}</span>
          </div>

          <div className="pt-2.5 border-t border-[#E5EAF4] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#6B7280]">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Horário habitual</span>
              </span>
              <span className="font-medium text-[#111827]">{timeSlot}</span>
            </div>

            <div className="flex items-start justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#6B7280] shrink-0 pt-1">
                <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Prédios frequentes</span>
              </span>
              <div className="flex flex-wrap justify-end gap-1.5">
                {buildingLabels.map((label) => (
                  <span
                    key={label}
                    className="px-2.5 py-0.5 rounded-full bg-white border border-[#E5EAF4] text-xs font-medium text-[#111827]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Preferences Toggles */}
        <div className="rounded-2xl bg-white border border-[#E5EAF4] divide-y divide-[#E5EAF4]">
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Moon className="w-4 h-4 text-[#2563EB] shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-[#111827]">Luz Noturna no mapa</p>
                <p className="text-xs text-[#6B7280]">
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
                isNightMap ? 'bg-[#2563EB] justify-end' : 'bg-[#CBD5E1] justify-start'
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-white shadow-xs transition-transform" />
            </button>
          </div>

          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Smartphone className="w-4 h-4 text-[#2563EB] shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-[#111827]">
                  Feedback tátil (hápticos)
                </p>
                <p className="text-xs text-[#6B7280]">
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
                hapticsEnabled ? 'bg-[#2563EB] justify-end' : 'bg-[#CBD5E1] justify-start'
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-white shadow-xs transition-transform" />
            </button>
          </div>
        </div>

        {/* Local Web Vitals & Span Telemetry (Read-only, zero PII) */}
        <div
          aria-label="Telemetria local de desempenho"
          className="rounded-2xl bg-[#F8FAFC] border border-[#E5EAF4] px-4 py-3 text-xs text-[#4B5563] flex items-center justify-between gap-2 flex-wrap"
        >
          <span>
            Telemetria RUM:{' '}
            {typeof perf.vitals.LCP === 'number' ? `LCP ${Math.round(perf.vitals.LCP)}ms` : 'LCP —'} •{' '}
            {typeof perf.vitals.INP === 'number' ? `INP ${Math.round(perf.vitals.INP)}ms` : 'INP —'}
          </span>
          <span className="font-mono text-[11px] text-[#6B7280]">
            {perf.totalRecorded} spans ({perf.slowCount} lentos)
          </span>
        </div>

        {/* Distinct Account Reset vs Full Demo Reset */}
        <div className="space-y-2.5 pt-1">
          {onOpenWelcomeBack && (
            <button
              type="button"
              onClick={onOpenWelcomeBack}
              className="w-full min-h-[44px] px-4 rounded-full border border-[#DBEAFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] active:scale-[0.97] text-sm font-medium text-[#2563EB] inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Abrir tela de boas-vindas</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetSessionOnly}
            className="w-full min-h-[44px] px-4 rounded-full border border-[#E5EAF4] bg-white hover:bg-[#F8FAFC] active:scale-[0.97] text-sm font-medium text-[#111827] inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Encerrar sessão Gov.br</span>
          </button>

          <button
            type="button"
            onClick={handleResetAllDemo}
            className="w-full min-h-[44px] px-4 rounded-full border border-[#D70015]/30 bg-[#D70015]/5 hover:bg-[#D70015]/10 active:scale-[0.97] text-sm font-medium text-[#D70015] inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Resetar dados demo</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
