import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LayoutGroup, motion, AnimatePresence, useIsPresent, type Variants, type Transition } from 'motion/react';
import {
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Clock,
  Moon,
  Sun,
  Users,
  Lightbulb,
  ArrowLeft,
  Sparkles,
  LockOpen,
} from 'lucide-react';
import { useCampusStore } from '../../hooks/useCampusStore';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { PillButton } from '../ui/PillButton';
import { DropletMascot } from '../mascot/DropletMascot';
import type { StateId } from '../../mascot/bloub/states';
import type { ExpressionId } from '../../mascot/bloub/expressions';
import { findRoute } from '../../engine/routing';
import { GovBrAuthSchema, maskCpf } from '../../security/schemas';

const StepSlide = React.forwardRef<
  HTMLDivElement,
  {
    direction: number;
    variants: Variants;
    transition: Transition;
    children: React.ReactNode;
  }
>(({ direction, variants, transition, children }, ref) => {
  const isPresent = useIsPresent();
  return (
    <motion.div
      ref={ref}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
      aria-hidden={!isPresent}
      inert={!isPresent || undefined}
      className={!isPresent ? 'pointer-events-none select-none' : undefined}
    >
      {children}
    </motion.div>
  );
});
StepSlide.displayName = 'StepSlide';

export interface OnboardingFlowProps {
  onComplete?: () => void;
}

type OnboardingStep = 1 | 2 | 3 | 4;

const STEPS: OnboardingStep[] = [1, 2, 3, 4];

const APPLE_EASE = [0.23, 1, 0.32, 1] as const;

const UFSC_OPTIONS = [
  { id: 'bu', label: 'BU', shortName: 'BU', name: 'Biblioteca Central' },
  { id: 'ru', label: 'RU', shortName: 'RU', name: 'Restaurante Universitário' },
  { id: 'cce', label: 'CCE', shortName: 'CCE', name: 'Centro de Comunicação e Expressão' },
  { id: 'cse', label: 'CSE', shortName: 'CSE', name: 'Centro Socioeconômico' },
  { id: 'ccj', label: 'CCJ', shortName: 'CCJ', name: 'Centro de Ciências Jurídicas' },
  { id: 'cfh', label: 'CFH', shortName: 'CFH', name: 'Centro de Filosofia e Ciências Humanas' },
  { id: 'reitoria', label: 'Reitoria', shortName: 'Reitoria', name: 'Gabinete da Reitoria' },
  { id: 'bosque', label: 'Bosque', shortName: 'Bosque', name: 'Bosque e Planetário' },
  { id: 'hu', label: 'HU', shortName: 'HU', name: 'Hospital Universitário' },
  { id: 'aplicacao', label: 'Aplicação', shortName: 'Aplicação', name: 'Colégio de Aplicação' },
];

const TIME_SLOTS = ['17h–19h', '19h–21h', '21h–23h'];

const HERO_DROPLET_STATES: StateId[] = [
  'orbit',
  'play',
  'wink',
  'comet',
  'egg',
  'hexagon',
  'idle',
];

const AUTO_MOOD_CYCLE: Array<{ state: StateId; expression: ExpressionId; line: string }> = [
  { state: 'play', expression: 'heureux', line: 'Oi! Eu sou a Gotinha do RuaEscura!' },
  { state: 'orbit', expression: 'curieux', line: 'Mapeio postes acesos na UFSC em tempo real.' },
  { state: 'wink', expression: 'excite', line: 'Te conecto com colegas do Gov.br!' },
  { state: 'idle', expression: 'fier', line: 'Bora desbloquear seu passe seguro?' },
];

const VERIFICATION_STEPS = [
  { threshold: 1, label: 'Identidade Gov.br validada', activeColor: 'text-[#2563EB]', strong: false },
  { threshold: 2, label: 'Vínculo UFSC confirmado', activeColor: 'text-[#2563EB]', strong: false },
  { threshold: 3, label: 'Selo Verificado ativo (+100 XP)', activeColor: 'text-[#10B981]', strong: true },
] as const;

/**
 * Smooth ease-out count-up for numeric metrics while keeping DOM labels immediately mounted.
 */
function useCountUp(target: number, active: boolean, reducedMotion: boolean): number {
  const [value, setValue] = useState<number>(target);

  useEffect(() => {
    if (!active || reducedMotion || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setValue(target);
      return;
    }

    const startValue = Math.max(0, Math.round(target * 0.45));
    const duration = 420;
    let startTime: number | null = null;
    let rafId = 0;

    setValue(startValue);

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startValue + (target - startValue) * eased));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [target, active, reducedMotion]);

  return value;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const {
    posts,
    edgeRatings,
    reports,
    companionMatches,
    completeOnboarding,
  } = useCampusStore();

  const [step, setStep] = useState<OnboardingStep>(1);
  const [maxVisitedStep, setMaxVisitedStep] = useState<OnboardingStep>(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Mascot state per step
  const [heroDropletState, setHeroDropletState] = useState<StateId>('orbit');
  const [autoMoodIdx, setAutoMoodIdx] = useState<number>(0);
  const [step2MascotState, setStep2MascotState] = useState<StateId>('idle');
  const [companionHighlighted, setCompanionHighlighted] = useState<boolean>(false);

  // Step 2 state
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>(['bu', 'ru', 'cce']);
  const [timeSlot, setTimeSlot] = useState<string>('21h–23h');
  const [mapMode, setMapMode] = useState<'claro' | 'noturno'>('claro');

  // Step 4 state
  const [name, setName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorShakeKey, setErrorShakeKey] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<'prompt' | 'granted' | 'fallback'>('prompt');
  const [isVerifying, setIsVerifying] = useState(false);
  const [checklistStep, setChecklistStep] = useState(0);

  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion || step !== 1) return;
    const timer = window.setInterval(() => {
      setAutoMoodIdx((prev) => (prev + 1) % AUTO_MOOD_CYCLE.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion, step]);

  const activeAutoMood = AUTO_MOOD_CYCLE[autoMoodIdx] ?? AUTO_MOOD_CYCLE[0];
  const xpEarned = step * 25;

  const goToStep = (nextStep: OnboardingStep) => {
    if (nextStep === step || isVerifying) return;
    setDirection(nextStep > step ? 1 : -1);
    setMaxVisitedStep((prev) => (nextStep > prev ? nextStep : prev));
    setStep(nextStep);
  };

  const cycleHeroDropletState = () => {
    setAutoMoodIdx((prev) => (prev + 1) % AUTO_MOOD_CYCLE.length);
    setHeroDropletState((prev) => {
      const idx = HERO_DROPLET_STATES.indexOf(prev);
      return HERO_DROPLET_STATES[(idx + 1) % HERO_DROPLET_STATES.length] ?? 'orbit';
    });
  };

  // Toggle building in Step 2
  const toggleBuilding = (id: string) => {
    setStep2MascotState('wink');
    setSelectedBuildings((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((b) => b !== id);
      }
      return [...prev, id];
    });
  };

  const handleSelectTimeSlot = (slot: string) => {
    setTimeSlot(slot);
    setStep2MascotState('thinking');
  };

  const handleSelectMapMode = (mode: 'claro' | 'noturno') => {
    setMapMode(mode);
    setStep2MascotState(mode === 'noturno' ? 'sleep' : 'wide');
  };

  // Live Aha preview route for Step 3
  const originId = selectedBuildings[0] || 'bu';
  const destId =
    selectedBuildings.length > 1
      ? selectedBuildings[1]
      : originId === 'ru'
      ? 'bu'
      : 'ru';

  const previewRoute = useMemo(() => {
    return findRoute(originId, destId, 'brightest', posts, edgeRatings, reports);
  }, [originId, destId, posts, edgeRatings, reports]);

  const matchingCompanions = useMemo(() => {
    return companionMatches.filter(
      (comp) =>
        selectedBuildings.includes(comp.originId) ||
        selectedBuildings.includes(comp.destinationId) ||
        previewRoute.path.includes(comp.originId) ||
        previewRoute.path.includes(comp.destinationId)
    );
  }, [companionMatches, selectedBuildings, previewRoute]);

  const verifiedPeersCount = Math.max(matchingCompanions.length, 3);
  const animatedIllum = useCountUp(previewRoute.illuminationPercentage, step === 3, prefersReducedMotion);
  const animatedMinutes = useCountUp(previewRoute.estimatedMinutes, step === 3, prefersReducedMotion);
  const animatedPeers = useCountUp(verifiedPeersCount, step === 3, prefersReducedMotion);

  const step3MascotState: StateId = companionHighlighted ? 'hexagon' : 'play';
  const step4MascotState: StateId = !isVerifying
    ? 'swirl'
    : checklistStep >= 3
      ? 'burst'
      : 'thinking';

  const selectedBuildingLabels = selectedBuildings
    .map((id) => UFSC_OPTIONS.find((opt) => opt.id === id)?.shortName ?? id.toUpperCase())
    .join(' • ');

  const corridorLabel = `${originId.toUpperCase()} → ${destId.toUpperCase()}`;

  const contextPillLabel =
    step === 1
      ? 'Missão'
      : step === 2
        ? `${selectedBuildingLabels} • ${timeSlot}`
        : step === 3
          ? `Trajeto pronto • ${corridorLabel}`
          : `Desbloquear ${corridorLabel}`;

  // Step 4 GPS Pre-permission
  const requestGps = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(
          () => setGpsStatus('granted'),
          () => setGpsStatus('fallback'),
          { timeout: 3000 }
        );
      } catch {
        setGpsStatus('fallback');
      }
    } else {
      setGpsStatus('fallback');
    }
  };

  // Demo Gov.br autofill
  const handleAutofillDemo = () => {
    setName('Mariana Silva');
    setCpf('529.982.247-25');
    setAffiliation('Ciência da Computação • 6ª fase UFSC');
    setError(null);
  };

  // Submit Gov.br form
  const handleGovBrSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const validation = GovBrAuthSchema.safeParse({ name, cpf, affiliation });
    if (!validation.success) {
      setError(validation.error.errors[0]?.message ?? 'Dados inválidos');
      setErrorShakeKey((k) => k + 1);
      return;
    }

    clearTimers();
    setIsVerifying(true);
    setChecklistStep(1);

    const t1 = window.setTimeout(() => setChecklistStep(2), 100);
    const t2 = window.setTimeout(() => setChecklistStep(3), 220);
    const t3 = window.setTimeout(() => {
      completeOnboarding({
        selectedBuildings,
        timeSlot,
        isNightMap: mapMode === 'noturno',
        session: {
          name: validation.data.name,
          cpfMasked: maskCpf(validation.data.cpf),
          affiliation: validation.data.affiliation,
          verifiedAt: new Date().toISOString(),
        },
      });
      onComplete?.();
    }, 420);

    timersRef.current.push(t1, t2, t3);
  };

  const sharedSpring = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, bounce: 0, duration: 0.38 };

  const segmentSpring = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, bounce: 0, duration: 0.28 };

  const stepTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: 0.3, ease: APPLE_EASE };

  const stepVariants = {
    enter: (dir: number) =>
      prefersReducedMotion
        ? { opacity: 1, x: 0, scale: 1 }
        : { opacity: 0, x: dir * 28, filter: 'blur(3px)' },
    center: {
      opacity: 1,
      x: 0,
      scale: 1,
      filter: 'blur(0px)',
    },
    exit: (dir: number) =>
      prefersReducedMotion
        ? { opacity: 0 }
        : { opacity: 0, x: dir * -28, scale: 0.985, filter: 'blur(3px)' },
  };

  const renderContextPill = (variantClass: string) => (
    <motion.div
      layoutId={prefersReducedMotion ? undefined : 'onboard-context-pill'}
      layout={!prefersReducedMotion}
      transition={sharedSpring}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium max-w-[230px] truncate ${variantClass}`}
    >
      <span className="truncate">{contextPillLabel}</span>
    </motion.div>
  );

  return (
    <LayoutGroup>
      <div className="min-h-screen w-full bg-gradient-to-b from-[#E5EEFF] via-[#F5F8FF] to-white text-[#111827] flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-300">
        {/* Gamified XP & Interactive Step Progress Bar */}
        <div className="w-full max-w-md mb-3 px-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#4B5563] mb-1.5">
            <span>Etapa {step} de 4</span>

            {/* Interactive Step Dots for visited steps (no escape-room rigidity) */}
            <nav aria-label="Progresso das etapas" className="flex items-center">
              {STEPS.map((s) => {
                const isCurrent = s === step;
                const isVisited = s <= maxVisitedStep && !isVerifying;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!isVisited || isCurrent}
                    aria-label={`Ir para etapa ${s}`}
                    aria-current={isCurrent ? 'step' : undefined}
                    onClick={() => isVisited && goToStep(s)}
                    className={`min-w-[44px] min-h-[44px] -mx-2 inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${
                      isVisited && !isCurrent ? 'cursor-pointer hover:bg-[#2563EB]/10' : 'cursor-default'
                    }`}
                  >
                    <motion.span
                      layout={!prefersReducedMotion}
                      transition={segmentSpring}
                      className={`block h-1.5 rounded-full transition-colors ${
                        isCurrent
                          ? 'w-5 bg-[#2563EB]'
                          : s < step || s <= maxVisitedStep
                            ? 'w-2 bg-[#10B981]'
                            : 'w-2 bg-[#CBD5E1]'
                      }`}
                    />
                  </button>
                );
              })}
            </nav>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-[#E5EAF4] text-[#2563EB] font-semibold shadow-2xs">
              <Sparkles className="w-3 h-3 text-[#F59E0B]" aria-hidden="true" />
              <span>{xpEarned} XP</span>
            </span>
          </div>

          <div className="h-1.5 w-full rounded-full bg-white/80 overflow-hidden border border-[#E5EAF4]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#10B981]"
              initial={false}
              animate={{ width: `${(step / 4) * 100}%` }}
              transition={sharedSpring}
            />
          </div>
        </div>

        {/* ONE Persistent Morphing Outer Card Shell */}
        <motion.div
          layout={!prefersReducedMotion}
          transition={sharedSpring}
          className="w-full max-w-md bg-white text-[#111827] rounded-[32px] p-5 sm:p-8 relative overflow-hidden shadow-xl border border-[#E5EAF4]"
        >
          <AnimatePresence mode="popLayout" custom={direction} initial={false}>
            {/* STEP 1: ROYAL BLUE SPLIT FADE HERO + SHARED MASCOT */}
            {step === 1 && (
              <StepSlide
                key="step-1"
                direction={direction}
                variants={stepVariants}
                transition={stepTransition}
              >
                {/* Full-bleed Royal Blue to Pure White top stage */}
                <div className="-mx-5 -mt-5 sm:-mx-8 sm:-mt-8 px-5 pt-6 pb-8 sm:px-8 bg-gradient-to-b from-[#0044CC] via-[#2274FA] via-75% to-white text-white">
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/18 backdrop-blur-md text-white border border-white/25">
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>UFSC Campus Trindade</span>
                    </span>
                    {renderContextPill('bg-white/18 backdrop-blur-md text-white border border-white/25')}
                  </div>

                  <div className="flex flex-col items-center gap-2.5">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.div
                        key={activeAutoMood.line}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 4, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: APPLE_EASE }}
                        className="px-4 py-1.5 rounded-full bg-white/18 backdrop-blur-md border border-white/30 text-xs font-medium text-white text-center shadow-xs"
                      >
                        {activeAutoMood.line}
                      </motion.div>
                    </AnimatePresence>

                    <motion.div
                      layoutId={prefersReducedMotion ? undefined : 'onboard-hero-mascot'}
                      transition={sharedSpring}
                      className="drop-shadow-[0_14px_26px_rgba(0,25,110,0.32)]"
                    >
                      <motion.div
                        animate={prefersReducedMotion ? undefined : { y: [0, -6, 0] }}
                        transition={
                          prefersReducedMotion
                            ? undefined
                            : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
                        }
                      >
                        <DropletMascot
                          state={heroDropletState === 'orbit' ? activeAutoMood.state : heroDropletState}
                          expression={activeAutoMood.expression}
                          size={128}
                          inkColor="#FFFFFF"
                          paperColor="#1D4ED8"
                          notifColor="#10B981"
                          interactive
                          onTap={cycleHeroDropletState}
                          ariaLabel="Mascote gotinha — toque para mudar o humor"
                        />
                      </motion.div>
                    </motion.div>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-[#111827]/12 text-[#1E3A8A]">
                      Toque na gotinha para interagir
                    </span>
                  </div>
                </div>

                {/* White Lower Stage: Illuminated Route Sparkline + Social Proof + Headline + CTAs */}
                <div className="w-full flex justify-center -mt-2 mb-1" aria-hidden="true">
                  <svg className="w-full h-16" viewBox="0 0 320 68" fill="none">
                    <motion.path
                      d="M 28 38 Q 95 10 160 32 T 292 26"
                      stroke="#2563EB"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeOpacity="0.2"
                      initial={prefersReducedMotion ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={prefersReducedMotion ? undefined : { duration: 0.8, ease: APPLE_EASE }}
                    />
                    <motion.path
                      d="M 28 38 Q 95 10 160 32 T 292 26"
                      stroke="#10B981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      initial={prefersReducedMotion ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={prefersReducedMotion ? undefined : { duration: 0.8, ease: APPLE_EASE }}
                    />
                    <circle cx="28" cy="38" r="5" fill="#2563EB" />
                    <circle cx="160" cy="32" r="4.5" fill="#10B981" />
                    <circle cx="292" cy="26" r="5" fill="#2563EB" />
                    <text x="28" y="58" fill="#4B5563" fontSize="11" textAnchor="middle" fontWeight="600">
                      BU
                    </text>
                    <text x="160" y="52" fill="#4B5563" fontSize="11" textAnchor="middle" fontWeight="600">
                      Reitoria
                    </text>
                    <text x="292" y="46" fill="#4B5563" fontSize="11" textAnchor="middle" fontWeight="600">
                      RU
                    </text>
                  </svg>
                </div>

                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#111827] leading-tight text-center">
                  Caminhe pela UFSC no claro. <span className="text-[#2563EB]">E acompanhado.</span>
                </h1>

                <p className="text-sm text-[#4B5563] mt-2.5 leading-relaxed text-center">
                  Descubra trajetos com iluminação verificada em tempo real e conecte-se com colegas fazendo o mesmo caminho pelo campus Trindade.
                </p>

                <div className="mt-3.5 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                    <Users className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
                    <span>+1.240 caminhadas monitoradas na Trindade</span>
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-5 space-y-2.5">
                  <PillButton
                    variant="lime"
                    size="compact"
                    className="w-full h-14 shadow-md font-semibold text-base"
                    onClick={() => goToStep(2)}
                  >
                    Começar meu trajeto →
                  </PillButton>

                  <button
                    type="button"
                    className="w-full min-h-[44px] h-12 text-sm font-medium text-[#374151] hover:text-[#111827] enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer text-center rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                    onClick={() => {
                      setSelectedBuildings(['bu', 'ru', 'cce']);
                      goToStep(4);
                    }}
                  >
                    Já tenho conta Gov.br
                  </button>
                </div>
              </StepSlide>
            )}

            {/* STEP 2: PERSONALIZATION CANVAS + REACTIVE SHARED MASCOT */}
            {step === 2 && (
              <StepSlide
                key="step-2"
                direction={direction}
                variants={stepVariants}
                transition={stepTransition}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs uppercase tracking-wider font-semibold text-[#4B5563]">
                        Preferências
                      </span>
                      {renderContextPill('bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]')}
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">
                      Seus trajetos e horários frequentes
                    </h2>
                    <p className="text-sm text-[#4B5563]">
                      Personalize seu mapa seguro da UFSC
                    </p>
                  </div>

                  <motion.div
                    layoutId={prefersReducedMotion ? undefined : 'onboard-hero-mascot'}
                    transition={sharedSpring}
                    className="shrink-0"
                  >
                    <DropletMascot
                      state={step2MascotState}
                      expression={mapMode === 'noturno' ? 'attentif' : 'heureux'}
                      size={74}
                      inkColor="#2563EB"
                      paperColor="#FFFFFF"
                      notifColor="#10B981"
                      ariaLabel="Mascote acompanhando suas preferências"
                    />
                  </motion.div>
                </div>

                {/* Building Selection Multi-Select Tactile Chips */}
                <div className="mt-5">
                  <span
                    id="onboard-buildings-label"
                    className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-2"
                  >
                    Prédios e centros que você frequenta
                  </span>
                  <div
                    role="group"
                    aria-labelledby="onboard-buildings-label"
                    className="flex flex-wrap gap-2"
                  >
                    {UFSC_OPTIONS.map((item) => {
                      const isSelected = selectedBuildings.includes(item.id);
                      return (
                        <motion.button
                          key={item.id}
                          type="button"
                          layout={!prefersReducedMotion}
                          transition={segmentSpring}
                          aria-pressed={isSelected}
                          aria-label={`${item.shortName} — ${item.name}`}
                          onClick={() => toggleBuilding(item.id)}
                          className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-medium transition-[transform,background-color,border-color,color,box-shadow] duration-150 enabled:active:scale-[0.96] cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${
                            isSelected
                              ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                              : 'bg-[#F8FAFC] text-[#111827] border-[#E5EAF4] hover:bg-[#EFF6FF]'
                          }`}
                        >
                          {item.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Slot Segmented Selection with Spring Pill */}
                <div className="mt-5">
                  <span
                    id="onboard-timeslot-label"
                    className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-2"
                  >
                    Horário principal de retorno
                  </span>
                  <div
                    role="group"
                    aria-labelledby="onboard-timeslot-label"
                    className="grid grid-cols-3 gap-2"
                  >
                    {TIME_SLOTS.map((slot) => {
                      const isSelected = timeSlot === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => handleSelectTimeSlot(slot)}
                          className={`relative min-h-[44px] flex items-center justify-center rounded-2xl text-xs sm:text-sm font-medium transition-[transform,color,border-color] duration-150 enabled:active:scale-[0.96] cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${
                            isSelected
                              ? 'text-white border-[#2563EB]'
                              : 'bg-[#F8FAFC] text-[#111827] border-[#E5EAF4] hover:bg-[#EFF6FF]'
                          }`}
                        >
                          {isSelected && (
                            <motion.span
                              layoutId={prefersReducedMotion ? undefined : 'onboard-timeslot-pill'}
                              transition={segmentSpring}
                              aria-hidden="true"
                              className="absolute inset-0 rounded-2xl bg-[#2563EB] shadow-sm"
                            />
                          )}
                          <span className="relative z-10 inline-flex items-center">
                            <Clock
                              className={`w-3.5 h-3.5 mr-1.5 ${isSelected ? 'text-white' : 'text-[#2563EB]'}`}
                              aria-hidden="true"
                            />
                            {slot}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Map Style Segmented Selection with Spring Pill */}
                <div className="mt-5">
                  <span
                    id="onboard-mapmode-label"
                    className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-2"
                  >
                    Modo visual inicial do mapa
                  </span>
                  <div
                    role="group"
                    aria-labelledby="onboard-mapmode-label"
                    className="grid grid-cols-2 gap-2"
                  >
                    <button
                      type="button"
                      aria-pressed={mapMode === 'claro'}
                      onClick={() => handleSelectMapMode('claro')}
                      className={`relative min-h-[44px] px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-[transform,color,border-color] duration-150 enabled:active:scale-[0.96] cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${
                        mapMode === 'claro'
                          ? 'text-white border-[#2563EB]'
                          : 'bg-[#F8FAFC] text-[#111827] border-[#E5EAF4] hover:bg-[#EFF6FF]'
                      }`}
                    >
                      {mapMode === 'claro' && (
                        <motion.span
                          layoutId={prefersReducedMotion ? undefined : 'onboard-mapmode-pill'}
                          transition={segmentSpring}
                          aria-hidden="true"
                          className="absolute inset-0 rounded-2xl bg-[#2563EB] shadow-sm"
                        />
                      )}
                      <span className="relative z-10 inline-flex items-center gap-1.5">
                        <Sun
                          className={`w-4 h-4 shrink-0 ${mapMode === 'claro' ? 'text-white' : 'text-[#2563EB]'}`}
                          aria-hidden="true"
                        />
                        <span>Claro + Modo Noturno</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={mapMode === 'noturno'}
                      onClick={() => handleSelectMapMode('noturno')}
                      className={`relative min-h-[44px] px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-[transform,color,border-color] duration-150 enabled:active:scale-[0.96] cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${
                        mapMode === 'noturno'
                          ? 'text-white border-[#111827]'
                          : 'bg-[#F8FAFC] text-[#111827] border-[#E5EAF4] hover:bg-[#EFF6FF]'
                      }`}
                    >
                      {mapMode === 'noturno' && (
                        <motion.span
                          layoutId={prefersReducedMotion ? undefined : 'onboard-mapmode-pill'}
                          transition={segmentSpring}
                          aria-hidden="true"
                          className="absolute inset-0 rounded-2xl bg-[#111827] shadow-sm"
                        />
                      )}
                      <span className="relative z-10 inline-flex items-center gap-1.5">
                        <Moon
                          className={`w-4 h-4 shrink-0 ${mapMode === 'noturno' ? 'text-[#60A5FA]' : 'text-[#2563EB]'}`}
                          aria-hidden="true"
                        />
                        <span>Sempre Noturno</span>
                      </span>
                    </button>
                  </div>
                </div>

                {/* Navigation Actions */}
                <div className="mt-7 flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Voltar"
                    onClick={() => goToStep(1)}
                    className="min-w-[44px] min-h-[44px] px-4 py-2 rounded-full text-sm font-medium text-[#111827] bg-[#F1F5F9] border border-[#E5EAF4] hover:bg-[#E2E8F0] active:scale-[0.96] transition-all cursor-pointer inline-flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <PillButton
                    variant="lime"
                    size="compact"
                    className="flex-1 font-semibold"
                    onClick={() => goToStep(3)}
                  >
                    Ver meu trajeto seguro →
                  </PillButton>
                </div>
              </StepSlide>
            )}

            {/* STEP 3: LIVE AHA! MOMENT PREVIEW ("THIS IS JUST FOR ME") */}
            {step === 3 && (
              <StepSlide
                key="step-3"
                direction={direction}
                variants={stepVariants}
                transition={stepTransition}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs uppercase tracking-wider font-semibold text-[#4B5563]">
                    Aha! Preview
                  </span>
                  {renderContextPill('bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]')}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">
                      Seu corredor inteligente
                    </h2>
                    <p className="text-sm text-[#4B5563] mt-1">
                      Trajeto seguro calculado para seu perfil
                    </p>
                  </div>

                  <motion.div
                    layoutId={prefersReducedMotion ? undefined : 'onboard-hero-mascot'}
                    transition={sharedSpring}
                    className="shrink-0"
                  >
                    <DropletMascot
                      state={step3MascotState}
                      expression={companionHighlighted ? 'fier' : 'heureux'}
                      size={76}
                      inkColor="#2563EB"
                      paperColor="#FFFFFF"
                      notifColor="#10B981"
                      interactive
                      onTap={() => setCompanionHighlighted((prev) => !prev)}
                      ariaLabel="Mascote celebrando seu corredor seguro"
                    />
                  </motion.div>
                </div>

                {/* Personalized Recap & Progressive Calibration Strip */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE] text-xs">
                  <span className="font-medium text-[#1E3A8A]">
                    Construído para o seu trajeto:{' '}
                    <strong className="font-semibold">
                      {corridorLabel} • {timeSlot} • {mapMode === 'noturno' ? 'Noturno' : 'Claro'}
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#065F46] bg-white px-2.5 py-0.5 rounded-full border border-[#A7F3D0]">
                    <span
                      aria-hidden="true"
                      className={`w-1.5 h-1.5 rounded-full bg-[#10B981] ${
                        prefersReducedMotion ? '' : 'animate-pulse'
                      }`}
                    />
                    Calibrado com postes da Trindade
                  </span>
                </div>

                {/* Corridor Origin/Destination Card */}
                <div className="mt-3.5 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF4] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                      <span className="text-sm font-semibold uppercase text-[#111827]">
                        {corridorLabel}
                      </span>
                    </div>
                    <span className="text-xs text-[#2563EB] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#E5EAF4]">
                      {timeSlot}
                    </span>
                  </div>

                  {/* Illumination & Distance Stat with smooth count-up */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-white rounded-xl border border-[#E5EAF4]">
                      <div className="flex items-center gap-1.5 text-xs text-[#4B5563] font-medium">
                        <Lightbulb className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
                        <span>Iluminação</span>
                      </div>
                      <div className="text-2xl font-semibold text-[#111827] mt-1 tabular-nums">
                        {animatedIllum}
                        <span className="text-sm font-normal text-[#4B5563]">% iluminado</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-[#E5EAF4]">
                      <div className="flex items-center gap-1.5 text-xs text-[#4B5563] font-medium">
                        <Clock className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />
                        <span>Caminhada</span>
                      </div>
                      <div className="text-2xl font-semibold text-[#111827] mt-1 tabular-nums">
                        ~{animatedMinutes}{' '}
                        <span className="text-sm font-normal text-[#4B5563]">min a pé</span>
                      </div>
                      <div className="text-xs text-[#4B5563]">{previewRoute.distanceMeters}m de extensão</div>
                    </div>
                  </div>

                  {/* Interactive Verified Peers Preview Card */}
                  <button
                    type="button"
                    aria-pressed={companionHighlighted}
                    onClick={() => setCompanionHighlighted((prev) => !prev)}
                    className={`w-full min-h-[44px] p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-[transform,background-color,border-color,color] duration-150 enabled:active:scale-[0.98] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${
                      companionHighlighted
                        ? 'bg-[#2563EB] text-white border-[#2563EB]'
                        : 'bg-white text-[#111827] border-[#E5EAF4] hover:border-[#2563EB]/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Users
                        className={`w-4 h-4 shrink-0 ${
                          companionHighlighted ? 'text-white' : 'text-[#2563EB]'
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium tabular-nums">
                          {animatedPeers} estudantes verificados
                        </div>
                        <div
                          className={`text-xs ${
                            companionHighlighted ? 'text-white/85' : 'text-[#4B5563]'
                          }`}
                        >
                          Caminhando no seu horário
                        </div>
                      </div>
                    </div>
                    <div className="flex -space-x-1.5 overflow-hidden shrink-0" aria-hidden="true">
                      <span className="inline-block h-6 w-6 rounded-full bg-[#2563EB] text-white text-[10px] font-semibold text-center leading-6 ring-2 ring-white">
                        MS
                      </span>
                      <span className="inline-block h-6 w-6 rounded-full bg-[#111827] text-white text-[10px] font-semibold text-center leading-6 ring-2 ring-white">
                        CD
                      </span>
                      <span className="inline-block h-6 w-6 rounded-full bg-[#10B981] text-white text-[10px] font-semibold text-center leading-6 ring-2 ring-white">
                        GS
                      </span>
                    </div>
                  </button>
                </div>

                {/* Trust statement */}
                <p className="text-xs text-[#4B5563] mt-4 leading-relaxed">
                  Você não precisa caminhar no escuro ou sozinho. Complete a identificação Gov.br para entrar em grupos de caminhada monitorada.
                </p>

                {/* Navigation Actions */}
                <div className="mt-7 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="min-h-[44px] px-4 py-2 rounded-full text-sm font-medium text-[#111827] bg-[#F1F5F9] border border-[#E5EAF4] hover:bg-[#E2E8F0] active:scale-[0.96] transition-all cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                  >
                    Voltar
                  </button>

                  <PillButton
                    variant="lime"
                    size="compact"
                    className="flex-1 font-semibold !text-sm !px-4 whitespace-nowrap"
                    onClick={() => goToStep(4)}
                  >
                    Validar acesso Gov.br →
                  </PillButton>
                </div>
              </StepSlide>
            )}

            {/* STEP 4: GPS PRE-PERMISSION + GOV.BR TRUST GATE */}
            {step === 4 && (
              <StepSlide
                key="step-4"
                direction={direction}
                variants={stepVariants}
                transition={stepTransition}
              >
                {/* Royal Blue Gov.br Header Stage */}
                <div className="-mx-5 -mt-5 sm:-mx-8 sm:-mt-8 px-5 py-5 sm:px-8 sm:py-6 mb-5 bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {renderContextPill('bg-white/18 backdrop-blur-md text-white border border-white/25')}
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white text-[#1E3A8A] shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
                      <span>Gov.br Gate</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight text-white">
                        Validação única Gov.br
                      </h2>
                      <p className="text-sm text-white/85 mt-1">
                        Identificação institucional segura para acessar o mapa com estudantes verificados
                      </p>
                      <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-medium text-white">
                        <LockOpen className="w-3.5 h-3.5 text-[#6EE7B7]" aria-hidden="true" />
                        <span>Acesso ao trajeto {corridorLabel}</span>
                      </div>
                    </div>

                    <motion.div
                      layoutId={prefersReducedMotion ? undefined : 'onboard-hero-mascot'}
                      transition={sharedSpring}
                      className="shrink-0"
                    >
                      <DropletMascot
                        state={step4MascotState}
                        expression={isVerifying ? 'excite' : 'attentif'}
                        size={76}
                        inkColor="#FFFFFF"
                        paperColor="#1D4ED8"
                        notifColor="#10B981"
                        ariaLabel="Mascote de verificação Gov.br"
                      />
                    </motion.div>
                  </div>
                </div>

                {/* GPS Pre-Permission Card */}
                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF4]">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="text-xs text-[#4B5563] leading-relaxed">
                      <span className="font-semibold text-[#111827] block mb-0.5">
                        Localização no campus
                      </span>
                      Usamos sua posição apenas enquanto caminha na UFSC para alertar sobre trechos escuros.
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={requestGps}
                      className="min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-medium bg-white border border-[#E5EAF4] text-[#2563EB] hover:bg-[#EFF6FF] active:scale-[0.96] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                    >
                      Continuar para localização
                    </button>
                    {gpsStatus !== 'prompt' && (
                      <span className="text-xs font-medium text-[#059669] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{gpsStatus === 'granted' ? 'Habilitada' : 'Campus Trindade'}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Gov.br Form */}
                <form onSubmit={handleGovBrSubmit} className="mt-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="govbr-name"
                      className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider"
                    >
                      Nome completo
                    </label>
                    <button
                      type="button"
                      onClick={handleAutofillDemo}
                      className="min-h-[44px] inline-flex items-center px-2 text-xs text-[#2563EB] font-medium hover:underline cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                    >
                      Preencher demo Gov.br
                    </button>
                  </div>

                  <input
                    id="govbr-name"
                    type="text"
                    aria-label="Nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Mariana Silva"
                    disabled={isVerifying}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#E5EAF4] bg-[#F8FAFC] text-sm text-[#111827] focus-visible:outline-2 focus-visible:outline-[#2563EB]"
                  />

                  <div>
                    <label
                      htmlFor="govbr-affiliation"
                      className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-1"
                    >
                      Vínculo UFSC
                    </label>
                    <input
                      id="govbr-affiliation"
                      type="text"
                      aria-label="Vínculo UFSC"
                      value={affiliation}
                      onChange={(e) => setAffiliation(e.target.value)}
                      placeholder="Ex: Ciência da Computação • 6ª fase"
                      disabled={isVerifying}
                      className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#E5EAF4] bg-[#F8FAFC] text-sm text-[#111827] focus-visible:outline-2 focus-visible:outline-[#2563EB]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="govbr-cpf"
                      className="block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-1"
                    >
                      CPF
                    </label>
                    <input
                      id="govbr-cpf"
                      type="text"
                      aria-label="CPF"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      placeholder="000.000.000-00"
                      disabled={isVerifying}
                      className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#E5EAF4] bg-[#F8FAFC] text-sm text-[#111827] focus-visible:outline-2 focus-visible:outline-[#2563EB]"
                    />
                  </div>

                  {/* Fail-fast Error Message with gentle shake */}
                  {error && (
                    <motion.div
                      key={errorShakeKey}
                      role="alert"
                      initial={prefersReducedMotion ? false : { opacity: 0, x: -4 }}
                      animate={
                        prefersReducedMotion
                          ? { opacity: 1 }
                          : { opacity: 1, x: [0, -6, 6, -4, 4, 0] }
                      }
                      transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.32, ease: APPLE_EASE }}
                      className="t-error-msg p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#D70015] font-medium"
                    >
                      {error}
                    </motion.div>
                  )}

                  {/* 3-Stage Verification Checklist */}
                  {isVerifying && (
                    <motion.div
                      initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.22, ease: APPLE_EASE }}
                      className="mt-4 p-4 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE] space-y-2.5 overflow-hidden"
                    >
                      {VERIFICATION_STEPS.map((item) => {
                        const isDone = checklistStep >= item.threshold;
                        return (
                          <div key={item.threshold} className="flex items-center gap-2.5 text-xs">
                            <CheckCircle2
                              className={`w-4 h-4 transition-colors ${
                                isDone ? item.activeColor : 'text-[#94A3B8]'
                              }`}
                              aria-hidden="true"
                            />
                            <span
                              className={
                                isDone
                                  ? `text-[#111827] ${item.strong ? 'font-semibold' : 'font-medium'}`
                                  : 'text-[#4B5563]'
                              }
                            >
                              {item.label}
                            </span>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Action Button */}
                  <div className="pt-2">
                    <PillButton
                      type="submit"
                      variant="lime"
                      size="compact"
                      disabled={isVerifying}
                      className="w-full font-semibold"
                    >
                      Validar e entrar →
                    </PillButton>
                  </div>
                </form>
              </StepSlide>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </LayoutGroup>
  );
};
