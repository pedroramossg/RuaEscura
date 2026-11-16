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
import { BottomSheet, SheetDetent } from '../ui/BottomSheet';

export interface ProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
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
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#131314] text-[#befc65]">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Gov.br verificado</span>
            </span>
            <h2 className="text-xl font-medium text-[#131314] mt-2">
              Perfil & Privacidade
            </h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar perfil"
            className="min-w-[44px] min-h-[44px] rounded-full inline-flex items-center justify-center border border-[#dfe3e6] text-[#131314] hover:bg-[#f3f3f4] active:scale-[0.97] transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Identity Card (Masked CPF Only) */}
        <div className="rounded-2xl bg-[#f3f3f4] border border-[#dfe3e6] p-4 space-y-3">
          <div>
            <p className="text-base font-medium text-[#131314]">
              {userSession?.name ?? 'Estudante UFSC'}
            </p>
            <p className="text-sm text-[#46444a]">
              {userSession?.affiliation ?? 'UFSC Campus Trindade'}
            </p>
          </div>

          <div className="pt-2.5 border-t border-[#dfe3e6] flex items-center justify-between text-xs">
            <span className="text-[#66646d]">CPF verificado (mascarado)</span>
            <span className="font-mono font-medium text-[#131314]">{safeCpf}</span>
          </div>

          <div className="pt-2.5 border-t border-[#dfe3e6] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#66646d]">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Horário habitual</span>
              </span>
              <span className="font-medium text-[#131314]">{timeSlot}</span>
            </div>

            <div className="flex items-start justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#66646d] shrink-0 pt-1">
                <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Prédios frequentes</span>
              </span>
              <div className="flex flex-wrap justify-end gap-1.5">
                {buildingLabels.map((label) => (
                  <span
                    key={label}
                    className="px-2.5 py-0.5 rounded-full bg-white border border-[#dfe3e6] text-xs font-medium text-[#131314]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Preferences Toggles */}
        <div className="rounded-2xl bg-white border border-[#dfe3e6] divide-y divide-[#dfe3e6]">
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Moon className="w-4 h-4 text-[#131314] shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-[#131314]">Luz Noturna no mapa</p>
                <p className="text-xs text-[#66646d]">
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
                isNightMap ? 'bg-[#131314] justify-end' : 'bg-[#dfe3e6] justify-start'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full transition-transform ${
                  isNightMap ? 'bg-[#befc65]' : 'bg-white'
                }`}
              />
            </button>
          </div>

          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Smartphone className="w-4 h-4 text-[#131314] shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-[#131314]">
                  Feedback tátil (hápticos)
                </p>
                <p className="text-xs text-[#66646d]">
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
                hapticsEnabled ? 'bg-[#131314] justify-end' : 'bg-[#dfe3e6] justify-start'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full transition-transform ${
                  hapticsEnabled ? 'bg-[#befc65]' : 'bg-white'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Distinct Account Reset vs Full Demo Reset */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={handleResetSessionOnly}
            className="w-full min-h-[44px] px-4 rounded-full border border-[#dfe3e6] bg-white hover:bg-[#f3f3f4] active:scale-[0.97] text-sm font-medium text-[#131314] inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
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
