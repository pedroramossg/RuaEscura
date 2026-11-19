import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import ufscLogo from '../../assets/ufsc-logo.webp';
import type { TabId } from '../ui/FloatingTabBar';
import { WelcomeBackTrioShowcase, useWelcomeBackGaze } from './WelcomeBackTrioShowcase';

export interface WelcomeBackOverlayProps {
  userName?: string | null;
  timeSlot: string;
  safeRoutesCount?: number;
  onContinue: (targetTab?: TabId) => void;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Welcome-back screen matched to Reference Image 2:
 * Radiant top sky sunburst fading into pure white, minimal frosted corner actions,
 * calligraphic double-loop emblem, generous breathing room above a lower-third greeting,
 * and three soft-diffused pastel mascots emerging organically from the screen edges.
 */
export const WelcomeBackOverlay: React.FC<WelcomeBackOverlayProps> = ({
  userName,
  timeSlot,
  safeRoutesCount = 5,
  onContinue,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [hint, setHint] = useState<string>('COMO ESTÁ SEU TRAJETO HOJE?');

  const firstName = userName?.trim().split(/\s+/)[0] || 'Estudante';
  const greeting = getTimeGreeting();

  // Subtle pointer parallax & gaze shift (non-touch only, disabled under reduced motion)
  const gaze = useWelcomeBackGaze(prefersReducedMotion);

  const enterText = (delay: number, y = 12) =>
    prefersReducedMotion
      ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
      : {
        initial: { opacity: 0, y, filter: 'blur(4px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        transition: { duration: 0.4, delay, ease: EASE_OUT },
      };

  return (
    <motion.div
      data-testid="welcome-back-screen"
      onPointerMove={gaze.handlePointerMove}
      onPointerLeave={gaze.handlePointerLeave}
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="min-h-[100dvh] w-full flex flex-col justify-between bg-white text-[#454954] relative overflow-hidden select-none"
    >
      {/* Top Radiant Sky Sunburst Stage (~45% height fading seamlessly into pure white) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[46%] overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, #CDE7FF 0%, #E8F4FF 56%, #FFFFFF 100%)',
        }}
      >
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 w-[170%] h-full opacity-90"
          style={{
            background:
              'repeating-conic-gradient(from 138deg at 50% 0%, rgba(255,255,255,0.44) 0deg 8deg, rgba(168,214,255,0.20) 8deg 19deg)',
            maskImage:
              'radial-gradient(ellipse 90% 92% at 50% 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0) 88%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 90% 92% at 50% 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0) 88%)',
          }}
        />
      </div>

      {/* Minimal Header Row */}
      <header className="relative z-20 px-5 pt-6 flex items-center justify-between max-w-lg w-full mx-auto">
        <button
          type="button"
          onClick={() => onContinue('explorar')}
          aria-label="Ir para explorar campus"
          className="w-11 h-11 rounded-[14px] border border-white/80 bg-white/15 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/25 enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E293B]"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3.2c1.45 0 2.35 1.85 1.95 3.35 1.5-.4 3.3.5 3.75 1.88.44 1.38-.68 2.95-2.18 3.25.95 1.18.88 3.1-.38 4.02-1.26.92-3.05.3-3.64-1.08-.59 1.38-2.38 2-3.64 1.08-1.26-.92-1.33-2.84-.38-4.02-1.5-.3-2.62-1.87-2.18-3.25.45-1.38 2.25-2.28 3.75-1.88C9.65 5.05 10.55 3.2 12 3.2Z" />
            <circle cx="12" cy="11.2" r="1.45" />
          </svg>
        </button>

        <div
          role="img"
          aria-label={`UFSC • RuaEscura • Turno ${timeSlot}`}
          title={`UFSC • RuaEscura • ${timeSlot}`}
          className="flex items-center justify-center px-2 py-1"
        >
          <img
            src={ufscLogo}
            alt=""
            width={119}
            height={160}
            decoding="async"
            className="h-11 sm:h-12 w-auto object-contain select-none pointer-events-none"
          />
        </div>

        <button
          type="button"
          onClick={() => onContinue('mapa')}
          aria-label={`Abrir mapa (${safeRoutesCount} postes ativos)`}
          className="w-11 h-11 rounded-[14px] border border-white/80 bg-white/15 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/25 enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E293B]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="7" y1="9.5" x2="17" y2="9.5" />
            <line x1="7" y1="14.5" x2="17" y2="14.5" />
          </svg>
        </button>
      </header>


      {/* Lower-Third Greeting & Single Sleek CTA */}
      <main className="relative z-20 px-6 pb-2 flex flex-col items-center text-center max-w-md mx-auto w-full mt-30">
        <motion.div {...enterText(0.05, 14)} className="space-y-1.5">
          <h1 className="text-[40px] sm:text-[46px] font-semibold tracking-[-0.03em] leading-[1.06] text-[#454954]">
            {greeting}, {firstName}
          </h1>
          <p
            aria-live="polite"
            className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.06em] text-[#8E95A2]"
          >
            {hint}
          </p>
        </motion.div>

        <motion.div {...enterText(0.14, 10)} className="mt-5">
          <button
            type="button"
            onClick={() => onContinue('explorar')}
            className="min-h-[46px] px-7 rounded-full bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium inline-flex items-center gap-2 shadow-md enabled:active:scale-[0.96] transition-[transform,background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111827]"
          >
            <span>Entrar no campus</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </motion.div>
      </main>

      {/* 3 Soft-Diffused Ambient Mascots Emerging from Edges */}
      <WelcomeBackTrioShowcase
        variant="edges"
        gaze={gaze}
        onBlueClick={() => setHint(`${safeRoutesCount} POSTES ACESOS AGORA NA TRINDADE`)}
        onGoldClick={() => onContinue('explorar')}
        onPinkClick={() => setHint('COLEGAS VERIFICADOS GOV.BR NO SEU HORÁRIO')}
      />
    </motion.div>
  );
};
