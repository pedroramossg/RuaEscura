import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
} from 'lucide-react';
import { useCampusStore } from '../../hooks/useCampusStore';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { PillButton } from '../ui/PillButton';
import { DropletMascot } from '../mascot/DropletMascot';
import type { StateId } from '../../mascot/bloub/states';
import { findRoute } from '../../engine/routing';
import { GovBrAuthSchema, maskCpf } from '../../security/schemas';

export interface OnboardingFlowProps {
  onComplete?: () => void;
}

const UFSC_OPTIONS = [
  { id: 'bu', label: 'BU', shortName: 'BU', name: 'Biblioteca Central', desc: 'Biblioteca Central' },
  { id: 'ru', label: 'RU', shortName: 'RU', name: 'Restaurante Universitário', desc: 'Restaurante Univ.' },
  { id: 'cce', label: 'CCE', shortName: 'CCE', name: 'Centro de Comunicação e Expressão', desc: 'Comunicação e Artes' },
  { id: 'cse', label: 'CSE', shortName: 'CSE', name: 'Centro Socioeconômico', desc: 'Socioeconômico' },
  { id: 'ccj', label: 'CCJ', shortName: 'CCJ', name: 'Centro de Ciências Jurídicas', desc: 'Direito' },
  { id: 'cfh', label: 'CFH', shortName: 'CFH', name: 'Centro de Filosofia e Ciências Humanas', desc: 'Humanas' },
  { id: 'reitoria', label: 'Reitoria', shortName: 'Reitoria', name: 'Gabinete da Reitoria', desc: 'Praça da Cidadania' },
  { id: 'bosque', label: 'Bosque', shortName: 'Bosque', name: 'Bosque e Planetário', desc: 'Planetário' },
  { id: 'hu', label: 'HU', shortName: 'HU', name: 'Hospital Universitário', desc: 'Hospital Universitário' },
  { id: 'aplicacao', label: 'Aplicação', shortName: 'Aplicação', name: 'Colégio de Aplicação', desc: 'Colégio' },
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

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const {
    posts,
    edgeRatings,
    reports,
    companionMatches,
    completeOnboarding,
  } = useCampusStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Mascot state per step
  const [heroDropletState, setHeroDropletState] = useState<StateId>('orbit');
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

  const goToStep = (nextStep: 1 | 2 | 3 | 4) => {
    setDirection(nextStep >= step ? 1 : -1);
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
        if (prev.length <= 1) return prev; // keep at least 1
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
  const step3MascotState: StateId = companionHighlighted ? 'hexagon' : 'exclaim';

  const step4MascotState: StateId = !isVerifying
    ? 'swirl'
    : checklistStep >= 3
      ? 'burst'
      : 'thinking';

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
      return;
    }

    clearTimers();
    setIsVerifying(true);
    setChecklistStep(1);

    const t1 = window.setTimeout(() => {
      setChecklistStep(2);
    }, 100);

    const t2 = window.setTimeout(() => {
      setChecklistStep(3);
    }, 220);

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

  const springTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : {
        type: 'spring' as const,
        bounce: 0,
        duration: 0.28,
      };

  const stepInitial = prefersReducedMotion
    ? { opacity: 1, x: 0 }
    : { opacity: 0, x: direction * 22 };

  return (
    <div className="min-h-screen w-full bg-[#FEF1CF] text-[#0B1226] flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-300">
      <AnimatePresence initial={false}>
        {/* STEP 1: DEEP COBALT STAGE + VOLT GLOW + ANIMATED CORRIDOR + DROPLET MASCOT */}
        {step === 1 && (
          <motion.div
            key="step-1"
            initial={stepInitial}
            animate={{ opacity: 1, x: 0 }}
            transition={springTransition}
            className="w-full max-w-md bg-[#0131CD] text-white rounded-[32px] p-5 sm:p-8 relative overflow-hidden shadow-2xl border border-[#B9FC01]/25"
          >
            {/* Volt Lime curved ambient glow */}
            <div
              className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-64 rounded-full bg-[#B9FC01]/25 blur-[64px] pointer-events-none"
              aria-hidden="true"
            />

            {/* Header Badge */}
            <div className="relative flex items-center justify-between gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#B9FC01]/15 text-[#B9FC01] border border-[#B9FC01]/35">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>UFSC Campus Trindade</span>
              </span>
              <span className="text-xs font-medium text-[#FEF1CF]/90">Etapa 1 de 4</span>
            </div>

            {/* Interactive DropletMascot + Animated SVG UFSC Corridor */}
            <div className="relative flex flex-col items-center gap-2 py-1">
              <DropletMascot
                state={heroDropletState}
                size={88}
                inkColor="#B9FC01"
                paperColor="#0131CD"
                notifColor="#FEF1CF"
                interactive
                onTap={cycleHeroDropletState}
                ariaLabel="Mascote gota RuaEscura — toque para mudar o humor"
              />

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#080E21]/45 text-[#FEF1CF] border border-[#B9FC01]/30">
                Toque na gotinha para mudar o humor
              </span>

              <div className="w-full flex justify-center pt-1" aria-hidden="true">
                <svg className="w-full h-24" viewBox="0 0 320 96" fill="none">
                  <defs>
                    <filter id="glow-volt" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="5" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  <motion.path
                    d="M 25 60 Q 90 16 160 50 T 295 40"
                    stroke="#B9FC01"
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#glow-volt)"
                    initial={prefersReducedMotion ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={prefersReducedMotion ? undefined : { duration: 0.9, ease: 'easeOut' }}
                  />
                  <motion.path
                    d="M 25 60 Q 90 16 160 50 T 295 40"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={prefersReducedMotion ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={prefersReducedMotion ? undefined : { duration: 0.9, ease: 'easeOut' }}
                  />
                  <circle cx="25" cy="60" r="7" fill="#B9FC01" />
                  <circle cx="160" cy="50" r="6" fill="#B9FC01" />
                  <circle cx="295" cy="40" r="7" fill="#B9FC01" />
                  <text x="25" y="84" fill="#FEF1CF" fontSize="11" textAnchor="middle" fontWeight="500">
                    BU
                  </text>
                  <text x="160" y="74" fill="#FEF1CF" fontSize="11" textAnchor="middle" fontWeight="500">
                    Reitoria
                  </text>
                  <text x="295" y="64" fill="#FEF1CF" fontSize="11" textAnchor="middle" fontWeight="500">
                    RU
                  </text>
                </svg>
              </div>
            </div>

            {/* Outcome Headline */}
            <h1 className="relative text-3xl sm:text-4xl font-normal tracking-tight text-white mt-2 leading-tight">
              Caminhe pela UFSC no claro. <span className="text-[#B9FC01]">E acompanhado.</span>
            </h1>

            <p className="relative text-base text-[#FEF1CF] mt-3 leading-relaxed">
              Descubra trajetos com iluminação verificada em tempo real e conecte-se com colegas fazendo o mesmo caminho pelo campus Trindade.
            </p>

            {/* Actions */}
            <div className="relative mt-7 space-y-3">
              <PillButton
                variant="lime"
                size="feature"
                className="w-full shadow-lg shadow-[#080E21]/25 font-semibold text-lg"
                onClick={() => goToStep(2)}
              >
                Começar meu trajeto →
              </PillButton>

              <button
                type="button"
                className="w-full min-h-[44px] py-2 text-sm font-medium text-[#FEF1CF] hover:text-[#B9FC01] transition-colors cursor-pointer text-center underline-offset-4 hover:underline rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B9FC01]"
                onClick={() => {
                  setSelectedBuildings(['bu', 'ru', 'cce']);
                  goToStep(4);
                }}
              >
                Já tenho conta Gov.br
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: PERSONALIZATION CANVAS + REACTIVE MASCOT */}
        {step === 2 && (
          <motion.div
            key="step-2"
            initial={stepInitial}
            animate={{ opacity: 1, x: 0 }}
            transition={springTransition}
            className="w-full max-w-md bg-white text-[#0B1226] rounded-[32px] p-5 sm:p-8 shadow-xl border border-[#E4D6B2]"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-semibold text-[#334155]">
                    Etapa 2 de 4
                  </span>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-[#FEF1CF] text-[#0131CD] border border-[#E4D6B2]">
                    Preferências
                  </span>
                </div>
                <h2 className="text-2xl font-medium tracking-tight text-[#0B1226]">
                  Seus trajetos e horários frequentes
                </h2>
                <p className="text-sm text-[#334155]">
                  Personalize seu mapa seguro da UFSC
                </p>
              </div>

              <div className="shrink-0">
                <DropletMascot
                  state={step2MascotState}
                  size={60}
                  inkColor="#0131CD"
                  paperColor="#FFFFFF"
                  notifColor="#B9FC01"
                  ariaLabel="Mascote acompanhando suas preferências"
                />
              </div>
            </div>

            {/* Building Selection Multi-Select Chips */}
            <div className="mt-5">
              <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-2">
                Prédios e centros que você frequenta
              </label>
              <div className="flex flex-wrap gap-2">
                {UFSC_OPTIONS.map((item) => {
                  const isSelected = selectedBuildings.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${item.shortName} — ${item.name}`}
                      onClick={() => toggleBuilding(item.id)}
                      className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0131CD] ${
                        isSelected
                          ? 'bg-[#0131CD] text-[#B9FC01] border-[#0131CD] shadow-sm'
                          : 'bg-[#FEF1CF] text-[#0B1226] border-[#E4D6B2] hover:bg-[#F5E3B3]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slot Selection */}
            <div className="mt-5">
              <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-2">
                Horário principal de retorno
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TIME_SLOTS.map((slot) => {
                  const isSelected = timeSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleSelectTimeSlot(slot)}
                      className={`min-h-[44px] flex items-center justify-center rounded-2xl text-xs sm:text-sm font-medium transition-all cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0131CD] ${
                        isSelected
                          ? 'bg-[#0131CD] text-[#FEF1CF] border-[#0131CD] shadow-sm'
                          : 'bg-[#FEF1CF] text-[#0B1226] border-[#E4D6B2] hover:bg-[#F5E3B3]'
                      }`}
                    >
                      <Clock
                        className={`w-3.5 h-3.5 mr-1.5 ${isSelected ? 'text-[#B9FC01]' : 'text-[#0131CD]'}`}
                        aria-hidden="true"
                      />
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Map Style Selection */}
            <div className="mt-5">
              <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-2">
                Modo visual inicial do mapa
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={mapMode === 'claro'}
                  onClick={() => handleSelectMapMode('claro')}
                  className={`min-h-[44px] px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0131CD] ${
                    mapMode === 'claro'
                      ? 'bg-[#0131CD] text-[#FEF1CF] border-[#0131CD] shadow-sm'
                      : 'bg-[#FEF1CF] text-[#0B1226] border-[#E4D6B2] hover:bg-[#F5E3B3]'
                  }`}
                >
                  <Sun
                    className={`w-4 h-4 shrink-0 ${mapMode === 'claro' ? 'text-[#B9FC01]' : 'text-[#0131CD]'}`}
                    aria-hidden="true"
                  />
                  <span>Claro + Modo Noturno</span>
                </button>

                <button
                  type="button"
                  aria-pressed={mapMode === 'noturno'}
                  onClick={() => handleSelectMapMode('noturno')}
                  className={`min-h-[44px] px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0131CD] ${
                    mapMode === 'noturno'
                      ? 'bg-[#0131CD] text-[#FEF1CF] border-[#0131CD] shadow-sm'
                      : 'bg-[#FEF1CF] text-[#0B1226] border-[#E4D6B2] hover:bg-[#F5E3B3]'
                  }`}
                >
                  <Moon
                    className={`w-4 h-4 shrink-0 ${mapMode === 'noturno' ? 'text-[#B9FC01]' : 'text-[#0131CD]'}`}
                    aria-hidden="true"
                  />
                  <span>Sempre Noturno</span>
                </button>
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="mt-7 flex items-center gap-3">
              <button
                type="button"
                aria-label="Voltar"
                onClick={() => goToStep(1)}
                className="min-w-[44px] min-h-[44px] px-4 py-2 rounded-full text-sm font-medium text-[#0B1226] bg-[#FEF1CF] border border-[#E4D6B2] hover:bg-[#F5E3B3] active:scale-[0.97] transition-all cursor-pointer inline-flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0131CD]"
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
          </motion.div>
        )}

        {/* STEP 3: LIVE AHA! MOMENT PREVIEW */}
        {step === 3 && (
          <motion.div
            key="step-3"
            initial={stepInitial}
            animate={{ opacity: 1, x: 0 }}
            transition={springTransition}
            className="w-full max-w-md bg-white text-[#0B1226] rounded-[32px] p-5 sm:p-8 shadow-xl border border-[#E4D6B2]"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#334155]">
                Etapa 3 de 4
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#B9FC01] text-[#0B1226]">
                Aha! Preview
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-medium tracking-tight text-[#0B1226]">
                  Seu corredor inteligente
                </h2>
                <p className="text-sm text-[#334155] mt-1">
                  Trajeto seguro calculado para seu perfil
                </p>
              </div>

              <DropletMascot
                state={step3MascotState}
                size={64}
                inkColor="#0131CD"
                paperColor="#FFFFFF"
                notifColor="#B9FC01"
                interactive
                onTap={() => setCompanionHighlighted((prev) => !prev)}
                ariaLabel="Mascote celebrando seu corredor seguro"
              />
            </div>

            {/* Corridor Origin/Destination Card */}
            <div className="mt-5 p-4 rounded-2xl bg-[#FEF1CF] border border-[#E4D6B2] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#0131CD]" aria-hidden="true" />
                  <span className="text-sm font-semibold uppercase text-[#0B1226]">
                    {originId.toUpperCase()} → {destId.toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-[#0131CD] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#E4D6B2]">
                  {timeSlot}
                </span>
              </div>

              {/* Illumination & Distance Stat */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-white rounded-xl border border-[#E4D6B2]">
                  <div className="flex items-center gap-1.5 text-xs text-[#334155] font-medium">
                    <Lightbulb className="w-3.5 h-3.5 text-[#0131CD]" aria-hidden="true" />
                    <span>Iluminação</span>
                  </div>
                  <div className="text-2xl font-semibold text-[#0B1226] mt-1">
                    {previewRoute.illuminationPercentage}
                    <span className="text-sm font-normal text-[#334155]">% iluminado</span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#E4D6B2]">
                  <div className="flex items-center gap-1.5 text-xs text-[#334155] font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#0131CD]" aria-hidden="true" />
                    <span>Caminhada</span>
                  </div>
                  <div className="text-2xl font-semibold text-[#0B1226] mt-1">
                    ~{previewRoute.estimatedMinutes}{' '}
                    <span className="text-sm font-normal text-[#334155]">min a pé</span>
                  </div>
                  <div className="text-xs text-[#334155]">{previewRoute.distanceMeters}m de extensão</div>
                </div>
              </div>

              {/* Interactive Verified Peers Preview Card */}
              <button
                type="button"
                aria-pressed={companionHighlighted}
                onClick={() => setCompanionHighlighted((prev) => !prev)}
                className={`w-full min-h-[44px] p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0131CD] ${
                  companionHighlighted
                    ? 'bg-[#0131CD] text-[#FEF1CF] border-[#0131CD]'
                    : 'bg-white text-[#0B1226] border-[#E4D6B2] hover:border-[#0131CD]/40'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Users
                    className={`w-4 h-4 shrink-0 ${
                      companionHighlighted ? 'text-[#B9FC01]' : 'text-[#0131CD]'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {verifiedPeersCount} estudantes verificados
                    </div>
                    <div
                      className={`text-xs ${
                        companionHighlighted ? 'text-[#FEF1CF]/90' : 'text-[#334155]'
                      }`}
                    >
                      Caminhando no seu horário
                    </div>
                  </div>
                </div>
                <div className="flex -space-x-1.5 overflow-hidden shrink-0" aria-hidden="true">
                  <span className="inline-block h-6 w-6 rounded-full bg-[#0131CD] text-[#B9FC01] text-[10px] font-semibold text-center leading-6 ring-2 ring-white">
                    MS
                  </span>
                  <span className="inline-block h-6 w-6 rounded-full bg-[#0B1226] text-[#FEF1CF] text-[10px] font-semibold text-center leading-6 ring-2 ring-white">
                    CD
                  </span>
                  <span className="inline-block h-6 w-6 rounded-full bg-[#B9FC01] text-[#0B1226] text-[10px] font-semibold text-center leading-6 ring-2 ring-white">
                    GS
                  </span>
                </div>
              </button>
            </div>

            {/* Trust statement */}
            <p className="text-xs text-[#334155] mt-4 leading-relaxed">
              Você não precisa caminhar no escuro ou sozinho. Complete a identificação Gov.br para entrar em grupos de caminhada monitorada.
            </p>

            {/* Navigation Actions */}
            <div className="mt-7 flex items-center gap-3">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="min-h-[44px] px-4 py-2 rounded-full text-sm font-medium text-[#0B1226] bg-[#FEF1CF] border border-[#E4D6B2] hover:bg-[#F5E3B3] active:scale-[0.97] transition-all cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0131CD]"
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
          </motion.div>
        )}

        {/* STEP 4: GPS PRE-PERMISSION + COBALT GOV.BR TRUST GATE */}
        {step === 4 && (
          <motion.div
            key="step-4"
            initial={stepInitial}
            animate={{ opacity: 1, x: 0 }}
            transition={springTransition}
            className="w-full max-w-md bg-white text-[#0B1226] rounded-[32px] p-5 sm:p-8 shadow-xl border border-[#E4D6B2] overflow-hidden"
          >
            {/* Cobalt Gov.br Header Stage */}
            <div className="-mx-5 -mt-5 sm:-mx-8 sm:-mt-8 px-5 py-5 sm:px-8 sm:py-6 mb-5 bg-[#0131CD] text-white border-b border-[#B9FC01]/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#FEF1CF]">
                  Etapa 4 de 4
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#B9FC01] text-[#0B1226]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0B1226]" aria-hidden="true" />
                  <span>Gov.br Gate</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-medium tracking-tight text-white">
                    Validação única Gov.br
                  </h2>
                  <p className="text-sm text-[#FEF1CF] mt-1">
                    Identificação institucional segura para acessar o mapa com estudantes verificados
                  </p>
                </div>

                <div className="shrink-0">
                  <DropletMascot
                    state={step4MascotState}
                    size={68}
                    inkColor="#B9FC01"
                    paperColor="#0131CD"
                    notifColor="#FEF1CF"
                    ariaLabel="Mascote de verificação Gov.br"
                  />
                </div>
              </div>
            </div>

            {/* GPS Pre-Permission Card */}
            <div className="p-3.5 rounded-2xl bg-[#FEF1CF]/75 border border-[#E4D6B2]">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#0131CD] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs text-[#24304D] leading-relaxed">
                  <span className="font-semibold text-[#0B1226] block mb-0.5">
                    Localização no campus
                  </span>
                  Usamos sua posição apenas enquanto caminha na UFSC para alertar sobre trechos escuros.
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={requestGps}
                  className="min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-medium bg-white border border-[#0131CD]/25 text-[#0131CD] hover:bg-[#FEF1CF] active:scale-[0.97] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0131CD]"
                >
                  Continuar para localização
                </button>
                {gpsStatus !== 'prompt' && (
                  <span className="text-xs font-medium text-[#15803d] flex items-center gap-1">
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
                  className="block text-xs font-semibold text-[#334155] uppercase tracking-wider"
                >
                  Nome completo
                </label>
                <button
                  type="button"
                  onClick={handleAutofillDemo}
                  className="min-h-[44px] inline-flex items-center px-2 text-xs text-[#0131CD] font-medium hover:underline cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0131CD]"
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
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#E4D6B2] bg-[#FFF9EA]/60 text-sm text-[#0B1226] focus-visible:outline-2 focus-visible:outline-[#0131CD]"
              />

              <div>
                <label
                  htmlFor="govbr-affiliation"
                  className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-1"
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
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#E4D6B2] bg-[#FFF9EA]/60 text-sm text-[#0B1226] focus-visible:outline-2 focus-visible:outline-[#0131CD]"
                />
              </div>

              <div>
                <label
                  htmlFor="govbr-cpf"
                  className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-1"
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
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#E4D6B2] bg-[#FFF9EA]/60 text-sm text-[#0B1226] focus-visible:outline-2 focus-visible:outline-[#0131CD]"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#D70015] font-medium"
                >
                  {error}
                </div>
              )}

              {/* Verification Checklist Animation */}
              {isVerifying && (
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.2 }}
                  className="mt-4 p-4 rounded-2xl bg-[#FEF1CF] border border-[#0131CD]/20 space-y-2.5"
                >
                  <div className="flex items-center gap-2.5 text-xs">
                    <CheckCircle2
                      className={`w-4 h-4 transition-colors ${
                        checklistStep >= 1 ? 'text-[#0131CD]' : 'text-[#64748B]'
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={
                        checklistStep >= 1
                          ? 'text-[#0B1226] font-medium'
                          : 'text-[#334155]'
                      }
                    >
                      Identidade Gov.br validada
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs">
                    <CheckCircle2
                      className={`w-4 h-4 transition-colors ${
                        checklistStep >= 2 ? 'text-[#0131CD]' : 'text-[#64748B]'
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={
                        checklistStep >= 2
                          ? 'text-[#0B1226] font-medium'
                          : 'text-[#334155]'
                      }
                    >
                      Vínculo UFSC confirmado
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs">
                    <CheckCircle2
                      className={`w-4 h-4 transition-colors ${
                        checklistStep >= 3 ? 'text-[#15803d]' : 'text-[#64748B]'
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={
                        checklistStep >= 3
                          ? 'text-[#0B1226] font-semibold'
                          : 'text-[#334155]'
                      }
                    >
                      Selo Verificado ativo
                    </span>
                  </div>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
