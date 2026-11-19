import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, type Transition } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { useCampusStore } from '../../hooks/useCampusStore';
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
}

const APPLE_EASE = [0.23, 1, 0.32, 1] as const;

const INTRO_BEATS: readonly IntroBeat[] = [
  {
    id: 0,
    kicker: 'Seja bem-vindo!',
    body: 'Te apresentamos o Rua Escura. Sua caminhada mais segura pela UFSC começa aqui.',
    bodyEmphasis: 'muted',
  },
  {
    id: 1,
    kicker: 'Você já se sentiu',
    highlight: 'inseguro(a) na UFSC?',
    highlightTone: 'periwinkle',
  },
  {
    id: 2,
    kicker: 'Você frequentemente sente',
    highlight: 'medo ao andar à noite?',
    highlightTone: 'periwinkle',
  },
  {
    id: 3,
    kicker: 'Existe uma solução:',
    highlight: 'Rua Escura.',
    highlightTone: 'luminous',
    body: 'Rotas iluminadas em tempo real, postes monitorados pela comunidade e caminhada em grupo pela UFSC Trindade.',
    bodyEmphasis: 'muted',
  },
  {
    id: 4,
    kicker: 'A chave para andar tranquilo(a)?',
    body: 'Caminhos iluminados, alertas reais da comunidade e nunca voltar sozinho(a).',
    bodyEmphasis: 'luminous',
  },
] as const;

export const FocusFlightIntro: React.FC<FocusFlightIntroProps> = ({
  onFinishIntro,
  onJumpToGovBr,
}) => {
  const { darkMode } = useCampusStore();
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

  const primaryCtaClass = darkMode
    ? 'w-full min-h-[54px] px-6 rounded-full bg-white text-[#0A0A0A] text-[17px] font-semibold tracking-[-0.014em] hover:bg-white/92 active:scale-[0.98] transition-all cursor-pointer shadow-[0_8px_30px_rgba(255,255,255,0.14)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EC2F3]'
    : 'w-full min-h-[54px] px-6 rounded-full bg-[#111827] text-white text-[17px] font-semibold tracking-[-0.014em] hover:bg-[#1F2937] active:scale-[0.98] transition-all cursor-pointer shadow-[0_10px_26px_rgba(17,24,39,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]';

  const secondaryCtaClass = darkMode
    ? 'w-full min-h-[48px] px-5 rounded-full bg-white/[0.12] text-white border border-white/[0.16] text-[15px] font-medium tracking-[-0.012em] hover:bg-white/[0.18] active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EC2F3]'
    : 'w-full min-h-[48px] px-5 rounded-full bg-[#F1F5F9] text-[#0F172A] text-[15px] font-medium tracking-[-0.012em] hover:bg-[#E2E8F0] active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]';

  const navLinkClass = darkMode
    ? 'text-white/65 hover:text-white focus-visible:outline-[#5EC2F3]'
    : 'text-[#0F172A]/65 hover:text-[#0F172A] focus-visible:outline-[#2563EB]';

  const kickerClass = darkMode ? 'text-white/70' : 'text-[#475569]';
  const bodyClass = darkMode ? 'text-white/78' : 'text-[#475569]';
  const luminousTextClass = darkMode ? 'text-white' : 'text-[#0F172A]';
  const periwinkleTextClass = darkMode ? 'text-[#81A8F8]' : 'text-[#2563EB]';

  return (
    <section
      aria-label="Introdução Rua Escura"
      className={`relative flex flex-col justify-between w-full min-h-[100dvh] overflow-hidden select-none transition-colors duration-300 ${
        darkMode ? 'bg-[#0A0A0A] text-white' : 'bg-[#FFFFFF] text-[#0F172A]'
      }`}
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Subtle top fade gradient so receded stack melts cleanly into canvas */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent z-10 transition-colors duration-300 ${
          darkMode
            ? 'from-[#0A0A0A] via-[#0A0A0A]/90'
            : 'from-white via-white/90'
        }`}
      />

      {/* Minimal Top Bar: Back | Neutral Progress Dots | Pular */}
      <header className="relative z-20 w-full max-w-[440px] mx-auto px-6 flex items-center justify-between">
        <div className="w-[84px] flex items-center justify-start">
          {beatIndex > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className={`inline-flex items-center gap-1 min-h-[44px] min-w-[44px] -ml-2 px-2 rounded-full text-[15px] font-medium active:scale-[0.97] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ${navLinkClass}`}
            >
              <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Voltar</span>
            </button>
          ) : (
            <span className="min-h-[44px]" aria-hidden="true" />
          )}
        </div>

        {/* Neutral Black / White Progress Dots */}
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
            return (
              <motion.span
                key={beat.id}
                layout={!prefersReducedMotion}
                transition={stackTransition}
                className={`block h-1.5 rounded-full transition-colors ${
                  isActive
                    ? darkMode
                      ? 'w-6 bg-white'
                      : 'w-6 bg-[#111827]'
                    : darkMode
                      ? 'w-1.5 bg-white/25'
                      : 'w-1.5 bg-[#111827]/20'
                }`}
              />
            );
          })}
        </div>

        <div className="w-[84px] flex items-center justify-end">
          <button
            type="button"
            onClick={handleFinish}
            className={`inline-flex items-center justify-end min-h-[44px] min-w-[44px] -mr-2 px-2 rounded-full text-[15px] font-medium active:scale-[0.97] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ${navLinkClass}`}
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
                  <div className="relative">
                    {isActive && (
                      <motion.div
                        aria-hidden="true"
                        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.72 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.01 }
                            : { duration: 0.75, ease: APPLE_EASE }
                        }
                        className="pointer-events-none -z-10 absolute -top-16 -left-10 w-64 h-64 rounded-full blur-2xl"
                        style={{
                          background: darkMode
                            ? 'radial-gradient(circle, rgba(94, 194, 243, 0.22) 0%, rgba(129, 168, 248, 0.08) 48%, transparent 74%)'
                            : 'radial-gradient(circle, rgba(37, 99, 235, 0.14) 0%, rgba(94, 194, 243, 0.09) 48%, transparent 74%)',
                        }}
                      />
                    )}

                    {isActive && (
                      <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.01 }
                            : { duration: 0.45, ease: APPLE_EASE }
                        }
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4 border ${
                          darkMode
                            ? 'bg-white/10 border-white/15 text-[#87D7FA]'
                            : 'bg-[#EFF6FF] border-[#DBEAFE] text-[#2563EB]'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className="w-2 h-2 rounded-full bg-[#10B981] motion-safe:animate-pulse"
                        />
                        <span>UFSC • Campus Trindade</span>
                      </motion.div>
                    )}

                    {isActive ? (
                      <motion.h1
                        initial={
                          prefersReducedMotion
                            ? false
                            : { opacity: 0, y: 20, filter: 'blur(6px)' }
                        }
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.01 }
                            : { duration: 0.52, delay: 0.08, ease: APPLE_EASE }
                        }
                        className={`text-[34px] sm:text-[40px] leading-[1.1] font-bold tracking-[-0.03em] ${luminousTextClass}`}
                        style={
                          darkMode
                            ? { textShadow: '0 0 28px rgba(255, 255, 255, 0.24)' }
                            : undefined
                        }
                      >
                        {beat.kicker}
                      </motion.h1>
                    ) : (
                      <p className={`text-[28px] sm:text-[32px] leading-[1.12] font-bold tracking-[-0.03em] ${luminousTextClass}`}>
                        {beat.kicker}
                      </p>
                    )}
                    {beat.body && (
                      <motion.p
                        initial={
                          prefersReducedMotion
                            ? false
                            : isActive
                              ? { opacity: 0, y: 16 }
                              : false
                        }
                        animate={{ opacity: 1, y: 0 }}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.01 }
                            : { duration: 0.5, delay: 0.18, ease: APPLE_EASE }
                        }
                        className={`mt-3.5 text-[19px] sm:text-[21px] leading-[1.42] font-normal tracking-[-0.014em] max-w-[34ch] ${bodyClass}`}
                      >
                        {beat.body}
                      </motion.p>
                    )}
                  </div>
                )}

                {(beat.id === 1 || beat.id === 2 || beat.id === 3) && (
                  <div>
                    {isActive ? (
                      <h1>
                        <span className={`block text-[20px] sm:text-[22px] leading-[1.3] font-medium tracking-[-0.015em] mb-1.5 ${kickerClass}`}>
                          {beat.kicker}
                        </span>
                        <span
                          className={`block text-[36px] sm:text-[42px] leading-[1.08] font-bold tracking-tight ${
                            beat.highlightTone === 'luminous'
                              ? luminousTextClass
                              : periwinkleTextClass
                          }`}
                          style={
                            darkMode
                              ? {
                                  textShadow:
                                    beat.highlightTone === 'luminous'
                                      ? '0 0 32px rgba(255, 255, 255, 0.34), 0 0 12px rgba(255, 255, 255, 0.16)'
                                      : '0 0 28px rgba(129, 168, 248, 0.36)',
                                }
                              : undefined
                          }
                        >
                          {beat.highlight}
                        </span>
                      </h1>
                    ) : (
                      <div>
                        <p className={`text-[18px] sm:text-[20px] leading-[1.3] font-medium tracking-[-0.015em] mb-1 ${kickerClass}`}>
                          {beat.kicker}
                        </p>
                        <p
                          className={`text-[30px] sm:text-[34px] leading-[1.08] font-bold tracking-tight ${
                            beat.highlightTone === 'luminous'
                              ? luminousTextClass
                              : periwinkleTextClass
                          }`}
                        >
                          {beat.highlight}
                        </p>
                      </div>
                    )}

                    {beat.body && isActive && (
                      <p className={`mt-4 text-[17px] sm:text-[18px] leading-[1.48] font-normal tracking-[-0.012em] max-w-[36ch] ${bodyClass}`}>
                        {beat.body}
                      </p>
                    )}
                  </div>
                )}

                {beat.id === 4 && (
                  <div>
                    {isActive ? (
                      <h1>
                        <span className={`block text-[20px] sm:text-[22px] leading-[1.3] font-medium tracking-[-0.015em] mb-2 ${kickerClass}`}>
                          {beat.kicker}
                        </span>
                        <span
                          className={`block text-[28px] sm:text-[34px] leading-[1.18] font-bold tracking-[-0.026em] ${luminousTextClass}`}
                          style={
                            darkMode
                              ? {
                                  textShadow:
                                    '0 0 30px rgba(255, 255, 255, 0.3), 0 0 10px rgba(255, 255, 255, 0.14)',
                                }
                              : undefined
                          }
                        >
                          {beat.body}
                        </span>
                      </h1>
                    ) : (
                      <div>
                        <p className={`text-[18px] font-medium mb-1 ${kickerClass}`}>
                          {beat.kicker}
                        </p>
                        <p className={`text-[26px] font-bold ${luminousTextClass}`}>{beat.body}</p>
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
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.01 }
                  : { duration: 0.48, delay: 0.24, ease: APPLE_EASE }
              }
              className="flex flex-col items-center gap-2.5"
            >
              <button type="button" onClick={advanceBeat} className={primaryCtaClass}>
                Olá!
              </button>
              <button type="button" onClick={handleJumpGovBr} className={secondaryCtaClass}>
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
              className="flex flex-col items-center gap-2.5"
            >
              <button type="button" onClick={advanceBeat} className={primaryCtaClass}>
                Sim, já senti.
              </button>
              <button type="button" onClick={advanceBeat} className={secondaryCtaClass}>
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
              <button type="button" onClick={advanceBeat} className={primaryCtaClass}>
                Sim
              </button>
              <button
                type="button"
                onClick={advanceBeat}
                className={`${secondaryCtaClass} min-h-[54px] text-[17px] font-semibold`}
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
              <button type="button" onClick={advanceBeat} className={primaryCtaClass}>
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
              <button type="button" onClick={handleFinish} className={primaryCtaClass}>
                Começar meu cadastro
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>
    </section>
  );
};
