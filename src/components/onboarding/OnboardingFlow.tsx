import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LayoutGroup, motion, AnimatePresence, useIsPresent, type Variants, type Transition } from 'motion/react';
import {
  ShieldCheck,
  MapPin,
  Clock,
  Moon,
  Sun,
  Users,
  Lightbulb,
  ChevronLeft,
  ArrowRight,
} from 'lucide-react';
import { useCampusStore } from '../../hooks/useCampusStore';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { SfIcon } from '../ui/SfIcon';
import { DropletMascot } from '../mascot/DropletMascot';
import type { StateId } from '../../mascot/bloub/states';
import type { GovBrSession } from '../../types/campus';
import { findRoute } from '../../engine/routing';
import { GovBrAuthSchema, UfscEmailSchema, maskCpf } from '../../security/schemas';
import {
  DEMO_UFSC_EMAIL,
  sendUfscOtpCode,
  verifyUfscOtpCode,
  type OtpChallenge,
} from '../../services/ufscOtpAuth';
import ufscLogo from '../../assets/ufsc-logo.webp';
import { FocusFlightIntro } from './FocusFlightIntro';
import { InteractiveCrewSignUp } from './crew/InteractiveCrewSignUp';
import { VerificationCodeOtp } from './VerificationCodeOtp';
import { WelcomeBackTrioShowcase, useWelcomeBackGaze } from './WelcomeBackTrioShowcase';

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
  initialStage?: 'intro' | 'wizard';
}

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

const STEPS: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];

const APPLE_EASE = [0.23, 1, 0.32, 1] as const;

const UFSC_OPTIONS = [
  { id: 'bu', label: 'BU', shortName: 'BU', name: 'Biblioteca Central' },
  { id: 'ru', label: 'RU', shortName: 'RU', name: 'Restaurante Universitário' },
  { id: 'eps', label: 'CTC / EPS', shortName: 'CTC / EPS', name: 'Centro Tecnológico (CTC / EPS)' },
  { id: 'cce', label: 'CCE', shortName: 'CCE', name: 'Centro de Comunicação e Expressão' },
  { id: 'cse', label: 'CSE', shortName: 'CSE', name: 'Centro Socioeconômico' },
  { id: 'ccj', label: 'CCJ', shortName: 'CCJ', name: 'Centro de Ciências Jurídicas' },
  { id: 'cfh', label: 'CFH', shortName: 'CFH', name: 'Centro de Filosofia e Ciências Humanas' },
  { id: 'cfm', label: 'CFM', shortName: 'CFM', name: 'CFM — Química, Física e Matemática' },
  { id: 'eqa_tunel', label: 'Túnel EQA', shortName: 'Túnel EQA', name: 'Túnel do EQA' },
  { id: 'cds', label: 'CDS', shortName: 'CDS', name: 'Centro de Desportos' },
  { id: 'dce', label: 'DCE', shortName: 'DCE', name: 'DCE Luiz Travassos' },
  { id: 'elase', label: 'Elase', shortName: 'Elase', name: 'Saída pela Elase' },
  { id: 'cultura', label: 'Cultura', shortName: 'Cultura', name: 'Centro de Cultura e Eventos' },
  { id: 'certi', label: 'CERTI', shortName: 'CERTI', name: 'Fundação CERTI' },
  { id: 'hu', label: 'HU', shortName: 'HU', name: 'Hospital Universitário' },
  { id: 'reitoria', label: 'Reitoria', shortName: 'Reitoria', name: 'Gabinete da Reitoria' },
  { id: 'bosque', label: 'Bosque', shortName: 'Bosque', name: 'Bosque e Planetário' },
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

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  initialStage = 'intro',
}) => {
  const {
    posts,
    edgeRatings,
    reports,
    companionMatches,
    darkMode,
    toggleDarkMode,
    completeOnboarding,
  } = useCampusStore();

  const [stage, setStage] = useState<'intro' | 'wizard'>(initialStage);
  const [step, setStep] = useState<OnboardingStep>(1);
  const [maxVisitedStep, setMaxVisitedStep] = useState<OnboardingStep>(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Mascot state per step
  const [heroDropletState, setHeroDropletState] = useState<StateId>('idle');
  const [step2MascotState, setStep2MascotState] = useState<StateId>('idle');
  const [companionHighlighted, setCompanionHighlighted] = useState<boolean>(false);

  // Step 2 state
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>(['bu', 'ru', 'cce']);
  const [timeSlot, setTimeSlot] = useState<string>('21h–23h');
  const appTheme: 'claro' | 'escuro' = darkMode ? 'escuro' : 'claro';

  // Sync document theme attribute so standalone renders and CSS tokens respond live
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  // Step 4 state
  const [name, setName] = useState('');
  const [ufscEmail, setUfscEmail] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorShakeKey, setErrorShakeKey] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [checklistStep, setChecklistStep] = useState(0);
  const [otpChallenge, setOtpChallenge] = useState<OtpChallenge | null>(null);
  const [pendingSession, setPendingSession] = useState<GovBrSession | null>(null);

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
  const welcomeGaze = useWelcomeBackGaze(prefersReducedMotion);

  const xpEarned = Math.min(step, 4) * 25;

  const goToStep = (nextStep: OnboardingStep) => {
    if (nextStep === step || isVerifying) return;
    setDirection(nextStep > step ? 1 : -1);
    setMaxVisitedStep((prev) => (nextStep > prev ? nextStep : prev));
    setStep(nextStep);
  };

  const cycleHeroDropletState = () => {
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

  const handleSelectAppTheme = (mode: 'claro' | 'escuro') => {
    const nextDark = mode === 'escuro';
    if (darkMode !== nextDark) {
      toggleDarkMode();
    }
    setStep2MascotState(nextDark ? 'wide' : 'play');
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

  // Demo Gov.br + @ufsc.br autofill
  const handleAutofillDemo = () => {
    setName('Mariana Silva');
    setUfscEmail(DEMO_UFSC_EMAIL);
    setCpf('529.982.247-25');
    setAffiliation('Ciência da Computação • 6ª fase UFSC');
    setError(null);
  };

  // Submit Gov.br form & dispatch institutional @ufsc.br OTP challenge
  const handleGovBrSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const validation = GovBrAuthSchema.safeParse({
      name,
      cpf,
      affiliation,
    });
    if (!validation.success) {
      setError(validation.error.errors[0]?.message ?? 'Dados inválidos');
      setErrorShakeKey((k) => k + 1);
      return;
    }

    const emailValidation = UfscEmailSchema.safeParse(ufscEmail);
    if (!emailValidation.success) {
      setError(
        emailValidation.error.errors[0]?.message ??
        'Use seu e-mail institucional UFSC (@grad.ufsc.br, @posgrad.ufsc.br ou @ufsc.br)'
      );
      setErrorShakeKey((k) => k + 1);
      return;
    }

    clearTimers();
    setIsVerifying(true);
    setChecklistStep(1);

    const challengePromise = sendUfscOtpCode(emailValidation.data);
    const t1 = window.setTimeout(() => setChecklistStep(2), 100);
    const t2 = window.setTimeout(() => setChecklistStep(3), 220);
    const t3 = window.setTimeout(() => {
      void challengePromise
        .then((challenge) => {
          setPendingSession({
            name: validation.data.name,
            cpfMasked: maskCpf(validation.data.cpf),
            affiliation: validation.data.affiliation,
            ufscEmail: challenge.email,
            verifiedAt: new Date().toISOString(),
          });
          setIsVerifying(false);
          setOtpChallenge(challenge);
        })
        .catch((err: unknown) => {
          setIsVerifying(false);
          setChecklistStep(0);
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível enviar o código para o seu e-mail UFSC.'
          );
          setErrorShakeKey((k) => k + 1);
        });
    }, 360);

    timersRef.current.push(t1, t2, t3);
  };

  const handleEnterCampus = () => {
    if (!pendingSession) return;
    completeOnboarding({
      selectedBuildings,
      timeSlot,
      isNightMap: appTheme === 'escuro',
      session: pendingSession,
    });
    onComplete?.();
  };

  const firstName =
    pendingSession?.name.trim().split(/\s+/)[0] ||
    name.trim().split(/\s+/)[0] ||
    'estudante';

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

  const stageTransition: Transition = prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: 0.3, ease: APPLE_EASE };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {stage === 'intro' ? (
        <motion.div
          key="focus-flight-intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={stageTransition}
          className="w-full"
        >
          <FocusFlightIntro
            onFinishIntro={() => setStage('wizard')}
            onJumpToGovBr={() => {
              setStage('wizard');
              goToStep(4);
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="onboarding-wizard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={stageTransition}
          className="w-full"
        >
          <LayoutGroup>
            <div
              data-theme-mode={darkMode ? 'dark' : 'light'}
              className="min-h-screen w-full bg-[var(--bg-grouped)] text-[var(--label-primary)] flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-300"
            >
              {/* Gamified XP & Interactive Step Progress Bar (hidden on Step 5 completion screen) */}
              {step <= 4 && (
                <div className="w-full max-w-md mb-3 px-1">
                  <div className="flex items-center justify-between text-xs font-medium text-[var(--label-secondary)] mb-1.5">
                    <span>Etapa {step} de 4</span>

                    {/* Interactive Neutral Black/White Step Dots for visited steps */}
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
                            className={`min-w-[44px] min-h-[44px] -mx-2 inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${isVisited && !isCurrent
                              ? darkMode
                                ? 'cursor-pointer hover:bg-white/10'
                                : 'cursor-pointer hover:bg-[#111827]/10'
                              : 'cursor-default'
                              }`}
                          >
                            <motion.span
                              layout={!prefersReducedMotion}
                              transition={segmentSpring}
                              className={`block h-1.5 rounded-full transition-colors ${isCurrent
                                ? darkMode
                                  ? 'w-5 bg-white'
                                  : 'w-5 bg-[#111827]'
                                : s < step || s <= maxVisitedStep
                                  ? darkMode
                                    ? 'w-2 bg-white/40'
                                    : 'w-2 bg-[#111827]/50'
                                  : darkMode
                                    ? 'w-2 bg-white/20'
                                    : 'w-2 bg-[#CBD5E1]'
                                }`}
                            />
                          </button>
                        );
                      })}
                    </nav>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--separator)] text-[var(--label-primary)] font-semibold shadow-2xs transition-colors duration-300">
                      <SfIcon name="star" filled size={12} className="text-[#F59E0B]" />
                      <span>{xpEarned} XP</span>
                    </span>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden border border-[var(--separator)] transition-colors duration-300">
                    <motion.div
                      className={`h-full rounded-full transition-colors duration-300 ${darkMode ? 'bg-white' : 'bg-[#111827]'
                        }`}
                      initial={false}
                      animate={{ width: `${(step / 4) * 100}%` }}
                      transition={sharedSpring}
                    />
                  </div>
                </div>
              )}

              {/* ONE Persistent Morphing Outer Card Shell */}
              <motion.div
                layout={!prefersReducedMotion}
                transition={sharedSpring}
                className="w-full max-w-md bg-[var(--bg-elevated)] text-[var(--label-primary)] rounded-[32px] p-5 sm:p-8 relative overflow-hidden shadow-xl border border-[var(--separator)] transition-colors duration-300"
              >
                <AnimatePresence mode="popLayout" custom={direction} initial={false}>
                  {/* STEP 1: MINIMALIST SERENE HERO + CLICKABLE DROPLET */}
                  {step === 1 && (
                    <StepSlide
                      key="step-1"
                      direction={direction}
                      variants={stepVariants}
                      transition={stepTransition}
                    >
                      {/* Soft sky aura top tint fading cleanly into card surface */}
                      <div
                        className={`-mx-5 -mt-5 sm:-mx-8 sm:-mt-8 px-5 pt-10 pb-6 sm:px-8 flex flex-col items-center justify-center transition-colors duration-300 ${darkMode
                          ? 'bg-gradient-to-b from-[#13202F] via-[#0F1722]/60 to-transparent'
                          : 'bg-gradient-to-b from-[#DCEEFF] via-[#EFF6FF]/70 to-transparent'
                          }`}
                      >
                        <motion.div
                          layoutId={prefersReducedMotion ? undefined : 'onboard-hero-mascot'}
                          transition={sharedSpring}
                          className={
                            darkMode
                              ? 'drop-shadow-[0_14px_28px_rgba(94,194,243,0.18)]'
                              : 'drop-shadow-[0_14px_28px_rgba(37,99,235,0.16)]'
                          }
                        >
                          <motion.div
                            animate={prefersReducedMotion ? undefined : { y: [0, -5, 0] }}
                            transition={
                              prefersReducedMotion
                                ? undefined
                                : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
                            }
                          >
                            <DropletMascot
                              state={heroDropletState}
                              expression="heureux"
                              size={112}
                              inkColor={darkMode ? '#5EC2F3' : '#2563EB'}
                              paperColor={darkMode ? '#14191F' : '#FFFFFF'}
                              notifColor="#10B981"
                              interactive
                              onTap={cycleHeroDropletState}
                              ariaLabel="Mascote gotinha — toque para mudar o humor"
                            />
                          </motion.div>
                        </motion.div>
                      </div>

                      <div className="pt-2 text-center">
                        <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.025em] text-[var(--label-primary)] leading-[1.14]">
                          Caminhe pela UFSC no claro.{' '}
                          <span className={darkMode ? 'text-[#5EC2F3]' : 'text-[#2563EB]'}>
                            E acompanhado.
                          </span>
                        </h1>

                        <p className="text-sm text-[var(--label-secondary)] mt-3 leading-relaxed max-w-[32ch] mx-auto">
                          Rotas iluminadas em tempo real e caminhada em grupo pelo campus Trindade.
                        </p>
                      </div>

                      {/* Single Onyx Pill CTA + Subtle Gov.br Link */}
                      <div className="mt-7 space-y-2.5">
                        <button
                          type="button"
                          onClick={() => goToStep(2)}
                          className={`w-full min-h-[54px] px-6 rounded-full text-base font-semibold inline-flex items-center justify-center gap-2 enabled:active:scale-[0.97] transition-[transform,background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${darkMode
                            ? 'bg-white text-[#0A0A0A] hover:bg-white/92 shadow-[0_8px_24px_rgba(255,255,255,0.12)]'
                            : 'bg-[#111827] text-white hover:bg-[#1F2937] shadow-[0_10px_24px_rgba(17,24,39,0.18)]'
                            }`}
                        >
                          <span>Começar meu trajeto</span>
                          <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          className="w-full min-h-[44px] px-4 rounded-full text-sm font-medium text-[var(--label-secondary)] hover:text-[var(--label-primary)] enabled:active:scale-[0.97] transition-colors duration-150 cursor-pointer text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
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
                      {/* Top Navigation Row (matches Step 4's top-left iOS Back placement) */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => goToStep(1)}
                          className={`min-h-[44px] inline-flex items-center gap-0.5 pl-1.5 pr-3 py-2 rounded-full text-sm font-medium active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${darkMode
                            ? 'text-[#5EC2F3] bg-white/10 hover:bg-white/15 border border-white/15'
                            : 'text-[#2563EB] bg-[#EFF6FF]/90 hover:bg-[#DBEAFE]/80 border border-[#DBEAFE]/80'
                            }`}
                        >
                          <ChevronLeft className="w-5 h-5 -ml-0.5 shrink-0" aria-hidden="true" />
                          <span>Voltar</span>
                        </button>
                        {renderContextPill(
                          darkMode
                            ? 'bg-white/10 text-[#5EC2F3] border border-white/15'
                            : 'bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]'
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="space-y-1.5 min-w-0">
                          <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--label-secondary)]">
                            Preferências
                          </span>
                          <h2 className="text-2xl font-semibold tracking-tight text-[var(--label-primary)]">
                            Seus trajetos e horários frequentes
                          </h2>
                          <p className="text-sm text-[var(--label-secondary)]">
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
                            expression={darkMode ? 'attentif' : 'heureux'}
                            size={74}
                            inkColor={darkMode ? '#5EC2F3' : '#2563EB'}
                            paperColor={darkMode ? '#14191F' : '#FFFFFF'}
                            notifColor="#10B981"
                            ariaLabel="Mascote acompanhando suas preferências"
                          />
                        </motion.div>
                      </div>

                      {/* Building Selection Multi-Select Tactile Chips */}
                      <div className="mt-5">
                        <span
                          id="onboard-buildings-label"
                          className="block text-xs font-semibold text-[var(--label-secondary)] uppercase tracking-wider mb-2"
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
                                className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-medium transition-[transform,background-color,border-color,color,box-shadow] duration-150 enabled:active:scale-[0.96] cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${isSelected
                                  ? darkMode
                                    ? 'bg-[#5EC2F3] text-[#0A0A0A] border-[#5EC2F3] shadow-sm font-semibold'
                                    : 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                                  : darkMode
                                    ? 'bg-[var(--bg-elevated-secondary)] text-[var(--label-primary)] border-[var(--separator)] hover:bg-white/15'
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
                          className="block text-xs font-semibold text-[var(--label-secondary)] uppercase tracking-wider mb-2"
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
                                className={`relative min-h-[44px] flex items-center justify-center rounded-2xl text-xs sm:text-sm font-medium transition-[transform,color,border-color] duration-150 enabled:active:scale-[0.96] cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${isSelected
                                  ? darkMode
                                    ? 'text-[#0A0A0A] border-[#5EC2F3] font-semibold'
                                    : 'text-white border-[#2563EB]'
                                  : darkMode
                                    ? 'bg-[var(--bg-elevated-secondary)] text-[var(--label-primary)] border-[var(--separator)] hover:bg-white/15'
                                    : 'bg-[#F8FAFC] text-[#111827] border-[#E5EAF4] hover:bg-[#EFF6FF]'
                                  }`}
                              >
                                {isSelected && (
                                  <motion.span
                                    layoutId={prefersReducedMotion ? undefined : 'onboard-timeslot-pill'}
                                    transition={segmentSpring}
                                    aria-hidden="true"
                                    className={`absolute inset-0 rounded-2xl shadow-sm ${darkMode ? 'bg-[#5EC2F3]' : 'bg-[#2563EB]'
                                      }`}
                                  />
                                )}
                                <span className="relative z-10 inline-flex items-center">
                                  <Clock
                                    className={`w-3.5 h-3.5 mr-1.5 ${isSelected
                                      ? darkMode
                                        ? 'text-[#0A0A0A]'
                                        : 'text-white'
                                      : darkMode
                                        ? 'text-[#5EC2F3]'
                                        : 'text-[#2563EB]'
                                      }`}
                                    aria-hidden="true"
                                  />
                                  {slot}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Live App Appearance Switch (Modo Claro / Modo Escuro) */}
                      <div className="mt-5">
                        <span
                          id="onboard-apptheme-label"
                          className="block text-xs font-semibold text-[var(--label-secondary)] uppercase tracking-wider mb-2"
                        >
                          Aparência do aplicativo
                        </span>
                        <div
                          role="group"
                          aria-labelledby="onboard-apptheme-label"
                          className="grid grid-cols-2 gap-2"
                        >
                          <button
                            type="button"
                            aria-pressed={appTheme === 'claro'}
                            onClick={() => handleSelectAppTheme('claro')}
                            className={`relative min-h-[44px] px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-[transform,color,border-color] duration-150 enabled:active:scale-[0.96] cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${appTheme === 'claro'
                              ? 'text-white border-[#111827]'
                              : darkMode
                                ? 'bg-[var(--bg-elevated-secondary)] text-[var(--label-primary)] border-[var(--separator)] hover:bg-white/15'
                                : 'bg-[#F8FAFC] text-[#111827] border-[#E5EAF4] hover:bg-[#EFF6FF]'
                              }`}
                          >
                            {appTheme === 'claro' && (
                              <motion.span
                                layoutId={prefersReducedMotion ? undefined : 'onboard-apptheme-pill'}
                                transition={segmentSpring}
                                aria-hidden="true"
                                className="absolute inset-0 rounded-2xl bg-[#111827] shadow-sm"
                              />
                            )}
                            <span className="relative z-10 inline-flex items-center gap-1.5">
                              <Sun
                                className={`w-4 h-4 shrink-0 ${appTheme === 'claro' ? 'text-[#F7C648]' : 'text-[#2563EB]'}`}
                                aria-hidden="true"
                              />
                              <span>Modo Claro</span>
                            </span>
                          </button>

                          <button
                            type="button"
                            aria-pressed={appTheme === 'escuro'}
                            onClick={() => handleSelectAppTheme('escuro')}
                            className={`relative min-h-[44px] px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-[transform,color,border-color] duration-150 enabled:active:scale-[0.96] cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EC2F3] ${appTheme === 'escuro'
                              ? 'text-[#0A0A0A] border-white font-semibold'
                              : 'bg-[#F8FAFC] text-[#111827] border-[#E5EAF4] hover:bg-[#EFF6FF]'
                              }`}
                          >
                            {appTheme === 'escuro' && (
                              <motion.span
                                layoutId={prefersReducedMotion ? undefined : 'onboard-apptheme-pill'}
                                transition={segmentSpring}
                                aria-hidden="true"
                                className="absolute inset-0 rounded-2xl bg-white shadow-sm"
                              />
                            )}
                            <span className="relative z-10 inline-flex items-center gap-1.5">
                              <Moon
                                className={`w-4 h-4 shrink-0 ${appTheme === 'escuro' ? 'text-[#0A0A0A]' : 'text-[#2563EB]'}`}
                                aria-hidden="true"
                              />
                              <span>Modo Escuro</span>
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Primary Full-Width Apple Pill CTA */}
                      <div className="mt-7">
                        <button
                          type="button"
                          onClick={() => goToStep(3)}
                          className={`w-full min-h-[48px] px-6 rounded-full text-base font-semibold inline-flex items-center justify-center gap-2 enabled:active:scale-[0.97] transition-[transform,background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${darkMode
                            ? 'bg-white text-[#0A0A0A] hover:bg-white/92 shadow-sm'
                            : 'bg-[#111827] text-white hover:bg-[#1F2937] shadow-sm'
                            }`}
                        >
                          <span>Ver meu trajeto seguro</span>
                          <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                        </button>
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
                      {/* Top Navigation Row (matches Step 2 & Step 4 top-left iOS Back placement) */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => goToStep(2)}
                          className={`min-h-[44px] inline-flex items-center gap-0.5 pl-1.5 pr-3 py-2 rounded-full text-sm font-medium active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${darkMode
                            ? 'text-[#5EC2F3] bg-white/10 hover:bg-white/15 border border-white/15'
                            : 'text-[#2563EB] bg-[#EFF6FF]/90 hover:bg-[#DBEAFE]/80 border border-[#DBEAFE]/80'
                            }`}
                        >
                          <ChevronLeft className="w-5 h-5 -ml-0.5 shrink-0" aria-hidden="true" />
                          <span>Voltar</span>
                        </button>
                        {renderContextPill(
                          darkMode
                            ? 'bg-[#064E3B]/60 text-[#6EE7B7] border border-[#10B981]/30'
                            : 'bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]'
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--label-secondary)] mb-1">
                            Aha! Preview
                          </span>
                          <h2 className="text-2xl font-semibold tracking-tight text-[var(--label-primary)]">
                            Seu corredor inteligente
                          </h2>
                          <p className="text-sm text-[var(--label-secondary)] mt-1">
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
                            inkColor={darkMode ? '#5EC2F3' : '#2563EB'}
                            paperColor={darkMode ? '#14191F' : '#FFFFFF'}
                            notifColor="#10B981"
                            interactive
                            onTap={() => setCompanionHighlighted((prev) => !prev)}
                            ariaLabel="Mascote celebrando seu corredor seguro"
                          />
                        </motion.div>
                      </div>

                      {/* Personalized Recap & Progressive Calibration Strip */}
                      <div
                        className={`mt-4 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-2xl border text-xs ${darkMode
                          ? 'bg-[#101D2C] border-[#5EC2F3]/20'
                          : 'bg-[#EFF6FF] border-[#DBEAFE]'
                          }`}
                      >
                        <span className={`font-medium ${darkMode ? 'text-[#BAE6FD]' : 'text-[#1E3A8A]'}`}>
                          Construído para o seu trajeto:{' '}
                          <strong className="font-semibold">
                            {corridorLabel} • {timeSlot} • {appTheme === 'escuro' ? 'Modo Escuro' : 'Modo Claro'}
                          </strong>
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${darkMode
                            ? 'text-[#6EE7B7] bg-[#0B1F19] border-[#10B981]/30'
                            : 'text-[#065F46] bg-white border-[#A7F3D0]'
                            }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`w-1.5 h-1.5 rounded-full bg-[#10B981] ${prefersReducedMotion ? '' : 'animate-pulse'
                              }`}
                          />
                          Calibrado com postes da Trindade
                        </span>
                      </div>

                      {/* Corridor Origin/Destination Card */}
                      <div className="mt-3.5 p-4 rounded-2xl bg-[var(--bg-elevated-secondary)] border border-[var(--separator)] space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MapPin
                              className={`w-4 h-4 ${darkMode ? 'text-[#5EC2F3]' : 'text-[#2563EB]'}`}
                              aria-hidden="true"
                            />
                            <span className="text-sm font-semibold uppercase text-[var(--label-primary)]">
                              {corridorLabel}
                            </span>
                          </div>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full border border-[var(--separator)] ${darkMode
                              ? 'bg-[#0E1319] text-[#5EC2F3]'
                              : 'bg-white text-[#2563EB]'
                              }`}
                          >
                            {timeSlot}
                          </span>
                        </div>

                        {/* Illumination & Distance Stat with smooth count-up */}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div
                            className={`p-3 rounded-xl border border-[var(--separator)] ${darkMode ? 'bg-[#0E1319]/90' : 'bg-white'
                              }`}
                          >
                            <div className="flex items-center gap-1.5 text-xs text-[var(--label-secondary)] font-medium">
                              <Lightbulb className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
                              <span>Iluminação</span>
                            </div>
                            <div className="text-2xl font-semibold text-[var(--label-primary)] mt-1 tabular-nums">
                              {animatedIllum}
                              <span className="text-sm font-normal text-[var(--label-secondary)]">% iluminado</span>
                            </div>
                          </div>

                          <div
                            className={`p-3 rounded-xl border border-[var(--separator)] ${darkMode ? 'bg-[#0E1319]/90' : 'bg-white'
                              }`}
                          >
                            <div className="flex items-center gap-1.5 text-xs text-[var(--label-secondary)] font-medium">
                              <Clock
                                className={`w-3.5 h-3.5 ${darkMode ? 'text-[#5EC2F3]' : 'text-[#2563EB]'}`}
                                aria-hidden="true"
                              />
                              <span>Caminhada</span>
                            </div>
                            <div className="text-2xl font-semibold text-[var(--label-primary)] mt-1 tabular-nums">
                              ~{animatedMinutes}{' '}
                              <span className="text-sm font-normal text-[var(--label-secondary)]">min a pé</span>
                            </div>
                            <div className="text-xs text-[var(--label-secondary)]">
                              {previewRoute.distanceMeters}m de extensão
                            </div>
                          </div>
                        </div>

                        {/* Interactive Verified Peers Preview Card */}
                        <button
                          type="button"
                          aria-pressed={companionHighlighted}
                          onClick={() => setCompanionHighlighted((prev) => !prev)}
                          className={`w-full min-h-[44px] p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-[transform,background-color,border-color,color] duration-150 enabled:active:scale-[0.98] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${companionHighlighted
                            ? darkMode
                              ? 'bg-[#5EC2F3] text-[#0A0A0A] border-[#5EC2F3]'
                              : 'bg-[#2563EB] text-white border-[#2563EB]'
                            : darkMode
                              ? 'bg-[#0E1319]/90 text-[var(--label-primary)] border-[var(--separator)] hover:border-[#5EC2F3]/50'
                              : 'bg-white text-[#111827] border-[#E5EAF4] hover:border-[#2563EB]/40'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Users
                              className={`w-4 h-4 shrink-0 ${companionHighlighted
                                ? darkMode
                                  ? 'text-[#0A0A0A]'
                                  : 'text-white'
                                : darkMode
                                  ? 'text-[#5EC2F3]'
                                  : 'text-[#2563EB]'
                                }`}
                              aria-hidden="true"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium tabular-nums">
                                {animatedPeers} estudantes verificados
                              </div>
                              <div
                                className={`text-xs ${companionHighlighted
                                  ? darkMode
                                    ? 'text-[#0A0A0A]/80'
                                    : 'text-white/85'
                                  : 'text-[var(--label-secondary)]'
                                  }`}
                              >
                                Caminhando no seu horário
                              </div>
                            </div>
                          </div>
                          <div className="flex -space-x-1.5 overflow-hidden shrink-0" aria-hidden="true">
                            <span
                              className={`inline-block h-6 w-6 rounded-full bg-[#2563EB] text-white text-[10px] font-semibold text-center leading-6 ring-2 ${darkMode ? 'ring-[#0E1319]' : 'ring-white'
                                }`}
                            >
                              MS
                            </span>
                            <span
                              className={`inline-block h-6 w-6 rounded-full bg-[#111827] text-white text-[10px] font-semibold text-center leading-6 ring-2 ${darkMode ? 'ring-[#0E1319]' : 'ring-white'
                                }`}
                            >
                              CD
                            </span>
                            <span
                              className={`inline-block h-6 w-6 rounded-full bg-[#10B981] text-white text-[10px] font-semibold text-center leading-6 ring-2 ${darkMode ? 'ring-[#0E1319]' : 'ring-white'
                                }`}
                            >
                              GS
                            </span>
                          </div>
                        </button>
                      </div>

                      {/* Trust statement */}
                      <p className="text-xs text-[var(--label-secondary)] mt-4 leading-relaxed">
                        Você não precisa caminhar no escuro ou sozinho. Complete a identificação Gov.br para entrar em grupos de caminhada monitorada.
                      </p>

                      {/* Primary Full-Width Apple Pill CTA */}
                      <div className="mt-7">
                        <button
                          type="button"
                          onClick={() => goToStep(4)}
                          className={`w-full min-h-[48px] px-4 rounded-full text-sm font-semibold whitespace-nowrap inline-flex items-center justify-center gap-2 enabled:active:scale-[0.97] transition-[transform,background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${darkMode
                            ? 'bg-white text-[#0A0A0A] hover:bg-white/92 shadow-sm'
                            : 'bg-[#111827] text-white hover:bg-[#1F2937] shadow-sm'
                            }`}
                        >
                          <span>Validar acesso Gov.br</span>
                          <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                        </button>
                      </div>
                    </StepSlide>
                  )}

                  {/* STEP 4: INTERACTIVE WELCOMEBACK TRIO + GOV.BR + @UFSC.BR OTP */}
                  {step === 4 && (
                    <StepSlide
                      key={otpChallenge ? 'step-4-otp' : 'step-4'}
                      direction={direction}
                      variants={stepVariants}
                      transition={stepTransition}
                    >
                      {otpChallenge ? (
                        <VerificationCodeOtp
                          challenge={otpChallenge}
                          onVerifyCode={async (code) => {
                            await verifyUfscOtpCode(otpChallenge.email, code);
                          }}
                          onResendCode={async () => {
                            const refreshed = await sendUfscOtpCode(otpChallenge.email);
                            setOtpChallenge(refreshed);
                            return refreshed;
                          }}
                          onBack={() => setOtpChallenge(null)}
                          onVerified={() => {
                            setOtpChallenge(null);
                            setDirection(1);
                            setStep(5);
                          }}
                        />
                      ) : (
                        <InteractiveCrewSignUp
                          name={name}
                          onNameChange={(val) => {
                            setName(val);
                            if (error) setError(null);
                          }}
                          ufscEmail={ufscEmail}
                          onUfscEmailChange={(val) => {
                            setUfscEmail(val);
                            if (error) setError(null);
                          }}
                          affiliation={affiliation}
                          onAffiliationChange={(val) => {
                            setAffiliation(val);
                            if (error) setError(null);
                          }}
                          cpf={cpf}
                          onCpfChange={(val) => {
                            setCpf(val);
                            if (error) setError(null);
                          }}
                          error={error}
                          errorShakeKey={errorShakeKey}
                          isVerifying={isVerifying}
                          checklistStep={checklistStep}
                          corridorLabel={corridorLabel}
                          darkMode={darkMode}
                          onAutofillDemo={handleAutofillDemo}
                          onSubmit={handleGovBrSubmit}
                          onBack={() => goToStep(3)}
                        />
                      )}
                    </StepSlide>
                  )}

                  {/* STEP 5: "TUDO PRONTO!" — WELCOMEBACK SUNBURST / OPAL SLATE + CENTERED TRIO SHOWCASE */}
                  {step === 5 && (
                    <StepSlide
                      key="step-5"
                      direction={direction}
                      variants={stepVariants}
                      transition={stepTransition}
                    >
                      <div
                        onPointerMove={welcomeGaze.handlePointerMove}
                        onPointerLeave={welcomeGaze.handlePointerLeave}
                        className={`-mx-5 -my-5 sm:-mx-8 sm:-my-8 min-h-[540px] flex flex-col justify-between relative overflow-hidden select-none transition-colors duration-300 ${darkMode ? 'bg-[#0A0A0A] text-[#E5E4E2]' : 'bg-white text-[#454954]'
                          }`}
                        style={{ fontFamily: "'SF Pro Text', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                      >
                        {/* Radiant sky sunburst (light) or subtle Opal Slate glow (dark) */}
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-0 top-0 h-[52%] overflow-hidden"
                          style={{
                            background: darkMode
                              ? 'linear-gradient(180deg, #101C29 0%, #0D141D 52%, #0A0A0A 100%)'
                              : 'linear-gradient(180deg, #CDE7FF 0%, #E8F4FF 56%, #FFFFFF 100%)',
                          }}
                        >
                          <div
                            className="absolute -top-8 left-1/2 -translate-x-1/2 w-[170%] h-full opacity-90"
                            style={{
                              background: darkMode
                                ? 'repeating-conic-gradient(from 138deg at 50% 0%, rgba(94,194,243,0.09) 0deg 8deg, rgba(255,255,255,0.02) 8deg 19deg)'
                                : 'repeating-conic-gradient(from 138deg at 50% 0%, rgba(255,255,255,0.44) 0deg 8deg, rgba(168,214,255,0.20) 8deg 19deg)',
                              maskImage:
                                'radial-gradient(ellipse 90% 92% at 50% 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0) 88%)',
                              WebkitMaskImage:
                                'radial-gradient(ellipse 90% 92% at 50% 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0) 88%)',
                            }}
                          />
                        </div>

                        {/* Top minimal bar with UFSC crest & emerald-dot Conectado pill */}
                        <header className="relative z-20 px-6 pt-6 flex items-center justify-between">
                          <img
                            src={ufscLogo}
                            alt="UFSC"
                            width={119}
                            height={160}
                            decoding="async"
                            className={`h-10 w-auto object-contain select-none pointer-events-none ${darkMode ? 'brightness-0 invert opacity-90' : ''
                              }`}
                          />

                          <div
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md border shadow-xs text-xs font-semibold ${darkMode
                              ? 'bg-[#14191F]/85 border-white/15 text-[#6EE7B7]'
                              : 'bg-white/85 border-white text-[#065F46]'
                              }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full bg-[#22C55E] shadow-[0_0_0_4px_rgba(34,197,94,0.2)]"
                              aria-hidden="true"
                            />
                            <span>Conectado</span>
                          </div>
                        </header>

                        {/* STEP 4: INTERACTIVE WELCOMEBACK TRIO + GOV.BR + @UFSC.BR OTP */}
                        {step === 4 && (
                          <StepSlide
                            key={otpChallenge ? 'step-4-otp' : 'step-4'}
                            direction={direction}
                            variants={stepVariants}
                            transition={stepTransition}
                          >
                            {otpChallenge ? (
                              <VerificationCodeOtp
                                challenge={otpChallenge}
                                darkMode={darkMode}
                                onVerifyCode={async (code) => {
                                  await verifyUfscOtpCode(otpChallenge.email, code);
                                }}
                                onResendCode={async () => {
                                  const refreshed = await sendUfscOtpCode(otpChallenge.email);
                                  setOtpChallenge(refreshed);
                                  return refreshed;
                                }}
                                onBack={() => setOtpChallenge(null)}
                                onVerified={() => {
                                  setOtpChallenge(null);
                                  setDirection(1);
                                  setStep(5);
                                }}
                              />
                            ) : (
                              <InteractiveCrewSignUp
                                name={name}
                                onNameChange={(val) => {
                                  setName(val);
                                  if (error) setError(null);
                                }}
                                ufscEmail={ufscEmail}
                                onUfscEmailChange={(val) => {
                                  setUfscEmail(val);
                                  if (error) setError(null);
                                }}
                                affiliation={affiliation}
                                onAffiliationChange={(val) => {
                                  setAffiliation(val);
                                  if (error) setError(null);
                                }}
                                cpf={cpf}
                                onCpfChange={(val) => {
                                  setCpf(val);
                                  if (error) setError(null);
                                }}
                                error={error}
                                errorShakeKey={errorShakeKey}
                                isVerifying={isVerifying}
                                checklistStep={checklistStep}
                                corridorLabel={corridorLabel}
                                darkMode={darkMode}
                                onAutofillDemo={handleAutofillDemo}
                                onSubmit={handleGovBrSubmit}
                                onBack={() => goToStep(3)}
                              />
                            )}
                          </StepSlide>
                        )}

                        {pendingSession && (
                          <div
                            className={`mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md border shadow-2xs text-xs font-medium ${darkMode
                              ? 'bg-[#14191F]/85 border-white/12 text-[#E5E4E2]'
                              : 'bg-white/85 border-[#E2E8F0] text-[#334155]'
                              }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
                            <span>{pendingSession.cpfMasked}</span>
                            <span
                              className={darkMode ? 'text-white/25' : 'text-[#CBD5E1]'}
                              aria-hidden="true"
                            >
                              •
                            </span>
                            <span className={darkMode ? 'text-[#5EC2F3] font-semibold' : 'text-[#2563EB] font-semibold'}>
                              {corridorLabel}
                            </span>
                          </div>
                        )}

                        <div className="mt-5">
                          <button
                            type="button"
                            onClick={handleEnterCampus}
                            className={`min-h-[48px] px-7 rounded-full text-sm font-medium inline-flex items-center gap-2 enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ${darkMode
                              ? 'bg-white hover:bg-white/92 text-[#0A0A0A] shadow-[0_12px_28px_rgba(255,255,255,0.12)] focus-visible:outline-white'
                              : 'bg-[#111827] hover:bg-[#1F2937] text-white shadow-[0_12px_28px_rgba(17,24,39,0.22)] focus-visible:outline-[#111827]'
                              }`}
                          >
                            <span>Entrar no campus</span>
                            <ArrowRight className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </main>

                      {/* Exact WelcomeBack Trio mascots centered cleanly across the bottom */}
                      <WelcomeBackTrioShowcase variant="centered" gaze={welcomeGaze} />
                    </div>
                    </StepSlide>
                  )}
              </AnimatePresence>
            </motion.div>
          </div>
        </LayoutGroup>
        </motion.div>
  )
}
    </AnimatePresence >
  );
};
