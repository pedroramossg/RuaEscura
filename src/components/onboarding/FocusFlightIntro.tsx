import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, type Transition } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { useHaptics } from '../../hooks/useHaptics';

export interface FocusFlightIntroProps {
  onFinishIntro: () => void;
  onJumpToGovBr: () => void;
}

type BeatIndex = 0 | 1 | 2 | 3 | 4;

interface IntroBeat {
  id: BeatIndex;
  kicker: string;
  highlight?: string;
  highlightTone?: 'periwinkle' | 'luminous';
  body?: string;
  bodyEmphasis?: 'luminous' | 'muted';
  dotColor: string;
}

const APPLE_EASE = [0.23, 1, 0.32, 1] as const;

const INTRO_BEATS: readonly IntroBeat[] = [
  {
    id: 0,
    kicker: 'Seja bem-vindo!',
    body: 'Te apresentamos o Rua Escura. Sua caminhada mais segura pela UFSC começa aqui.',
    bodyEmphasis: 'muted',
    dotColor: '#5EC2F3',
  },
  {
    id: 1,
    kicker: 'Você já se sentiu',
    highlight: 'inseguro(a) na UFSC?',
    highlightTone: 'periwinkle',
    dotColor: '#F7C648',
  },
  {
    id: 2,
    kicker: 'Você frequentemente sente',
    highlight: 'medo ao andar à noite?',
    highlightTone: 'periwinkle',
    dotColor: '#EE86BF',
  },
  {
    id: 3,
    kicker: 'Existe uma solução:',
    highlight: 'Rua Escura.',
    highlightTone: 'luminous',
    body: 'Rotas iluminadas em tempo real, postes monitorados pela comunidade e caminhada em grupo pela UFSC Trindade.',
    bodyEmphasis: 'muted',
    dotColor: '#5EC2F3',
  },
  {
    id: 4,
    kicker: 'A chave para andar tranquilo(a)?',
    body: 'Caminhos iluminados, alertas reais da comunidade e nunca voltar sozinho(a).',
    bodyEmphasis: 'luminous',
    dotColor: '#F7C648',
  },
] as const;

export const FocusFlightIntro: React.FC<FocusFlightIntroProps> = ({
  onFinishIntro,
  onJumpToGovBr,
}) => {
  const [beatIndex, setBeatIndex] = useState<BeatIndex>(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { trigger } = useHaptics();

  const advanceBeat = useCallback(() => {
    trigger('selection');
    setBeatIndex((prev) => {
      if (prev >= 4) return prev;
      return (prev + 1) as BeatIndex;
    });
  }, [trigger]);

  const handleBack = useCallback(() => {
    trigger('selection');
    setBeatIndex((prev) => {
      if (prev <= 0) return prev;
      return (prev - 1) as BeatIndex;
    });
  }, [trigger]);

  const handleFinish = useCallback(() => {
    trigger('selection');
    onFinishIntro();
  }, [trigger, onFinishIntro]);

  const handleJumpGovBr = useCallback(() => {
    trigger('selection');
    onJumpToGovBr();
  }, [trigger, onJumpToGovBr]);

  const stackTransition: Transition = prefersReducedMotion
    ? { duration: 0.14, ease: 'linear' }
    : { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 };

  const ctaTransition: Transition = prefersReducedMotion
    ? { duration: 0.12, ease: 'linear' }
    : { duration: 0.28, ease: APPLE_EASE };

  const visibleBeats = INTRO_BEATS.slice(0, beatIndex + 1);

  return (
    <section
      aria-label="Introdução Rua Escura"
      className="relative flex flex-col justify-between w-full min-h-[100dvh] bg-[#000000] text-white overflow-hidden select-none"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Subtle OLED ambient top hairline gradient so receded stack melts cleanly into pure black */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#000000] via-[#000000]/80 to-transparent z-10"
      />

      {/* Minimal Top Bar: Back | Trio Progress Dots | Pular */}
      <header className="relative z-20 w-full max-w-[440px] mx-auto px-6 flex items-center justify-between">
        <div className="w-[84px] flex items-center justify-start">
          {beatIndex > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1 min-h-[44px] min-w-[44px] -ml-2 px-2 rounded-full text-[15px] font-medium text-white/65 hover:text-white active:scale-[0.97] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81A8F8]"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Voltar</span>
            </button>
          ) : (
            <span className="min-h-[44px]" aria-hidden="true" />
          )}
        </div>

        {/* Trio Progress Dots */}
        <div
          role="progressbar"
          aria-label="Progresso da introdução"
          aria-valuemin={1}
          aria-valuemax={INTRO_BEATS.length}
          aria-valuenow={beatIndex + 1}
          className="flex items-center gap-1.5"
        >
          {INTRO_BEATS.map((beat, idx) => {
            const isActive = idx === beatIndex;
            const isVisited = idx < beatIndex;
            return (
              <motion.span
                key={beat.id}
                layout={!prefersReducedMotion}
                transition={stackTransition}
                className="block h-1.5 rounded-full"
                style={{
                  width: isActive ? 20 : 6,
                  backgroundColor:
                    isActive || isVisited ? beat.dotColor : 'rgba(255, 255, 255, 0.22)',
                  opacity: isActive ? 1 : isVisited ? 0.55 : 1,
                  boxShadow:
                    isActive && !prefersReducedMotion
                      ? `0 0 12px ${beat.dotColor}66`
                      : 'none',
                }}
              />
            );
          })}
        </div>

        <div className="w-[84px] flex items-center justify-end">
          <button
            type="button"
            onClick={handleFinish}
            className="inline-flex items-center justify-end min-h-[44px] min-w-[44px] -mr-2 px-2 rounded-full text-[15px] font-medium text-white/55 hover:text-white active:scale-[0.97] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81A8F8]"
          >
            Pular
          </button>
        </div>
      </header>

      {/* Center-Left Editorial Blur-Recede Stack */}
      <main className="relative flex-1 w-full max-w-[440px] mx-auto px-6 flex flex-col justify-center overflow-hidden py-6">
        <div className="flex flex-col items-start text-left w-full">
          {visibleBeats.map((beat, idx) => {
            const depth = beatIndex - idx;
            const isActive = depth === 0;
            const isDeepHistory = depth >= 3;

            const targetOpacity = isActive
              ? 1
              : depth === 1
                ? 0.34
                : depth === 2
                  ? 0.14
                  : 0;

            const targetScale = prefersReducedMotion
              ? 1
              : isActive
                ? 1
                : Math.max(0.84, 1 - depth * 0.06);

            const targetY = prefersReducedMotion ? 0 : isActive ? 0 : -depth * 10;

            const targetFilter = prefersReducedMotion
              ? 'none'
              : isActive
                ? 'blur(0px)'
                : `blur(${Math.min(depth * 3.5, 9)}px)`;

            return (
              <motion.div
                key={beat.id}
                layout={!prefersReducedMotion}
                aria-hidden={!isActive}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 28, scale: 0.97, filter: 'blur(6px)' }
                }
                animate={{
                  opacity: targetOpacity,
                  scale: targetScale,
                  y: targetY,
                  filter: targetFilter,
                  maxHeight: isDeepHistory ? 0 : 340,
                  marginBottom: isActive ? 0 : isDeepHistory ? 0 : 22,
                }}
                transition={stackTransition}
                style={{ transformOrigin: 'left bottom' }}
                className={`w-full overflow-visible ${
                  !isActive ? 'pointer-events-none select-none' : ''
                }`}
              >
                {beat.id === 0 && (
                  <div>
                    {isActive ? (
                      <h1
                        className="text-[34px] sm:text-[40px] leading-[1.1] font-bold tracking-[-0.03em] text-white"
                        style={{
                          textShadow: '0 0 28px rgba(255, 255, 255, 0.24)',
                        }}
                      >
                        {beat.kicker}
                      </h1>
                    ) : (
                      <p className="text-[28px] sm:text-[32px] leading-[1.12] font-bold tracking-[-0.03em] text-white">
                        {beat.kicker}
                      </p>
                    )}
                    {beat.body && (
                      <p className="mt-3.5 text-[19px] sm:text-[21px] leading-[1.42] font-normal tracking-[-0.014em] text-white/80 max-w-[34ch]">
                        {beat.body}
                      </p>
                    )}
                  </div>
                )}

                {(beat.id === 1 || beat.id === 2 || beat.id === 3) && (
                  <div>
                    {isActive ? (
                      <h1>
                        <span className="block text-[20px] sm:text-[22px] leading-[1.3] font-medium tracking-[-0.015em] text-white/70 mb-1.5">
                          {beat.kicker}
                        </span>
                        <span
                          className={
                            beat.highlightTone === 'luminous'
                              ? 'block text-[38px] sm:text-[44px] leading-[1.06] font-bold tracking-tight text-white'
                              : 'block text-[36px] sm:text-[42px] leading-[1.08] font-bold tracking-tight text-[#81A8F8]'
                          }
                          style={{
                            textShadow:
                              beat.highlightTone === 'luminous'
                                ? '0 0 32px rgba(255, 255, 255, 0.34), 0 0 12px rgba(255, 255, 255, 0.16)'
                                : '0 0 28px rgba(129, 168, 248, 0.36)',
                          }}
                        >
                          {beat.highlight}
                        </span>
                      </h1>
                    ) : (
                      <div>
                        <p className="text-[18px] sm:text-[20px] leading-[1.3] font-medium tracking-[-0.015em] text-white/70 mb-1">
                          {beat.kicker}
                        </p>
                        <p
                          className={
                            beat.highlightTone === 'luminous'
                              ? 'text-[32px] sm:text-[36px] leading-[1.08] font-bold tracking-tight text-white'
                              : 'text-[30px] sm:text-[34px] leading-[1.08] font-bold tracking-tight text-[#81A8F8]'
                          }
                        >
                          {beat.highlight}
                        </p>
                      </div>
                    )}

                    {beat.body && isActive && (
                      <p className="mt-4 text-[17px] sm:text-[18px] leading-[1.48] font-normal tracking-[-0.012em] text-white/72 max-w-[36ch]">
                        {beat.body}
                      </p>
                    )}
                  </div>
                )}

                {beat.id === 4 && (
                  <div>
                    {isActive ? (
                      <h1>
                        <span className="block text-[20px] sm:text-[22px] leading-[1.3] font-medium tracking-[-0.015em] text-white/70 mb-2">
                          {beat.kicker}
                        </span>
                        <span
                          className="block text-[28px] sm:text-[34px] leading-[1.18] font-bold tracking-[-0.026em] text-white"
                          style={{
                            textShadow:
                              '0 0 30px rgba(255, 255, 255, 0.3), 0 0 10px rgba(255, 255, 255, 0.14)',
                          }}
                        >
                          {beat.body}
                        </span>
                      </h1>
                    ) : (
                      <div>
                        <p className="text-[18px] font-medium text-white/70 mb-1">
                          {beat.kicker}
                        </p>
                        <p className="text-[26px] font-bold text-white">{beat.body}</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* Bottom Native Apple Pill CTA Dock */}
      <footer className="relative z-20 w-full max-w-[440px] mx-auto px-6 pt-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {beatIndex === 0 && (
            <motion.div
              key="cta-0"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={ctaTransition}
              className="flex flex-col items-center gap-2"
            >
              <button
                type="button"
                onClick={advanceBeat}
                className="w-full min-h-[54px] px-6 rounded-full bg-white text-[#000000] text-[17px] font-semibold tracking-[-0.014em] hover:bg-white/92 active:scale-[0.98] transition-all cursor-pointer shadow-[0_8px_30px_rgba(255,255,255,0.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81A8F8]"
              >
                Olá!
              </button>
              <button
                type="button"
                onClick={handleJumpGovBr}
                className="min-h-[44px] px-4 rounded-full text-[15px] font-medium text-white/62 hover:text-white active:scale-[0.98] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81A8F8]"
              >
                Já tenho conta Gov.br
              </button>
            </motion.div>
          )}

          {beatIndex === 1 && (
            <motion.div
              key="cta-1"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={ctaTransition}
              className="flex flex-col items-center gap-2"
            >
              <button
                type="button"
                onClick={advanceBeat}
                className="w-full min-h-[54px] px-6 rounded-full bg-white text-[#000000] text-[17px] font-semibold tracking-[-0.014em] hover:bg-white/92 active:scale-[0.98] transition-all cursor-pointer shadow-[0_8px_30px_rgba(255,255,255,0.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81A8F8]"
              >
                Sim, já senti.
              </button>
              <button
                type="button"
                onClick={advanceBeat}
                className="min-h-[44px] px-4 rounded-full text-[15px] font-medium text-white/62 hover:text-white active:scale-[0.98] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81A8F8]"
              >
                Às vezes
              </button>
            </motion.div>
          )}

          {beatIndex === 2 && (
            <motion.div
              key="cta-2"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={ctaTransition}
              className="grid grid-cols-2 gap-3 pb-2"
            >
              <button
                type="button"
                onClick={advanceBeat}
                className="w-full min-h-[54px] px-5 rounded-full bg-white text-[#000000] text-[17px] font-semibold tracking-[-0.014em] hover:bg-white/92 active:scale-[0.98] transition-all cursor-pointer shadow-[0_8px_30px_rgba(255,255,255,0.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81A8F8]"
              >
                Sim
              </button>
              <button
                type="button"
                onClick={advanceBeat}
                className="w-full min-h-[54px] px-5 rounded-full bg-white/[0.12] text-white border border-white/[0.16] text-[17px] font-semibold tracking-[-0.014em] hover:bg-white/[0.18] active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81A8F8]"
              >
                Não
              </button>
            </motion.div>
          )}

          {beatIndex === 3 && (
            <motion.div
              key="cta-3"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={ctaTransition}
              className="flex flex-col items-center pb-2"
            >
              <button
                type="button"
                onClick={advanceBeat}
                className="w-full min-h-[54px] px-6 rounded-full bg-white text-[#000000] text-[17px] font-semibold tracking-[-0.014em] hover:bg-white/92 active:scale-[0.98] transition-all cursor-pointer shadow-[0_8px_30px_rgba(255,255,255,0.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81A8F8]"
              >
                Qual é a chave?
              </button>
            </motion.div>
          )}

          {beatIndex === 4 && (
            <motion.div
              key="cta-4"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={ctaTransition}
              className="flex flex-col items-center pb-2"
            >
              <button
                type="button"
                onClick={handleFinish}
                className="w-full min-h-[54px] px-6 rounded-full bg-white text-[#000000] text-[17px] font-semibold tracking-[-0.014em] hover:bg-white/92 active:scale-[0.98] transition-all cursor-pointer shadow-[0_8px_30px_rgba(255,255,255,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81A8F8]"
              >
                Começar meu cadastro
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>
    </section>
  );
};
