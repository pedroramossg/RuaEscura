import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
} from 'lucide-react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { ArcBottomSheet } from '../ui/ArcBottomSheet';

type PlatformKind = 'ios' | 'android';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface TutorialStep {
  badge: string;
  title: string;
  description: string;
  actionHint: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const IOS_STEPS: readonly TutorialStep[] = [
  {
    badge: 'Passo 1 de 3',
    title: 'Abra no Safari e toque em Compartilhar',
    description:
      'Na barra inferior do Safari (iPhone ou iPad), toque no ícone de compartilhar com a seta para cima.',
    actionHint: 'Toque no ícone ↗ na barra do Safari',
    Icon: Share,
  },
  {
    badge: 'Passo 2 de 3',
    title: 'Escolha "Adicionar à Tela de Início"',
    description:
      'Role o menu de compartilhamento para baixo e toque na opção com o sinal de "+".',
    actionHint: 'Adicionar à Tela de Início',
    Icon: PlusSquare,
  },
  {
    badge: 'Passo 3 de 3',
    title: 'Confirme e use em tela cheia na UFSC',
    description:
      'Toque em "Adicionar" no topo direito. O RuaEscura abre como app nativo, com acesso rápido à noite.',
    actionHint: 'RuaEscura instalado na Home ✓',
    Icon: CheckCircle2,
  },
];

const ANDROID_STEPS: readonly TutorialStep[] = [
  {
    badge: 'Passo 1 de 3',
    title: 'Abra o menu do Chrome (⋮)',
    description:
      'No canto superior direito do Google Chrome no Android, toque nos três pontinhos verticais.',
    actionHint: 'Menu do Chrome ⋮',
    Icon: MoreVertical,
  },
  {
    badge: 'Passo 2 de 3',
    title: 'Toque em "Instalar aplicativo"',
    description:
      'Selecione "Instalar app" ou "Adicionar à tela inicial" para habilitar o modo standalone.',
    actionHint: 'Instalar aplicativo',
    Icon: Download,
  },
  {
    badge: 'Passo 3 de 3',
    title: 'Pronto na sua tela inicial!',
    description:
      'O ícone do RuaEscura aparece junto aos seus apps, com cache offline e rotas em 1 toque.',
    actionHint: 'RuaEscura pronto no Android ✓',
    Icon: CheckCircle2,
  },
];

const APPLE_EASE = [0.23, 1, 0.32, 1] as const;

function detectDefaultPlatform(): PlatformKind {
  if (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)) {
    return 'android';
  }
  return 'ios';
}

export interface PwaInstallTutorialBodyProps {
  dark?: boolean;
  onBack?: () => void;
  onNotify?: (message: string) => void;
}

/**
 * Interactive animated step-by-step onboarding guide teaching iOS & Android PWA installation.
 */
export const PwaInstallTutorialBody: React.FC<PwaInstallTutorialBodyProps> = ({
  dark = false,
  onBack,
  onNotify,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [platform, setPlatform] = useState<PlatformKind>(() => detectDefaultPlatform());
  const [stepIdx, setStepIdx] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      Boolean((navigator as unknown as { standalone?: boolean }).standalone);
    setIsStandalone(Boolean(standalone));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const steps = platform === 'ios' ? IOS_STEPS : ANDROID_STEPS;
  const currentStep = steps[stepIdx] ?? steps[0]!;
  const StepIcon = currentStep.Icon;

  const handleNativePromptInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      onNotify?.('RuaEscura instalado como aplicativo!');
      setStepIdx(2);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="space-y-4 pt-1 pb-2" data-testid="pwa-install-tutorial">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] inline-flex items-center gap-1 -ml-1 px-2 rounded-full text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--bg-fill-secondary)] cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Voltar para Perfil</span>
        </button>
      )}

      {/* Platform Switcher: iPhone (Safari) | Android (Chrome) */}
      <div
        role="group"
        aria-label="Selecionar sistema do celular"
        className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[var(--bg-fill-secondary)] border border-[var(--separator)]"
      >
        {(
          [
            { id: 'ios', label: 'iPhone (Safari)' },
            { id: 'android', label: 'Android (Chrome)' },
          ] as const
        ).map((item) => {
          const active = platform === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setPlatform(item.id);
                setStepIdx(0);
              }}
              className={`min-h-[44px] rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                active
                  ? 'bg-[var(--bg-elevated)] text-[var(--label-primary)] shadow-xs border border-[var(--separator)]'
                  : 'text-[var(--label-secondary)] hover:text-[var(--label-primary)]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Animated Simulated Phone Stage (matches Onboarding feel) */}
      <div
        className={`relative rounded-[26px] border p-4 sm:p-5 overflow-hidden ${
          dark
            ? 'bg-gradient-to-b from-[#0E1826] to-[#0A0F17] border-white/12'
            : 'bg-gradient-to-b from-[#EFF6FF] via-[#F8FAFC] to-[#FFFFFF] border-[#D5E0EE]'
        }`}
      >
        {/* Subtle progress pills */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#2563EB]/12 text-[var(--accent-primary)]">
            {currentStep.badge}
          </span>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {steps.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  idx === stepIdx
                    ? 'w-5 bg-[var(--accent-primary)]'
                    : 'w-1.5 bg-[var(--label-tertiary)]/35'
                }`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${platform}-${stepIdx}`}
            initial={prefersReducedMotion ? false : { opacity: 0, x: 18, filter: 'blur(4px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, x: -14 }}
            transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.26, ease: APPLE_EASE }}
            className="space-y-4"
          >
            {/* Interactive Mini Phone Preview */}
            <div
              className={`mx-auto max-w-[260px] rounded-[22px] border p-3.5 text-center space-y-2.5 shadow-sm ${
                dark
                  ? 'bg-[#141D2B]/90 border-white/15'
                  : 'bg-white border-[#CBD5E1]/70'
              }`}
            >
              <div className="flex items-center justify-center">
                <motion.div
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : { scale: [1, 1.08, 1] }
                  }
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    stepIdx === 2
                      ? 'bg-[#10B981]/18 text-[#10B981]'
                      : 'bg-[#2563EB]/14 text-[var(--accent-primary)]'
                  }`}
                >
                  <StepIcon className="w-6 h-6" aria-hidden="true" />
                </motion.div>
              </div>
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  stepIdx === 2
                    ? 'bg-[#10B981]/15 text-[#10B981]'
                    : 'bg-[var(--bg-fill-secondary)] text-[var(--label-primary)]'
                }`}
              >
                <span>{currentStep.actionHint}</span>
              </div>
            </div>

            <div className="text-center space-y-1.5 px-1">
              <h3 className="text-base font-semibold text-[var(--label-primary)]">
                {currentStep.title}
              </h3>
              <p className="text-xs sm:text-sm text-[var(--label-secondary)] leading-relaxed">
                {currentStep.description}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Native Android/Chrome 1-tap Prompt Button when available */}
      {deferredPrompt && (
        <button
          type="button"
          onClick={() => void handleNativePromptInstall()}
          className="w-full min-h-[46px] px-4 rounded-full bg-[#10B981] text-white text-sm font-semibold hover:bg-[#059669] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Instalar agora com 1 toque</span>
        </button>
      )}

      {isStandalone && (
        <p className="text-xs font-medium text-center text-[#10B981]">
          Você já está usando o RuaEscura instalado como app!
        </p>
      )}

      {/* Stepper Controls */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => setStepIdx((prev) => Math.max(0, prev - 1))}
          disabled={stepIdx === 0}
          className="min-h-[44px] px-4 rounded-full border border-[var(--separator)] bg-[var(--bg-fill-secondary)] text-xs font-semibold text-[var(--label-primary)] inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Anterior</span>
        </button>

        {stepIdx < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setStepIdx((prev) => Math.min(steps.length - 1, prev + 1))}
            className="flex-1 min-h-[44px] px-4 rounded-full bg-[#111827] text-white text-xs font-semibold hover:bg-[#1F2937] active:scale-[0.98] inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Próximo passo</span>
            <ChevronRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setStepIdx(0);
              onNotify?.('Tutorial concluído! Adicione na tela inicial para acesso rápido.');
            }}
            className="flex-1 min-h-[44px] px-4 rounded-full bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1D4ED8] active:scale-[0.98] inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Smartphone className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Rever passo a passo</span>
          </button>
        )}
      </div>
    </div>
  );
};

export interface PwaInstallGuideSheetProps {
  open: boolean;
  onClose: () => void;
  dark?: boolean;
  onNotify?: (message: string) => void;
}

export const PwaInstallGuideSheet: React.FC<PwaInstallGuideSheetProps> = ({
  open,
  onClose,
  dark = false,
  onNotify,
}) => {
  if (!open) return null;

  return (
    <ArcBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      dark={dark}
      detents={[0.84, 0.94]}
      initialDetent={0}
      title="Instalar app no celular"
      description="Adicione o RuaEscura à tela inicial (PWA)"
      closeLabel="Fechar tutorial PWA"
    >
      <PwaInstallTutorialBody dark={dark} onNotify={onNotify} />
    </ArcBottomSheet>
  );
};

