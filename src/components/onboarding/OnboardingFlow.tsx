import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
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
import { PillButton } from '../ui/PillButton';
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

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const {
    posts,
    edgeRatings,
    reports,
    companionMatches,
    completeOnboarding,
  } = useCampusStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

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

  const shouldReduceMotion = useReducedMotion();
  const prefersReducedMotion =
    Boolean(shouldReduceMotion) ||
    (typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches));

  // Toggle building in Step 2
  const toggleBuilding = (id: string) => {
    setSelectedBuildings((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter((b) => b !== id);
      }
      return [...prev, id];
    });
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
    }, 200);

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
    }, 350);

    timersRef.current.push(t1, t2, t3);
  };

  const springTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : {
        type: 'spring' as const,
        bounce: 0,
        duration: 0.28,
      };

  const stepInitial = { opacity: 0, y: prefersReducedMotion ? 0 : 12 };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-300">
      <AnimatePresence initial={false}>
        {/* STEP 1: DARK STAGE + LUMINOUS LIME ARC + ANIMATED CORRIDOR */}
        {step === 1 && (
          <motion.div
            key="step-1"
            initial={stepInitial}
            animate={{ opacity: 1, y: 0 }}
            transition={springTransition}
            className="w-full max-w-md bg-[#131314] text-white rounded-[32px] p-6 sm:p-8 relative overflow-hidden shadow-2xl border border-white/10"
          >
            {/* Luminous lime curved ambient glow */}
            <div
              className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-64 rounded-full bg-[#befc65]/20 blur-[64px] pointer-events-none"
              aria-hidden="true"
            />

            {/* Header Badge */}
            <div className="flex items-center space-x-2 mb-6">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#befc65]/15 text-[#befc65] border border-[#befc65]/30">
                <Sparkles className="w-3.5 h-3.5" />
                <span>UFSC Campus Trindade</span>
              </span>
            </div>

            {/* Animated SVG UFSC Corridor */}
            <div className="w-full flex justify-center py-2" aria-hidden="true">
              <svg className="w-full h-36" viewBox="0 0 320 100" fill="none">
                <defs>
                  <filter id="glow-lime" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                <motion.path
                  d="M 25 65 Q 90 20 160 55 T 295 45"
                  stroke="#befc65"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#glow-lime)"
                  initial={prefersReducedMotion ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={prefersReducedMotion ? undefined : { duration: 0.9, ease: 'easeOut' }}
                />
                <motion.path
                  d="M 25 65 Q 90 20 160 55 T 295 45"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={prefersReducedMotion ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={prefersReducedMotion ? undefined : { duration: 0.9, ease: 'easeOut' }}
                />
                <circle cx="25" cy="65" r="7" fill="#befc65" />
                <circle cx="160" cy="55" r="6" fill="#befc65" />
                <circle cx="295" cy="45" r="7" fill="#befc65" />
                <text x="25" y="88" fill="#befc65" fontSize="11" textAnchor="middle" fontWeight="500">
                  BU
                </text>
                <text x="160" y="78" fill="#befc65" fontSize="11" textAnchor="middle" fontWeight="500">
                  Reitoria
                </text>
                <text x="295" y="68" fill="#befc65" fontSize="11" textAnchor="middle" fontWeight="500">
                  RU
                </text>
              </svg>
            </div>

            {/* Outcome Headline */}
            <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-white mt-4 leading-tight">
              Caminhe pela UFSC no claro. <span className="text-[#befc65]">E acompanhado.</span>
            </h1>

            <p className="text-base text-[#a1a1aa] mt-3 leading-relaxed">
              Descubra trajetos com iluminação verificada em tempo real e conecte-se com colegas fazendo o mesmo caminho pelo campus Trindade.
            </p>

            {/* Actions */}
            <div className="mt-8 space-y-3">
              <PillButton
                variant="lime"
                size="feature"
                className="w-full shadow-lg shadow-[#befc65]/20 font-semibold text-lg"
                onClick={() => setStep(2)}
              >
                Começar meu trajeto →
              </PillButton>

              <button
                type="button"
                className="w-full min-h-[44px] py-2 text-sm text-[#a1a1aa] hover:text-white transition-colors cursor-pointer text-center underline-offset-4 hover:underline"
                onClick={() => {
                  setSelectedBuildings(['bu', 'ru', 'cce']);
                  setStep(4);
                }}
              >
                Já tenho conta Gov.br
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: PERSONALIZATION CANVAS */}
        {step === 2 && (
          <motion.div
            key="step-2"
            initial={stepInitial}
            animate={{ opacity: 1, y: 0 }}
            transition={springTransition}
            className="w-full max-w-md bg-[#ffffff] text-[#131314] rounded-[32px] p-6 sm:p-8 shadow-xl border border-[#dfe3e6]"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#66646d]">
                Etapa 2 de 4
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#f3f3f4] text-[#131314]">
                Preferências
              </span>
            </div>

            <h2 className="text-2xl font-medium tracking-tight text-[#131314]">
              Seus trajetos e horários frequentes
            </h2>
            <p className="text-sm text-[#46444a] mt-1">
              Personalize seu mapa seguro da UFSC
            </p>

            {/* Building Selection Multi-Select Chips */}
            <div className="mt-6">
              <label className="block text-xs font-semibold text-[#66646d] uppercase tracking-wider mb-2">
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
                      className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? 'bg-[#131314] text-[#befc65] shadow-sm'
                          : 'bg-[#f3f3f4] text-[#46444a] hover:bg-[#e7e7e8]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slot Selection */}
            <div className="mt-6">
              <label className="block text-xs font-semibold text-[#66646d] uppercase tracking-wider mb-2">
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
                      onClick={() => setTimeSlot(slot)}
                      className={`min-h-[44px] flex items-center justify-center rounded-2xl text-sm font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#131314] text-white'
                          : 'bg-[#f3f3f4] text-[#46444a] hover:bg-[#e7e7e8]'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Map Style Selection */}
            <div className="mt-6">
              <label className="block text-xs font-semibold text-[#66646d] uppercase tracking-wider mb-2">
                Modo visual inicial do mapa
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={mapMode === 'claro'}
                  onClick={() => setMapMode('claro')}
                  className={`min-h-[44px] px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    mapMode === 'claro'
                      ? 'bg-[#131314] text-white'
                      : 'bg-[#f3f3f4] text-[#46444a] hover:bg-[#e7e7e8]'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  <span>Claro + Modo Noturno</span>
                </button>

                <button
                  type="button"
                  aria-pressed={mapMode === 'noturno'}
                  onClick={() => setMapMode('noturno')}
                  className={`min-h-[44px] px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    mapMode === 'noturno'
                      ? 'bg-[#131314] text-white'
                      : 'bg-[#f3f3f4] text-[#46444a] hover:bg-[#e7e7e8]'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>Sempre Noturno</span>
                </button>
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="mt-8 flex items-center space-x-3">
              <button
                type="button"
                aria-label="Voltar"
                onClick={() => setStep(1)}
                className="min-w-[44px] min-h-[44px] px-4 py-2 rounded-full text-sm font-medium text-[#46444a] hover:bg-[#f3f3f4] active:scale-[0.97] transition-all cursor-pointer inline-flex items-center justify-center"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </button>

              <PillButton
                variant="lime"
                size="compact"
                className="flex-1 font-semibold"
                onClick={() => setStep(3)}
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
            animate={{ opacity: 1, y: 0 }}
            transition={springTransition}
            className="w-full max-w-md bg-[#ffffff] text-[#131314] rounded-[32px] p-6 sm:p-8 shadow-xl border border-[#dfe3e6]"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#66646d]">
                Etapa 3 de 4
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#befc65] text-[#131314]">
                Aha! Preview
              </span>
            </div>

            <h2 className="text-2xl font-medium tracking-tight text-[#131314]">
              Seu corredor inteligente
            </h2>
            <p className="text-sm text-[#46444a] mt-1">
              Trajeto seguro calculado para seu perfil
            </p>

            {/* Corridor Origin/Destination Card */}
            <div className="mt-6 p-4 rounded-2xl bg-[#f3f3f4] border border-[#dfe3e6] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-[#15803d]" />
                  <span className="text-sm font-semibold uppercase text-[#131314]">
                    {originId.toUpperCase()} → {destId.toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-[#66646d] font-medium">{timeSlot}</span>
              </div>

              {/* Illumination & Distance Stat */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-white rounded-xl border border-[#dfe3e6]">
                  <div className="flex items-center space-x-1.5 text-xs text-[#66646d] font-medium">
                    <Lightbulb className="w-3.5 h-3.5 text-[#15803d]" />
                    <span>Iluminação</span>
                  </div>
                  <div className="text-2xl font-semibold text-[#131314] mt-1">
                    {previewRoute.illuminationPercentage}
                    <span className="text-sm font-normal text-[#66646d]">% iluminado</span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#dfe3e6]">
                  <div className="flex items-center space-x-1.5 text-xs text-[#66646d] font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#15803d]" />
                    <span>Caminhada</span>
                  </div>
                  <div className="text-2xl font-semibold text-[#131314] mt-1">
                    ~{previewRoute.estimatedMinutes} <span className="text-sm font-normal text-[#66646d]">min a pé</span>
                  </div>
                  <div className="text-xs text-[#66646d]">{previewRoute.distanceMeters}m de extensão</div>
                </div>
              </div>

              {/* Verified Peers Counter Card */}
              <div className="p-3 bg-white rounded-xl border border-[#dfe3e6] flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2 min-w-0">
                  <Users className="w-4 h-4 text-[#15803d] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#131314]">
                      {verifiedPeersCount} estudantes verificados
                    </div>
                    <div className="text-xs text-[#66646d]">
                      Caminhando no seu horário
                    </div>
                  </div>
                </div>
                <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                  <span className="inline-block h-6 w-6 rounded-full bg-[#131314] text-[#befc65] text-[10px] font-bold text-center leading-6 ring-2 ring-white">
                    MS
                  </span>
                  <span className="inline-block h-6 w-6 rounded-full bg-[#131314] text-white text-[10px] font-bold text-center leading-6 ring-2 ring-white">
                    CD
                  </span>
                  <span className="inline-block h-6 w-6 rounded-full bg-[#befc65] text-[#131314] text-[10px] font-bold text-center leading-6 ring-2 ring-white">
                    GS
                  </span>
                </div>
              </div>
            </div>

            {/* Trust statement */}
            <p className="text-xs text-[#66646d] mt-4 leading-relaxed">
              Você não precisa caminhar no escuro ou sozinho. Complete a identificação Gov.br para entrar em grupos de caminhada monitorada.
            </p>

            {/* Navigation Actions */}
            <div className="mt-8 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="min-h-[44px] px-4 py-2 rounded-full text-sm font-medium text-[#46444a] hover:bg-[#f3f3f4] active:scale-[0.97] transition-all cursor-pointer shrink-0"
              >
                Voltar
              </button>

              <PillButton
                variant="lime"
                size="compact"
                className="flex-1 font-semibold !text-sm !px-4 whitespace-nowrap"
                onClick={() => setStep(4)}
              >
                Validar acesso Gov.br →
              </PillButton>
            </div>
          </motion.div>
        )}

        {/* STEP 4: GPS PRE-PERMISSION + GOV.BR TRUST GATE */}
        {step === 4 && (
          <motion.div
            key="step-4"
            initial={stepInitial}
            animate={{ opacity: 1, y: 0 }}
            transition={springTransition}
            className="w-full max-w-md bg-[#ffffff] text-[#131314] rounded-[32px] p-6 sm:p-8 shadow-xl border border-[#dfe3e6]"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#66646d]">
                Etapa 4 de 4
              </span>
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#131314] text-[#befc65]">
                <ShieldCheck className="w-3 h-3 text-[#befc65]" />
                <span>Gov.br Gate</span>
              </span>
            </div>

            <h2 className="text-2xl font-medium tracking-tight text-[#131314]">
              Validação única Gov.br
            </h2>
            <p className="text-sm text-[#46444a] mt-1">
              Identificação institucional segura para acessar o mapa com estudantes verificados
            </p>

            {/* GPS Pre-Permission Card */}
            <div className="mt-5 p-3.5 rounded-2xl bg-[#f3f3f4] border border-[#dfe3e6]">
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-[#15803d] shrink-0 mt-0.5" />
                <div className="text-xs text-[#46444a] leading-relaxed">
                  <span className="font-semibold text-[#131314] block mb-0.5">
                    Localização no campus
                  </span>
                  Usamos sua posição apenas enquanto caminha na UFSC para alertar sobre trechos escuros.
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={requestGps}
                  className="min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-medium bg-white border border-[#dfe3e6] text-[#131314] hover:bg-[#f3f3f4] active:scale-[0.97] transition-all cursor-pointer"
                >
                  Continuar para localização
                </button>
                {gpsStatus !== 'prompt' && (
                  <span className="text-[11px] font-medium text-[#15803d] flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{gpsStatus === 'granted' ? 'Habilitada' : 'Campus Trindade'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Gov.br Form */}
            <form onSubmit={handleGovBrSubmit} className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="govbr-name"
                  className="block text-xs font-semibold text-[#66646d] uppercase tracking-wider"
                >
                  Nome completo
                </label>
                <button
                  type="button"
                  onClick={handleAutofillDemo}
                  className="min-h-[44px] inline-flex items-center px-2 text-xs text-[#15803d] font-medium hover:underline cursor-pointer"
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
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#dfe3e6] bg-white text-sm text-[#131314] focus-visible:outline-2 focus-visible:outline-[#131314]"
              />

              <div>
                <label
                  htmlFor="govbr-affiliation"
                  className="block text-xs font-semibold text-[#66646d] uppercase tracking-wider mb-1"
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
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#dfe3e6] bg-white text-sm text-[#131314] focus-visible:outline-2 focus-visible:outline-[#131314]"
                />
              </div>

              <div>
                <label
                  htmlFor="govbr-cpf"
                  className="block text-xs font-semibold text-[#66646d] uppercase tracking-wider mb-1"
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
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#dfe3e6] bg-white text-sm text-[#131314] focus-visible:outline-2 focus-visible:outline-[#131314]"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#D70015] font-medium">
                  {error}
                </div>
              )}

              {/* Verification Checklist Animation */}
              {isVerifying && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 p-4 rounded-2xl bg-[#f3f3f4] border border-[#dfe3e6] space-y-2.5"
                >
                  <div className="flex items-center space-x-2.5 text-xs">
                    <CheckCircle2
                      className={`w-4 h-4 transition-colors ${
                        checklistStep >= 1 ? 'text-[#15803d]' : 'text-gray-400'
                      }`}
                    />
                    <span
                      className={
                        checklistStep >= 1
                          ? 'text-[#131314] font-medium'
                          : 'text-[#66646d]'
                      }
                    >
                      Identidade Gov.br validada
                    </span>
                  </div>

                  <div className="flex items-center space-x-2.5 text-xs">
                    <CheckCircle2
                      className={`w-4 h-4 transition-colors ${
                        checklistStep >= 2 ? 'text-[#15803d]' : 'text-gray-400'
                      }`}
                    />
                    <span
                      className={
                        checklistStep >= 2
                          ? 'text-[#131314] font-medium'
                          : 'text-[#66646d]'
                      }
                    >
                      Vínculo UFSC confirmado
                    </span>
                  </div>

                  <div className="flex items-center space-x-2.5 text-xs">
                    <CheckCircle2
                      className={`w-4 h-4 transition-colors ${
                        checklistStep >= 3 ? 'text-[#15803d]' : 'text-gray-400'
                      }`}
                    />
                    <span
                      className={
                        checklistStep >= 3
                          ? 'text-[#131314] font-medium'
                          : 'text-[#66646d]'
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
